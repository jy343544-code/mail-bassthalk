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

const PHONE_HEADER = /(phone|mobile|telephone|tel|whatsapp|wa|موبايل|محمول|تليفون|هاتف|رقم\s*(الهاتف|الموبايل|المحمول|التليفون|الواتساب))/i;
const NAME_HEADER = /(full.?name|customer.?name|student.?name|client.?name|name|الاسم|اسم\s*(العميل|الطالب|الموظف|الشخص))/i;

function extractPhoneNumbers(value: unknown, allowGeneric = false): string[] {
  const text = normalizeDigits(String(value ?? ""));
  const found = new Set<string>();
  // Egyptian mobile numbers are extracted independently, even if several occur in one cell.
  const egyptian = /(?:\+?20|0020)?[\s().-]*0?1[\s().-]*[0125](?:[\s().-]*\d){8}/g;
  for (const match of text.matchAll(egyptian)) {
    let digits = match[0].replace(/\D/g, "");
    if (digits.startsWith("0020")) digits = digits.slice(2);
    else if (digits.startsWith("20") && digits.length === 12) digits = "0" + digits.slice(2);
    if (digits.length === 10 && digits.startsWith("1")) digits = "0" + digits;
    if (/^01[0125]\d{8}$/.test(digits)) found.add(digits);
  }
  if (allowGeneric) {
    // Generic landline/international numbers are accepted only in a column explicitly labelled as phone.
    const chunks = text.split(/[;,،\n\r|/]+/);
    for (const chunk of chunks) {
      const candidates = chunk.match(/(?:\+|00)?\d[\d\s().-]{5,20}\d/g) ?? [];
      for (const candidate of candidates) {
        let digits = candidate.replace(/\D/g, "");
        if (digits.startsWith("00")) digits = digits.slice(2);
        if (digits.length >= 7 && digits.length <= 15 && !found.has(digits)) found.add(digits);
      }
    }
  }
  return [...found];
}

function detectHeaderRow(rows: unknown[][]): number {
  let bestIndex = 0;
  let bestScore = 0;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = (rows[i] ?? []).slice(0, 80).map((v) => normalizeDigits(String(v ?? "")).trim());
    const phoneCount = cells.filter((v) => PHONE_HEADER.test(v)).length;
    const nameCount = cells.filter((v) => NAME_HEADER.test(v)).length;
    const score = phoneCount * 3 + nameCount * 2;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function detectNameColumn(headers: unknown[]): number {
  return headers.findIndex((value) => NAME_HEADER.test(normalizeDigits(String(value ?? "")).trim()));
}

function detectPhoneColumns(headers: unknown[]): number[] {
  return headers.map((value, index) => PHONE_HEADER.test(normalizeDigits(String(value ?? "")).trim()) ? index : -1).filter((index) => index >= 0);
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
    const wb = XLSX.read(new Uint8Array(await blob.arrayBuffer()), { type: "array", cellDates: false });
    const sheets = wb.SheetNames.map((name) => {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name]!, { header: 1, defval: "", raw: false }) as unknown[][];
      const headerRow = detectHeaderRow(rows);
      const headers = (rows[headerRow] ?? []).slice(0, 80).map((v) => String(v ?? ""));
      const phoneColumns = detectPhoneColumns(headers);
      const nameColumn = detectNameColumn(headers);
      const estimatedPhones = rows.slice(headerRow + 1, 10001).reduce((sum, row) => {
        const columns = phoneColumns.length ? phoneColumns : row.map((_, index) => index);
        return sum + columns.reduce((n, index) => n + extractPhoneNumbers(row[index], phoneColumns.includes(index)).length, 0);
      }, 0);
      return {
        name, headers, headerRow, nameColumn, phoneColumns,
        totalRows: Math.max(0, Math.min(rows.length - headerRow - 1, 10000)),
        estimatedPhones,
      };
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
    phoneColumn: z.number().int().min(-1).max(79).default(-1),
    nameColumn: z.number().int().min(-2).max(79).default(-1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const msg = await visibleMessage(ctx, data.messageId);
    const db: any = await admin();
    const { data: blob, error } = await db.storage.from("sheets").download(msg.file_path);
    if (error || !blob) throw new Error("تعذر قراءة ملف الشيت");
    const XLSX = await import("xlsx");
    const wb = XLSX.read(new Uint8Array(await blob.arrayBuffer()), { type: "array", cellDates: false });
    const records: Array<Record<string, unknown>> = [];
    let scannedRows = 0;
    const perSheet: Array<{ sheet: string; rows: number; phones: number }> = [];
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      if (!sheet) continue;
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }) as unknown[][];
      const headerRow = detectHeaderRow(rows);
      const headers = rows[headerRow] ?? [];
      const detectedNameColumn = detectNameColumn(headers);
      const detectedPhoneColumns = detectPhoneColumns(headers);
      let sheetPhones = 0;
      for (let rowIndex = headerRow + 1; rowIndex < rows.length && rowIndex <= headerRow + 10000; rowIndex++) {
        const row = rows[rowIndex] ?? [];
        scannedRows++;
        const selectedColumns = data.phoneColumn >= 0 ? [data.phoneColumn] : [];
        const columns = [...new Set([...detectedPhoneColumns, ...selectedColumns])];
        const scanAllColumns = columns.length === 0;
        const candidateColumns = scanAllColumns ? row.map((_, index) => index) : columns;
        let nameColumn = data.nameColumn >= 0 ? data.nameColumn : detectedNameColumn;
        let name = nameColumn >= 0 ? String(row[nameColumn] ?? "").trim() : "";
        if (!name) {
          const nameCandidate = row.find((value, index) => {
            if (candidateColumns.includes(index)) return false;
            const text = String(value ?? "").trim();
            return text.length >= 2 && text.length <= 120 && /[\p{L}]/u.test(text) && !/^\d+$/u.test(text);
          });
          if (nameCandidate !== undefined) name = String(nameCandidate).trim();
        }
        const seen = new Set<string>();
        let phoneIndex = 0;
        for (const column of candidateColumns) {
          const explicitPhoneColumn = detectedPhoneColumns.includes(column) || column === data.phoneColumn;
          for (const phone of extractPhoneNumbers(row[column], explicitPhoneColumn)) {
            if (seen.has(phone)) continue;
            seen.add(phone);
            phoneIndex++;
            records.push({
              message_id: data.messageId,
              source_sheet: sheetName.slice(0, 120),
              source_row: rowIndex + 1,
              phone_index: phoneIndex,
              full_name: name.slice(0, 180),
              phone,
            });
            sheetPhones++;
          }
        }
      }
      perSheet.push({ sheet: sheetName, rows: Math.max(0, Math.min(rows.length - headerRow - 1, 10000)), phones: sheetPhones });
    }
    if (!records.length) throw new Error("لم يتم العثور على أرقام هاتف محمول مصرية. تأكد من وجود أرقام تبدأ بـ 01 أو حدد أعمدة الهاتف.");
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
      perSheet,
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
