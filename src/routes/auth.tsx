import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles, LockKeyhole } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSetupStatus, requestPasswordReset, setupSupervisor } from "@/lib/mail.functions";
import { usernameToEmail } from "@/lib/identity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | بريد بستطهالك" },
      { name: "description", content: "سجّل دخولك إلى البريد الداخلي لشركة بستطهالك" },
      { property: "og:title", content: "تسجيل الدخول | بريد بستطهالك" },
      { property: "og:description", content: "سجّل دخولك إلى البريد الداخلي لشركة بستطهالك" },
    ],
  }),
  component: AuthPage,
});

type View = "login" | "forgot" | "setup";

function AuthPage() {
  const [view, setView] = useState<View>("login");
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    let active = true;
    getSetupStatus()
      .then(({ needsSetup }) => { if (active) setNeedsSetup(needsSetup); })
      .catch(() => { if (active) setNeedsSetup(false); });
    return () => { active = false; };
  }, []);

  return (
    <main dir="rtl" className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#09090d] px-4 py-10 text-white">
      <style>{`
        @keyframes auth-drift { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(28px,-22px,0) scale(1.08); } }
        @keyframes auth-glow { 0%,100% { opacity:.35; } 50% { opacity:.7; } }
        @keyframes auth-rise { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .auth-orb { animation: auth-drift 13s ease-in-out infinite; }
        .auth-orb-delay { animation: auth-drift 17s ease-in-out infinite reverse; }
        .auth-grid { background-image: linear-gradient(rgba(148,163,184,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.055) 1px,transparent 1px); background-size: 44px 44px; mask-image:linear-gradient(to bottom,black,transparent 90%); }
        .auth-card { animation: auth-rise .7s cubic-bezier(.2,.8,.2,1) both; }
        @media (prefers-reduced-motion: reduce) { .auth-orb,.auth-orb-delay,.auth-card { animation:none !important; } }
      `}</style>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="auth-grid absolute inset-0" />
        <div className="auth-orb absolute -right-28 -top-32 h-[26rem] w-[26rem] rounded-full bg-violet-500/10 blur-[100px]" />
        <div className="auth-orb-delay absolute -bottom-40 -left-24 h-[30rem] w-[30rem] rounded-full bg-teal-500/10 blur-[110px]" />
        <div className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-400/10" />
        <div className="absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-teal-400/[0.07]" />
      </div>

      <section className="auth-card grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#14141b] shadow-[0_30px_100px_rgba(0,0,0,.5)] backdrop-blur-2xl md:grid-cols-[1.05fr_.95fr]">
        <div className="relative hidden min-h-[620px] flex-col justify-between overflow-hidden border-l border-white/10 bg-[#111117] p-10 md:flex">
          <div className="absolute -left-20 top-24 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <img src="/brand-mark.svg" alt="شعار بستطهالك" className="size-12 rounded-2xl shadow-lg shadow-violet-950/30" />
            <div><p className="text-lg font-bold tracking-wide">بستطهالك</p><p className="text-xs text-slate-400">منظومة التواصل الداخلي</p></div>
          </div>
          <div className="relative space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-xs font-medium text-violet-200"><Sparkles className="size-3.5" /> مساحة عمل واحدة لفريقك</div>
            <h2 className="max-w-md text-4xl font-bold leading-[1.35]">تواصل أسرع.<br /><span className="bg-gradient-to-l from-violet-300 to-teal-300 bg-clip-text text-transparent">تنظيم أوضح.</span></h2>
            <p className="max-w-sm text-sm leading-7 text-slate-300">بريد داخلي ومراسلات ومشاركة ملفات، في تجربة عمل موحّدة وآمنة لفريقك.</p>
            <div className="flex flex-wrap gap-3 pt-2 text-xs text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">مراسلات الفريق</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">مشاركة الملفات</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">متابعة منظمة</span>
            </div>
          </div>
          <div className="relative flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="size-4 text-violet-300" /> بيئة مخصصة لفريق بستطهالك</div>
        </div>

        <div className="flex min-h-[620px] flex-col justify-center p-7 sm:p-10">
          <div className="mb-8 flex items-center gap-3 md:hidden">
            <img src="/brand-mark.svg" alt="شعار بستطهالك" className="size-11 rounded-2xl" />
            <div><p className="font-bold">بستطهالك</p><p className="text-xs text-slate-400">البريد الداخلي</p></div>
          </div>
          <div className="mb-8">
            <div className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/10 text-violet-200"><LockKeyhole className="size-5" /></div>
            <p className="mb-2 text-xs font-semibold tracking-[.18em] text-violet-300">WORKSPACE ACCESS</p>
            <h1 className="text-3xl font-bold tracking-tight">{view === "login" ? "أهلاً بعودتك" : view === "forgot" ? "استعادة كلمة المرور" : "إعداد أول مدير"}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">{view === "login" ? "سجّل دخولك للمتابعة إلى مساحة العمل." : view === "forgot" ? "اكتب اسم المستخدم لإرسال طلب استعادة كلمة المرور." : "إنشاء حساب المشرف الأول بصورة آمنة."}</p>
          </div>
          {view === "login" ? (
            <LoginForm onForgot={() => setView("forgot")} />
          ) : view === "forgot" ? (
            <ForgotForm onBack={() => setView("login")} />
          ) : (
            <SetupForm onBack={() => setView("login")} onDone={() => setView("login")} />
          )}
          {needsSetup && view === "login" && (
            <button type="button" onClick={() => setView("setup")} className="mt-5 w-full text-center text-xs text-cyan-300 transition hover:text-violet-200 hover:underline">
              إعداد أول حساب مدير
            </button>
          )}
          <p className="mt-8 flex items-center justify-center gap-2 border-t border-white/10 pt-5 text-xs text-slate-500">
            <ShieldCheck className="size-4 text-violet-300" /> يتم تسجيل عمليات الدخول لحماية مساحة العمل
          </p>
        </div>
      </section>
    </main>
  );
}

async function signIn(username: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
  if (error || !data.user) throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
  await supabase.from("activity_log").insert({ actor_id: data.user.id, action: "login" });
}

function LoginForm({ onForgot }: { onForgot: () => void }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form className="space-y-5" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true);
      try { await signIn(username, password); navigate({ to: "/inbox" }); }
      catch (err) { toast.error((err as Error).message); }
      finally { setBusy(false); }
    }}>
      <div className="space-y-2">
        <Label htmlFor="un" className="text-slate-200">اسم المستخدم</Label>
        <Input id="un" dir="ltr" autoComplete="username" placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} required className="h-12 border-white/10 bg-white/[0.045] text-white placeholder:text-slate-600 focus-visible:ring-violet-400" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between"><Label htmlFor="pw" className="text-slate-200">كلمة المرور</Label><button type="button" onClick={onForgot} className="text-xs text-cyan-300 transition hover:text-violet-200 hover:underline">نسيت كلمة المرور؟</button></div>
        <Input id="pw" type="password" dir="ltr" autoComplete="current-password" placeholder="••••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12 border-white/10 bg-white/[0.045] text-white placeholder:text-slate-600 focus-visible:ring-cyan-400" />
      </div>
      <Button type="submit" className="h-12 w-full bg-gradient-to-l from-[#5145cd] to-[#8652d8] text-base font-semibold text-white shadow-lg shadow-violet-950/30 transition hover:brightness-110" disabled={busy}>{busy ? "جاري تسجيل الدخول..." : "دخول إلى مساحة العمل"}</Button>
    </form>
  );
}


function SetupForm({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [fullName, setFullName] = useState("Hussein");
  const [username, setUsername] = useState("hassin");
  const [password, setPassword] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      try {
        await setupSupervisor({ data: { fullName, username, password, setupToken } });
        toast.success("تم إنشاء حساب المشرف. سجّل الدخول بكلمة المرور المؤقتة ثم غيّرها فورًا.");
        onDone();
      } catch (err) {
        toast.error((err as Error).message || "تعذر إنشاء الحساب");
      } finally {
        setBusy(false);
      }
    }}>
      <button type="button" onClick={onBack} className="text-sm text-cyan-300 hover:underline">رجوع لتسجيل الدخول</button>
      <div className="space-y-2">
        <Label className="text-slate-200">الاسم</Label>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required className="h-12 border-white/10 bg-white/[0.045] text-white" />
      </div>
      <div className="space-y-2">
        <Label className="text-slate-200">اسم المستخدم</Label>
        <Input dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} required className="h-12 border-white/10 bg-white/[0.045] text-white" />
      </div>
      <div className="space-y-2">
        <Label className="text-slate-200">كلمة المرور المؤقتة</Label>
        <Input dir="ltr" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={12} maxLength={72} required className="h-12 border-white/10 bg-white/[0.045] text-white" />
      </div>
      <div className="space-y-2">
        <Label className="text-slate-200">رمز التهيئة لمرة واحدة</Label>
        <Input dir="ltr" type="password" autoComplete="off" value={setupToken} onChange={(e) => setSetupToken(e.target.value)} minLength={32} required className="h-12 border-white/10 bg-white/[0.045] text-white" />
      </div>
      <Button type="submit" className="h-12 w-full bg-gradient-to-l from-[#5145cd] to-[#8652d8] text-white" disabled={busy}>
        {busy ? "جاري إنشاء حساب المشرف..." : "إنشاء حساب المشرف الأول"}
      </Button>
    </form>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-cyan-300 transition hover:text-violet-200"><ArrowRight className="size-4" /> رجوع لتسجيل الدخول</button>
      {sent ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] px-5 py-8 text-center"><CheckCircle2 className="size-10 text-emerald-300" /><p className="font-semibold text-white">تم إرسال طلبك للسوبر فايزر</p><p className="text-sm leading-6 text-slate-400">هيبعتلك كلمة مرور مؤقتة جديدة، وأول ما تدخل بيها هتغيرها.</p></div>
      ) : (
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault(); setBusy(true);
          try { await requestPasswordReset({ data: { username } }); setSent(true); }
          catch (err) { toast.error((err as Error).message); }
          finally { setBusy(false); }
        }}>
          <p className="text-sm leading-6 text-slate-400">للموظفين والمديرين: اكتب اسم المستخدم، وهيتم إرسال طلب للسوبر فايزر.</p>
          <div className="space-y-2"><Label className="text-slate-200">اسم المستخدم</Label><Input dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} required className="h-12 border-white/10 bg-white/[0.045] text-white" /></div>
          <Button type="submit" className="h-12 w-full bg-gradient-to-l from-cyan-500 to-blue-600 text-white" disabled={busy}>{busy ? "جاري الإرسال..." : "إرسال الطلب"}</Button>
        </form>
      )}
    </div>
  );
}
