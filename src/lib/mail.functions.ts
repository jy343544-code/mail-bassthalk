import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { usernameToEmail } from "@/lib/identity";

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,30}$/, "اسم المستخدم: حروف إنجليزية وأرقام فقط (3-30)");
const passwordSchema = z.string().min(12, "كلمة المرور 12 حرفًا على الأقل").max(72);
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_RECIPIENTS = 100;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Ctx = { supabase: any; userId: string };

async function logActivity(entry: {
  actor_id: string | null;
  action: string;
  target_user_id?: string | null;
  message_id?: string | null;
  details?: Record<string, unknown>;
}) {
  const db = await admin();
  await db.from("activity_log").insert({ details: {}, ...entry } as never);
}

async function namesOf(ids: string[]) {
  const db = await admin();
  const { data } = await db.from("profiles").select("id, full_name").in("id", ids);
  return ids.map((id) => data?.find((p) => p.id === id)?.full_name ?? "—");
}

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
  if (p.error) {
    await db.auth.admin.deleteUser(id);
    throw new Error(p.error.message);
  }
  const r = await db.from("user_roles").insert({ user_id: id, role: input.role });
  if (r.error) {
    await db.auth.admin.deleteUser(id);
    throw new Error(r.error.message);
  }
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
    const id = await createUserWithRole({ ...data, role: "supervisor", mustChange: false });
    await logActivity({ actor_id: id, action: "account_created", target_user_id: id, details: { name: data.fullName, role: "supervisor" } });
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
        role: z.enum(["supervisor", "manager", "employee"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireSupervisor(context as Ctx);
    const { data: result, error } = await context.supabase.functions.invoke("create-account", {
      body: data,
    });
    if (error) {
      const payload = (error as any).context;
      const message = payload?.error ?? error.message;
      throw new Error(message || "تعذر إنشاء الحساب");
    }
    if (!result?.ok) throw new Error(result?.error ?? "تعذر إنشاء الحساب");
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
    await db.from("password_reset_requests").update({ resolved_at: new Date().toISOString() }).eq("user_id", data.userId).is("resolved_at", null);
    const [name] = await namesOf([data.userId]);
    await logActivity({ actor_id: context.userId, action: "password_reset", target_user_id: data.userId, details: { name } });
    return { ok: true };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSupervisor(context as Ctx);
    if (data.userId === context.userId) throw new Error("لا يمكنك حذف حسابك");
    const db = await admin();
    const [name] = await namesOf([data.userId]);
    const { error } = await db.auth.admin.deleteUser(data.userId);
    if (!error) await logActivity({ actor_id: context.userId, action: "account_deleted", target_user_id: data.userId, details: { name } });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Supervisor clears the activity log manually.
// scope "logins": only login/logout/view entries; "all": everything. olderThanDays: 0 = all ages.
export const clearActivityLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ scope: z.enum(["logins", "all"]), olderThanDays: z.number().int().min(0).max(3650) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireSupervisor(context as Ctx);
    const db = await admin();
    let q = db.from("activity_log").delete({ count: "exact" });
    if (data.scope === "logins") q = q.in("action", ["login", "logout", "view_message"]);
    const cutoff = new Date(Date.now() - data.olderThanDays * 86400000).toISOString();
    q = q.lt("created_at", cutoff);
    const { error, count } = await q;
    if (error) throw new Error(error.message);
    await logActivity({ actor_id: context.userId, action: "log_cleared", details: { detail: `${count ?? 0} عملية` } });
    return { deleted: count ?? 0 };
  });

export const completePasswordChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      currentPassword: z.string().min(1).max(72),
      newPassword: passwordSchema,
    }).refine((value) => value.currentPassword !== value.newPassword, {
      message: "كلمة المرور الجديدة يجب أن تختلف عن الحالية",
      path: ["newPassword"],
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("username")
      .eq("id", context.userId)
      .maybeSingle();
    if (profileError || !profile) throw new Error("تعذر التحقق من الحساب");

    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("إعدادات تسجيل الدخول غير مكتملة");
    const { createClient } = await import("@supabase/supabase-js");
    const verifier = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: verified, error: verifyError } = await verifier.auth.signInWithPassword({
      email: usernameToEmail(profile.username),
      password: data.currentPassword,
    });
    if (verifyError || verified.user?.id !== context.userId) {
      throw new Error("كلمة المرور الحالية غير صحيحة");
    }

    // Perform the password update only after the server verifies the current password.
    const { error: passwordError } = await db.auth.admin.updateUserById(context.userId, {
      password: data.newPassword,
    });
    if (passwordError) throw new Error(passwordError.message);

    const { error } = await db
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", context.userId);
    if (error) throw new Error("تم تغيير كلمة المرور لكن تعذر تحديث حالة الحساب");
    await logActivity({ actor_id: context.userId, action: "password_changed" });
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
        recipientIds: z.array(z.string().uuid()).min(1, "اختر مستلم واحد على الأقل").max(MAX_RECIPIENTS, "الحد الأقصى 100 مستلم").refine((ids) => new Set(ids).size === ids.length, "يوجد مستلم مكرر"),
        sheetUrl: z
          .string()
          .trim()
          .regex(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]+/, "رابط جوجل شيت غير صحيح")
          .optional()
          .or(z.literal("")),
        file: z
          .object({
            name: z.string().trim().min(1).max(180).regex(allowedExt, "الملف لازم يكون Excel أو CSV"),
            base64: z.string().min(1).max(Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4 + 4),
          })
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const c = context as Ctx;
    if (!(await hasRole(c, "supervisor")) && !(await hasRole(c, "manager")) && !(await hasRole(c, "employee")))
      throw new Error("غير مسموح");
    if (!data.file && !data.sheetUrl) throw new Error("أرفق شيت إكسل أو رابط جوجل شيت");
    const db = await admin();
    let filePath: string | null = null;
    if (data.file) {
      let decoded: string;
      try {
        decoded = atob(data.file.base64);
      } catch {
        throw new Error("محتوى الملف غير صالح");
      }
      if (decoded.length === 0 || decoded.length > MAX_ATTACHMENT_BYTES) {
        throw new Error("حجم الملف يجب ألا يتجاوز 8 ميجابايت");
      }
      const bin = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
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
        sheet_url: sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const rec = await db
      .from("message_recipients")
      .insert(data.recipientIds.map((r) => ({ message_id: msg.id, recipient_id: r })));
    if (rec.error) throw new Error(rec.error.message);
    const recipients = await namesOf(data.recipientIds);
    await logActivity({
      actor_id: context.userId,
      action: "message_sent",
      message_id: msg.id,
      details: { subject: data.subject, recipients, file: data.file?.name ?? (sheetId ? "Google Sheet" : null) },
    });
    return { id: msg.id };
  });

export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context as Ctx);
    // Only a participant (sender/recipient, enforced by RLS) may delete the message.
    const { data: visible } = await context.supabase.from("messages").select("id").eq("id", data.id).maybeSingle();
    if (!visible) throw new Error("الرسالة غير متاحة");
    const db = await admin();
    const { data: msg } = await db
      .from("messages")
      .select("file_path, subject, sender_id, message_recipients(recipient_id)")
      .eq("id", data.id)
      .maybeSingle();
    if (msg?.file_path) await db.storage.from("sheets").remove([msg.file_path]);
    const { error } = await db.from("messages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (msg) {
      const recipients = await namesOf(msg.message_recipients.map((r) => r.recipient_id));
      const [sender] = await namesOf([msg.sender_id]);
      await logActivity({ actor_id: context.userId, action: "message_deleted", message_id: data.id, details: { subject: msg.subject, sender, recipients } });
    }
    return { ok: true };
  });

export const getSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // RLS decides whether the caller may see this message at all
    const { data: msg } = await context.supabase
      .from("messages")
      .select("file_path, subject")
      .eq("id", data.id)
      .maybeSingle();
    if (!msg?.file_path) throw new Error("الشيت غير متاح أو تم حذفه");
    const db = await admin();
    await logActivity({ actor_id: context.userId, action: "sheet_opened", message_id: data.id, details: { subject: msg.subject } });
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

async function findUser(username: string) {
  const db = await admin();
  const { data } = await db.from("profiles").select("id, full_name").eq("username", username).maybeSingle();
  return data;
}

// Employees/managers: sends a reset request to the supervisor. Never reveals whether the user exists.
export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ username: usernameSchema }).parse(d))
  .handler(async ({ data }) => {
    const user = await findUser(data.username);
    if (!user) return { ok: true };
    const db = await admin();
    const { data: sup } = await db.from("user_roles").select("id").eq("user_id", user.id).eq("role", "supervisor").maybeSingle();
    if (sup) return { ok: true };
    const { data: pending } = await db
      .from("password_reset_requests")
      .select("id")
      .eq("user_id", user.id)
      .is("resolved_at", null)
      .maybeSingle();
    if (!pending) {
      await db.from("password_reset_requests").insert({ user_id: user.id });
      await logActivity({ actor_id: user.id, action: "reset_requested", target_user_id: user.id, details: { name: user.full_name } });
    }
    return { ok: true };
  });


// Aggregate counts only — never message contents (messages stay private to sender/recipients).
export const getStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context as Ctx);
    const db = await admin();
    const since = new Date(Date.now() - 13 * 864e5);
    since.setHours(0, 0, 0, 0);
    const [roles, msgs, unread, recent] = await Promise.all([
      db.from("user_roles").select("role"),
      db.from("messages").select("id", { count: "exact", head: true }),
      db.from("message_recipients").select("message_id", { count: "exact", head: true }).is("read_at", null),
      db.from("messages").select("created_at, sender_id").gte("created_at", since.toISOString()),
    ]);
    const byRole = { supervisor: 0, manager: 0, employee: 0 } as Record<string, number>;
    for (const r of roles.data ?? []) byRole[r.role] = (byRole[r.role] ?? 0) + 1;
    const days: { day: string; count: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(since.getTime() + i * 864e5);
      days.push({ day: d.toISOString().slice(0, 10), count: 0 });
    }
    const senders: Record<string, number> = {};
    for (const m of recent.data ?? []) {
      const k = m.created_at.slice(0, 10);
      const d = days.find((x) => x.day === k);
      if (d) d.count++;
      senders[m.sender_id] = (senders[m.sender_id] ?? 0) + 1;
    }
    const topIds = Object.entries(senders).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const names = await namesOf(topIds.map(([id]) => id));
    const today = days[days.length - 1]?.count ?? 0;
    return {
      byRole,
      totalMessages: msgs.count ?? 0,
      unread: unread.count ?? 0,
      today,
      last14: (recent.data ?? []).length,
      days,
      topSenders: topIds.map(([, n], i) => ({ name: names[i] ?? "—", count: n })),
    };
  });
