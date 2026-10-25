import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSetupStatus, setupSupervisor } from "@/lib/mail.functions";
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

function AuthPage() {
  const navigate = useNavigate();
  const status = useQuery({ queryKey: ["setup"], queryFn: () => getSetupStatus() });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const needsSetup = status.data?.needsSetup;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (needsSetup) {
        await setupSupervisor({ data: { fullName, username, password } });
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(username),
        password,
      });
      if (error) throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
      navigate({ to: "/inbox" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3 text-xl font-display">
          <span className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
            <Mail className="size-5" />
          </span>
          بستطهالك
        </div>
        <div>
          <h1 className="text-5xl leading-tight">بريد الشركة الداخلي</h1>
          <p className="mt-4 max-w-md text-lg opacity-80">
            الشيتات بتتفتح جوه المتصفح بس، من غير تنزيل، وكل صلاحية في مكانها.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm opacity-70">
          <ShieldCheck className="size-4" /> محمي ومراقب
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="text-3xl text-primary">{needsSetup ? "إعداد السوبر فايزر" : "تسجيل الدخول"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {needsSetup
                ? "أول حساب في النظام هيكون حساب السوبر فايزر."
                : "استخدم اسم المستخدم وكلمة المرور اللي وصلتك."}
            </p>
          </div>
          {needsSetup && (
            <div className="space-y-2">
              <Label htmlFor="fn">الاسم بالكامل</Label>
              <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="un">اسم المستخدم</Label>
            <Input
              id="un"
              dir="ltr"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw">كلمة المرور</Label>
            <Input
              id="pw"
              type="password"
              dir="ltr"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={busy || status.isLoading}>
            {busy ? "جاري..." : needsSetup ? "إنشاء والدخول" : "دخول"}
          </Button>
        </form>
      </div>
    </div>
  );
}
