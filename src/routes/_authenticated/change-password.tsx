import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { markPasswordChanged } from "@/lib/mail.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/change-password")({
  head: () => ({ meta: [{ title: "تغيير كلمة المرور | بريد بستطهالك" }] }),
  component: ChangePassword,
});

function ChangePassword() {
  const { me } = Route.useRouteContext();
  const router = useRouter();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 6) { toast.error("كلمة المرور 6 أحرف على الأقل"); return; }
    if (next !== confirm) { toast.error("كلمتا المرور غير متطابقتين"); return; }
    if (next === current) { toast.error("اختار كلمة مرور جديدة مختلفة"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({
      password: next,
      current_password: current,
    } as Parameters<typeof supabase.auth.updateUser>[0]);
    if (error) {
      setBusy(false);
      toast.error("كلمة المرور الحالية غير صحيحة");
      return;
    }
    await markPasswordChanged();
    toast.success("تم تغيير كلمة المرور");
    await router.invalidate();
    navigate({ to: "/inbox" });
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border bg-card p-8 shadow-soft">
      <span className="grid size-12 place-items-center rounded-xl bg-accent text-accent-foreground">
        <KeyRound className="size-5" />
      </span>
      <h1 className="mt-4 text-2xl text-primary">تغيير كلمة المرور</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {me.mustChange
          ? "إنت داخل بكلمة مرور مؤقتة. لازم تغيرها قبل ما تكمل."
          : "اكتب كلمة المرور الحالية والجديدة."}
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label>كلمة المرور الحالية</Label>
          <Input type="password" dir="ltr" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>كلمة المرور الجديدة</Label>
          <Input type="password" dir="ltr" value={next} onChange={(e) => setNext(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>تأكيد كلمة المرور</Label>
          <Input type="password" dir="ltr" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "جاري..." : "حفظ"}
        </Button>
      </form>
    </div>
  );
}
