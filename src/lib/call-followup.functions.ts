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
    const db = await admin();
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
      .select("id, message_id, source_row, full_name, phone")
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

export const getCallFollowupSheetPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ messageId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const msg = await visibleMessage(ctx, data.messageId);
    const db = await admin();
    const { data: blob, error } = await db.storage.from("sheets").download(msg.file_path);
    if (error || !blob) throw new Error("تعذر قراءة ملف الشيت");
    const XLSX = await import("xlsx");
    const wb = XLSX.read(new Uint8Array(await blob.arrayBuffer()), { type: "array" });
    const first = wb.Sheets[wb.SheetNames[0]];
    if (!first) throw new Error("ملف الشيت فارغ");
    const rows = (XLSX.utils.sheet_to_json(first, { header: 1, defval: "", raw: false }) as unknown[][])
      .slice(0, 3000).map((r) => r.slice(0, 60).map((v) => String(v ?? "")));
    return { message: { id: msg.id, subject: msg.subject }, headers: rows[0] ?? [], sample: rows.slice(1, 6), totalRows: Math.max(0, rows.length - 1) };
  });

export const syncCallFollowupContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    messageId: z.string().uuid(),
    phoneColumn: z.number().int().min(0).max(59),
    nameColumn: z.number().int().min(0).max(59).nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const msg = await visibleMessage(ctx, data.messageId);
    const db = await admin();
    const { data: blob, error } = await db.storage.from("sheets").download(msg.file_path);
    if (error || !blob) throw new Error("تعذر قراءة ملف الشيت");
    const XLSX = await import("xlsx");
    const wb = XLSX.read(new Uint8Array(await blob.arrayBuffer()), { type: "array" });
    const first = wb.Sheets[wb.SheetNames[0]];
    if (!first) throw new Error("ملف الشيت فارغ");
    const rows = (XLSX.utils.sheet_to_json(first, { header: 1, defval: "", raw: false }) as unknown[][]).slice(0, 3000);
    const records = rows.slice(1).map((row, index) => ({
      message_id: data.messageId,
      source_row: index + 2,
      full_name: data.nameColumn === null ? "" : String(row[data.nameColumn] ?? "").trim(),
      phone: String(row[data.phoneColumn] ?? "").replace(/[\\s().-]/g, "").trim(),
    })).filter((r) => r.phone.length >= 5);
    if (!records.length) throw new Error("لم يتم العثور على أرقام في العمود المحدد");
    const { error: upsertError } = await db.from("call_followup_contacts")
      .upsert(records, { onConflict: "message_id,source_row" });
    if (upsertError) throw new Error(upsertError.message);
    return { count: records.length };
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
    const db = await admin();
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
    const db = await admin();
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
    const db = await admin();
    const { error } = await db.from("call_followup_statuses").update({ is_active: false }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
