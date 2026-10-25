import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSetupStatus, recoverSupervisor, requestPasswordReset, setupSupervisor } from "@/lib/mail.functions";
import { usernameToEmail } from "@/lib/identity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

type View = "login" | "forgot";

function AuthPage() {
  const status = useQuery({ queryKey: ["setup"], queryFn: () => getSetupStatus() });
  const [view, setView] = useState<View>("login");
  const needsSetup = status.data?.needsSetup;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-12 items-center gap-2 bg-topbar px-4 text-topbar-foreground">
        <Mail className="size-5" /> <span className="font-semibold">بستطهالك</span>
        <span className="text-sm opacity-80">· البريد الداخلي</span>
      </header>
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md rounded-md border bg-card p-8 shadow-soft">
          {status.isLoading ? (
            <p className="text-center text-muted-foreground">جاري التحميل...</p>
          ) : needsSetup ? (
            <SetupForm />
          ) : view === "login" ? (
            <LoginForm onForgot={() => setView("forgot")} />
          ) : (
            <ForgotForm onBack={() => setView("login")} />
          )}
          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" /> كل عمليات الدخول بتتسجل
          </p>
        </div>
      </div>
    </div>
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
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await signIn(username, password);
          navigate({ to: "/inbox" });
        } catch (err) {
          toast.error((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <h1 className="text-2xl">تسجيل الدخول</h1>
        <p className="text-sm text-muted-foreground">استخدم اسم المستخدم وكلمة المرور اللي وصلتك.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="un">اسم المستخدم</Label>
        <Input id="un" dir="ltr" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="pw">كلمة المرور</Label>
          <button type="button" onClick={onForgot} className="text-xs text-primary hover:underline">
            نسيت كلمة المرور؟
          </button>
        </div>
        <Input id="pw" type="password" dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "جاري..." : "دخول"}
      </Button>
    </form>
  );
}

function SetupForm() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await setupSupervisor({ data: { fullName, username, password } });
          await signIn(username, password);
          navigate({ to: "/inbox" });
        } catch (err) {
          toast.error((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <h1 className="text-2xl">إعداد السوبر فايزر</h1>
        <p className="text-sm text-muted-foreground">أول حساب في النظام هيكون حساب السوبر فايزر.</p>
      </div>
      <div className="space-y-2">
        <Label>الاسم بالكامل</Label>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>اسم المستخدم</Label>
        <Input dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>كلمة المرور</Label>
        <Input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "جاري..." : "إنشاء والدخول"}
      </Button>
    </form>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [username, setUsername] = useState("");
  const [key, setKey] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowRight className="size-4" /> رجوع لتسجيل الدخول
      </button>
      <h1 className="text-2xl">استعادة كلمة المرور</h1>
      <Tabs defaultValue="staff" dir="rtl">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="staff">موظف / مدير</TabsTrigger>
          <TabsTrigger value="sup">سوبر فايزر</TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="pt-3">
          {sent ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <CheckCircle2 className="size-10 text-primary" />
              <p className="font-medium">تم إرسال طلبك للسوبر فايزر</p>
              <p className="text-sm text-muted-foreground">هيبعتلك كلمة مرور مؤقتة جديدة، وأول ما تدخل بيها هتغيرها.</p>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await requestPasswordReset({ data: { username } });
                  setSent(true);
                } catch (err) {
                  toast.error((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p className="text-sm text-muted-foreground">اكتب اسم المستخدم، وهيوصل طلب للسوبر فايزر يعملك كلمة مرور مؤقتة.</p>
              <div className="space-y-2">
                <Label>اسم المستخدم</Label>
                <Input dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                إرسال الطلب
              </Button>
            </form>
          )}
        </TabsContent>

        <TabsContent value="sup" className="pt-3">
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (pw !== pw2) {
                toast.error("كلمتا المرور غير متطابقتين");
                return;
              }
              setBusy(true);
              try {
                await recoverSupervisor({ data: { username, recoveryKey: key, password: pw } });
                toast.success("تم تغيير كلمة المرور، سجّل دخولك دلوقتي");
                onBack();
              } catch (err) {
                toast.error((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="text-sm text-muted-foreground">استخدم مفتاح الاسترداد السري الخاص بالسوبر فايزر.</p>
            <div className="space-y-2">
              <Label>اسم المستخدم</Label>
              <Input dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>مفتاح الاسترداد</Label>
              <Input dir="ltr" type="password" value={key} onChange={(e) => setKey(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>كلمة المرور الجديدة</Label>
              <Input dir="ltr" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>تأكيد كلمة المرور</Label>
              <Input dir="ltr" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "جاري..." : "تغيير كلمة المرور"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
