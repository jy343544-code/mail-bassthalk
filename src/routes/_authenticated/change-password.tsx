
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  LockKeyhole,
  CheckCircle2,
} from "lucide-react";
import { completePasswordChange } from "@/lib/mail.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/change-password")({
  head: () => ({ meta: [{ title: "تغيير كلمة المرور | بريد بستطهالك" }] }),
  component: ChangePassword,
});

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  autoComplete: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          type={visible ? "text" : "password"}
          dir="ltr"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="pl-11"
          required
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
        >
          {visible ? (
            <EyeOff className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}

function ChangePassword() {
  const { me } = Route.useRouteContext();
  const router = useRouter();
  const navigate = useNavigate();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const validLength = next.length > 0 && next.length <= 72;
  const matches = next.length > 0 && next === confirm;
  const different = next.length > 0 && next !== current;

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (!next.length || next.length > 72) {
      toast.error("اكتب كلمة المرور بحد أقصى 72 حرفًا");
      return;
    }

    if (next !== confirm) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }

    if (next === current) {
      toast.error("اختار كلمة مرور جديدة مختلفة عن الحالية");
      return;
    }

    setBusy(true);

    try {
      await completePasswordChange({ data: { currentPassword: current, newPassword: next } });

      toast.success("تم تغيير كلمة المرور بنجاح");

      await router.invalidate();
      navigate({ to: "/inbox" });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء تغيير كلمة المرور"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-start justify-center bg-background p-3 pt-6 md:p-8">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="bg-primary/5 p-6 md:p-8">
          <div className="mb-5 grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <KeyRound className="size-7" />
          </div>

          <h1 className="text-2xl font-bold">تغيير كلمة المرور</h1>

          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {me.mustChange
              ? "أنت تستخدم كلمة مرور مؤقتة. يجب تغييرها قبل متابعة استخدام النظام."
              : "حدّث كلمة المرور الخاصة بحسابك للحفاظ على أمانه."}
          </p>

          {me.mustChange && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-primary/20 bg-background p-3 text-sm">
              <ShieldCheck className="size-5 shrink-0 text-primary" />
              <span>تغيير كلمة المرور مطلوب لاستكمال الدخول.</span>
            </div>
          )}
        </div>

        <form onSubmit={submit} className="space-y-5 p-5 md:p-8">
          <PasswordField
            label="كلمة المرور الحالية"
            value={current}
            onChange={setCurrent}
            visible={showCurrent}
            onToggle={() => setShowCurrent((v) => !v)}
            autoComplete="current-password"
          />

          <PasswordField
            label="كلمة المرور الجديدة"
            value={next}
            onChange={setNext}
            visible={showNext}
            onToggle={() => setShowNext((v) => !v)}
            autoComplete="new-password"
          />

          <div className="space-y-2">
            <div className="flex flex-wrap gap-3 text-xs">
              <span
                className={
                  validLength
                    ? "flex items-center gap-1 text-emerald-600"
                    : "flex items-center gap-1 text-muted-foreground"
                }
              >
                <CheckCircle2 className="size-3.5" />
                كلمة المرور مكتوبة
              </span>

              <span
                className={
                  different
                    ? "flex items-center gap-1 text-emerald-600"
                    : "flex items-center gap-1 text-muted-foreground"
                }
              >
                <CheckCircle2 className="size-3.5" />
                مختلفة عن القديمة
              </span>
            </div>
          </div>

          <PasswordField
            label="تأكيد كلمة المرور الجديدة"
            value={confirm}
            onChange={setConfirm}
            visible={showConfirm}
            onToggle={() => setShowConfirm((v) => !v)}
            autoComplete="new-password"
          />

          {confirm.length > 0 && (
            <p
              className={`text-xs ${
                matches ? "text-emerald-600" : "text-destructive"
              }`}
            >
              {matches
                ? "كلمتا المرور متطابقتان"
                : "كلمتا المرور غير متطابقتين"}
            </p>
          )}

          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex items-start gap-2 text-xs leading-6 text-muted-foreground">
              <LockKeyhole className="mt-1 size-4 shrink-0" />
              <p>
                لا تشارك كلمة المرور الجديدة مع أي شخص، واستخدم كلمة مرور
                مختلفة عن كلمات المرور التي تستخدمها في مواقع أخرى.
              </p>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full gap-2"
            size="lg"
            disabled={busy}
          >
            <KeyRound className="size-4" />
            {busy ? "جاري تغيير كلمة المرور..." : "حفظ كلمة المرور الجديدة"}
          </Button>
        </form>
      </div>
    </div>
  );
}
