import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
async function hasRole(ctx: Ctx, role: "supervisor" | "manager") {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: role });
  return data === true;
}
async function requireStaff(ctx: Ctx) {
  if (!(await hasRole(ctx, "supervisor")) && !(await hasRole(ctx, "manager"))) {
    throw new Error("إدارة حالات الاتصال متاحة للمدير والسوبر فايزر فقط");
  }
}
async function visibleMessage(ctx: Ctx, id: string) {
  const { data, error } = await ctx.supabase.from("messages")
    .select("id, subject, file_path, file_name, created_at")
    .eq("id", id).maybeSingle();
  if (error || !data) throw new Error("الشيت غير متاح لحسابك");
  if (!data.file_path) throw new Error("الرسالة لا تحتوي على ملف Excel أو CSV");
  return data;
}

export const getCallFollowupWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const db: any = await admin();
    const [messages, statuses, profile] = await Promise.all([
      ctx.supabase.from("messages").select("id, subject, file_name, created_at, file_path")
        .not("file_path", "is", null).order("created_at", { ascending: false }).limit(100),
      db.from("call_followup_statuses").select("id, label, is_active, sort_order")
        .order("sort_order"),
      db.from("profiles").select("full_name").eq("id", ctx.userId).maybeSingle(),
    ]);
    if (messages.error) throw new Error(messages.error.message);
    if (statuses.error) throw new Error(statuses.error.message);
    const isStaff = await hasRole(ctx, "supervisor") || await hasRole(ctx, "manager");
    const { data: logs, error: logError } = await db.from("call_followup_logs")
      .select("id, contact_id, status_id, employee_id, note, created_at")
      .order("created_at", { ascending: false }).limit(500);
    if (logError) throw new Error(logError.message);
    const allowedIds = new Set((messages.data ?? []).map((m: any) => m.id));
    const { data: contacts, error: contactError } = await db.from("call_followup_contacts")
      .select("id, message_id, source_sheet, source_row, phone_index, full_name, phone")
      .in("message_id", [...allowedIds].length ? [...allowedIds] : ["00000000-0000-0000-0000-000000000000"]);
    if (contactError) throw new Error(contactError.message);
    const contactById = new Map((contacts ?? []).map((c: any) => [c.id, c]));
    const visibleLogs = (logs ?? []).filter((l: any) => {
      const c = contactById.get(l.contact_id) as any;
      return c && (isStaff || l.employee_id === ctx.userId);
    });
    const employeeIds = [...new Set(visibleLogs.map((l: any) => l.employee_id))];
    const { data: profiles } = employeeIds.length
      ? await db.from("profiles").select("id, full_name").in("id", employeeIds)
      : { data: [] };
    const names = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));
    const statusById = new Map((statuses.data ?? []).map((s: any) => [s.id, s.label]));
    return {
      messages: (messages.data ?? []).map((m: any) => ({ id: m.id, subject: m.subject, fileName: m.file_name, createdAt: m.created_at })),
      statuses: (statuses.data ?? []).filter((status: any) => status.is_active),
      isStaff,
      profileName: profile?.full_name ?? "",
      contacts: contacts ?? [],
      logs: visibleLogs.map((l: any) => ({
        ...l,
        employeeName: names.get(l.employee_id) ?? "موظف",
        statusLabel: statusById.get(l.status_id) ?? "حالة غير نشطة",
        contact: contactById.get(l.contact_id) ?? null,
      })),
    };
  });

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

function extractPhoneNumbers(value: unknown): string[] {
  const text = normalizeDigits(String(value ?? ""));
  const candidates = text.match(/(?:\\+|00)?[0-9][0-9\\s().-]{5,20}[0-9]/g) ?? [];
  const found = new Set<string>();
  for (const candidate of candidates) {
    let digits = candidate.replace(/\\D/g, "");
    if (digits.startsWith("0020")) digits = digits.slice(2);
    if (digits.length >= 7 && digits.length <= 15) found.add(digits);
  }
  return [...found];
}

function headerIndex(headers: unknown[], pattern: RegExp): number {
  return headers.findIndex((value) => pattern.test(normalizeDigits(String(value ?? "")).toLowerCase()));
}

export const getCallFollowupSheetPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ messageId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const msg = await visibleMessage(ctx, data.messageId);
    const db: any = await admin();
    const { data: blob, error } = await db.storage.from("sheets").download(msg.file_path);
    if (error || !blob) throw new Error("تعذر قراءة ملف الشيت");
    const XLSX = await import("xlsx");
    const wb = XLSX.read(new Uint8Array(await blob.arrayBuffer()), { type: "array" });
    const sheets = wb.SheetNames.map((name) => {
      const rows = (XLSX.utils.sheet_to_json(wb.Sheets[name]!, { header: 1, defval: "", raw: false }) as unknown[][])
        .slice(0, 10000);
      const headers = (rows[0] ?? []).slice(0, 60).map((v) => String(v ?? ""));
      const phoneHeader = headerIndex(headers, /(phone|mobile|telephone|tel|موبايل|محمول|تليفون|هاتف|رقم)/i);
      const estimated = rows.slice(1).reduce((sum, row) => {
        const cells = phoneHeader >= 0 ? [row[phoneHeader]] : row;
        return sum + cells.reduce((n, cell) => n + extractPhoneNumbers(cell).length, 0);
      }, 0);
      return { name, headers, totalRows: Math.max(0, rows.length - 1), estimatedPhones: estimated };
    });
    if (!sheets.length) throw new Error("ملف الشيت فارغ");
    return {
      message: { id: msg.id, subject: msg.subject },
      headers: sheets[0]!.headers,
      sample: [],
      totalRows: sheets.reduce((sum, sheet) => sum + sheet.totalRows, 0),
      sheets,
      estimatedPhones: sheets.reduce((sum, sheet) => sum + sheet.estimatedPhones, 0),
    };
  });

export const syncCallFollowupContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    messageId: z.string().uuid(),
    phoneColumn: z.number().int().min(-1).max(59).default(-1),
    nameColumn: z.number().int().min(-2).max(59).default(-1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const msg = await visibleMessage(ctx, data.messageId);
    const db: any = await admin();
    const { data: blob, error } = await db.storage.from("sheets").download(msg.file_path);
    if (error || !blob) throw new Error("تعذر قراءة ملف الشيت");
    const XLSX = await import("xlsx");
    const wb = XLSX.read(new Uint8Array(await blob.arrayBuffer()), { type: "array" });
    const records: Array<Record<string, unknown>> = [];
    let scannedRows = 0;
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      if (!sheet) continue;
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }) as unknown[][];
      const headers = rows[0] ?? [];
      const detectedNameColumn = headerIndex(headers, /(name|full.?name|الاسم|اسم العميل|اسم الطالب)/i);
      const detectedPhoneColumn = headerIndex(headers, /(phone|mobile|telephone|tel|موبايل|محمول|تليفون|هاتف|رقم)/i);
      for (let rowIndex = 1; rowIndex < rows.length && rowIndex < 10000; rowIndex++) {
        const row = rows[rowIndex] ?? [];
        scannedRows++;
        const columns = data.phoneColumn >= 0
          ? [data.phoneColumn]
          : detectedPhoneColumn >= 0 ? [detectedPhoneColumn] : row.map((_, index) => index);
        const nameColumn = data.nameColumn >= 0 ? data.nameColumn : data.nameColumn === -1 ? detectedNameColumn : -1;
        const name = nameColumn >= 0 ? String(row[nameColumn] ?? "").trim().slice(0, 180) : "";
        const seen = new Set<string>();
        let phoneIndex = 0;
        for (const column of columns) {
          for (const phone of extractPhoneNumbers(row[column])) {
            if (seen.has(phone)) continue;
            seen.add(phone);
            phoneIndex++;
            records.push({
              message_id: data.messageId,
              source_sheet: sheetName.slice(0, 120),
              source_row: rowIndex + 1,
              phone_index: phoneIndex,
              full_name: name,
              phone,
            });
          }
        }
      }
    }
    if (!records.length) throw new Error("لم يتم العثور على أرقام هاتف. راجع تنسيق الشيت أو اختر عمود الهاتف يدويًا.");
    const chunkSize = 500;
    for (let i = 0; i < records.length; i += chunkSize) {
      const { error: upsertError } = await db.from("call_followup_contacts")
        .upsert(records.slice(i, i + chunkSize), { onConflict: "message_id,source_sheet,source_row,phone_index" });
      if (upsertError) throw new Error(upsertError.message);
    }
    return {
      count: records.length,
      rowsScanned: scannedRows,
      sheetsScanned: wb.SheetNames.length,
      uniquePhones: new Set(records.map((record) => record.phone)).size,
    };
  });

export const saveCallFollowupLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    contactId: z.string().uuid(),
    statusId: z.string().uuid(),
    note: z.string().max(2000).default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const db: any = await admin();
    const { data: contact } = await db.from("call_followup_contacts").select("id, message_id").eq("id", data.contactId).maybeSingle();
    if (!contact) throw new Error("جهة الاتصال غير موجودة");
    await visibleMessage(ctx, contact.message_id);
    const { data: status } = await db.from("call_followup_statuses").select("id").eq("id", data.statusId).eq("is_active", true).maybeSingle();
    if (!status) throw new Error("حالة الاتصال غير متاحة");
    const { error } = await db.from("call_followup_logs").insert({
      contact_id: data.contactId, status_id: data.statusId, employee_id: ctx.userId, note: data.note.trim(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveCallFollowupStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid().optional(), label: z.string().trim().min(2).max(40), sortOrder: z.number().int().min(0).max(999).default(0) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireStaff(ctx);
    const db: any = await admin();
    const result = data.id
      ? await db.from("call_followup_statuses").update({ label: data.label, sort_order: data.sortOrder }).eq("id", data.id)
      : await db.from("call_followup_statuses").insert({ label: data.label, sort_order: data.sortOrder, created_by: ctx.userId });
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });

export const deactivateCallFollowupStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context as Ctx);
    const db: any = await admin();
    const { error } = await db.from("call_followup_statuses").update({ is_active: false }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
