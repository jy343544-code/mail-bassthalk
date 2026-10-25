import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { usernameToEmail } from "@/lib/identity";

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,30}$/, "اسم المستخدم: حروف إنجليزية وأرقام فقط (3-30)");
const passwordSchema = z.string().min(6, "كلمة المرور 6 أحرف على الأقل").max(72);

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Ctx = { supabase: any; userId: string };

async function hasRole(ctx: Ctx, role: "supervisor" | "manager" | "employee") {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: role });
  return data === true;
}
async function requireSupervisor(ctx: Ctx) {
  if (!(await hasRole(ctx, "supervisor"))) throw new Error("هذه العملية للسوبر فايزر فقط");
}
async function requireStaff(ctx: Ctx) {
  if (!(await hasRole(ctx, "supervisor")) && !(await hasRole(ctx, "manager")))
    throw new Error("هذه العملية للسوبر فايزر أو المدير فقط");
}

async function createUserWithRole(input: {
  fullName: string;
  username: string;
  password: string;
  role: "supervisor" | "manager" | "employee";
  mustChange: boolean;
}) {
  const db = await admin();
  const { data: existing } = await db
    .from("profiles")
    .select("id")
    .eq("username", input.username)
    .maybeSingle();
  if (existing) throw new Error("اسم المستخدم مستخدم بالفعل");
  const { data: created, error } = await db.auth.admin.createUser({
    email: usernameToEmail(input.username),
    password: input.password,
    email_confirm: true,
  });
  if (error || !created.user) throw new Error(error?.message ?? "تعذر إنشاء الحساب");
  const id = created.user.id;
  const p = await db.from("profiles").insert({
    id,
    full_name: input.fullName,
    username: input.username,
    must_change_password: input.mustChange,
  });
  if (p.error) throw new Error(p.error.message);
  const r = await db.from("user_roles").insert({ user_id: id, role: input.role });
  if (r.error) throw new Error(r.error.message);
  return id;
}

export const getSetupStatus = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { count } = await db
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "supervisor");
  return { needsSetup: (count ?? 0) === 0 };
});

export const setupSupervisor = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({ fullName: z.string().trim().min(2), username: usernameSchema, password: passwordSchema })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { count } = await db
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "supervisor");
    if ((count ?? 0) > 0) throw new Error("تم إعداد السوبر فايزر بالفعل");
    await createUserWithRole({ ...data, role: "supervisor", mustChange: false });
    return { ok: true };
  });

export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        fullName: z.string().trim().min(2, "اكتب الاسم"),
        username: usernameSchema,
        password: passwordSchema,
        role: z.enum(["manager", "employee"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireSupervisor(context as Ctx);
    await createUserWithRole({ ...data, mustChange: true });
    return { ok: true };
  });

export const resetTempPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), password: passwordSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSupervisor(context as Ctx);
    const db = await admin();
    const { error } = await db.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message);
    await db.from("profiles").update({ must_change_password: true }).eq("id", data.userId);
    return { ok: true };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSupervisor(context as Ctx);
    if (data.userId === context.userId) throw new Error("لا يمكنك حذف حسابك");
    const db = await admin();
    const { error } = await db.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markPasswordChanged = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    await db.from("profiles").update({ must_change_password: false }).eq("id", context.userId);
    return { ok: true };
  });

const allowedExt = /\.(xlsx|xls|csv|ods)$/i;

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        subject: z.string().trim().min(1, "اكتب عنوان الرسالة").max(200),
        body: z.string().max(5000).default(""),
        recipientIds: z.array(z.string().uuid()).min(1, "اختر مستلم واحد على الأقل"),
        sheetUrl: z
          .string()
          .trim()
          .regex(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]+/, "رابط جوجل شيت غير صحيح")
          .optional()
          .or(z.literal("")),
        file: z
          .object({ name: z.string().regex(allowedExt, "الملف لازم يكون Excel أو CSV"), base64: z.string() })
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context as Ctx);
    if (!data.file && !data.sheetUrl) throw new Error("أرفق شيت إكسل أو رابط جوجل شيت");
    const db = await admin();
    let filePath: string | null = null;
    if (data.file) {
      const bin = Uint8Array.from(atob(data.file.base64), (c) => c.charCodeAt(0));
      const ext = data.file.name.split(".").pop()!.toLowerCase();
      filePath = `${crypto.randomUUID()}.${ext}`;
      const up = await db.storage.from("sheets").upload(filePath, bin, {
        contentType: "application/octet-stream",
      });
      if (up.error) throw new Error(up.error.message);
    }
    const sheetId = data.sheetUrl?.match(/\/d\/([A-Za-z0-9_-]+)/)?.[1];
    const { data: msg, error } = await db
      .from("messages")
      .insert({
        sender_id: context.userId,
        subject: data.subject,
        body: data.body,
        file_path: filePath,
        file_name: data.file?.name ?? null,
        sheet_url: sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/preview` : null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const rec = await db
      .from("message_recipients")
      .insert(data.recipientIds.map((r) => ({ message_id: msg.id, recipient_id: r })));
    if (rec.error) throw new Error(rec.error.message);
    return { id: msg.id };
  });

export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context as Ctx);
    const db = await admin();
    const { data: msg } = await db.from("messages").select("file_path").eq("id", data.id).maybeSingle();
    if (msg?.file_path) await db.storage.from("sheets").remove([msg.file_path]);
    const { error } = await db.from("messages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // RLS decides whether the caller may see this message at all
    const { data: msg } = await context.supabase
      .from("messages")
      .select("file_path")
      .eq("id", data.id)
      .maybeSingle();
    if (!msg?.file_path) throw new Error("الشيت غير متاح أو تم حذفه");
    const db = await admin();
    const { data: blob, error } = await db.storage.from("sheets").download(msg.file_path);
    if (error || !blob) throw new Error("الشيت غير متاح أو تم حذفه");
    const XLSX = await import("xlsx");
    const wb = XLSX.read(new Uint8Array(await blob.arrayBuffer()), { type: "array" });
    return {
      sheets: wb.SheetNames.map((name) => ({
        name,
        rows: (
          XLSX.utils.sheet_to_json(wb.Sheets[name]!, { header: 1, defval: "", raw: false }) as unknown[][]
        )
          .slice(0, 3000)
          .map((r) => r.slice(0, 60).map((c) => String(c ?? ""))),
      })),
    };
  });
