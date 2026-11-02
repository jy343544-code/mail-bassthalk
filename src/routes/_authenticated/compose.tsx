import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Send, Upload, UserCheck } from "lucide-react";
import { sendMessage } from "@/lib/mail.functions";
import { fetchPeople } from "@/lib/queries";
import { roleLabel } from "@/lib/identity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/compose")({
  head: () => ({ meta: [{ title: "رسالة جديدة | بريد بستطهالك" }] }),
  component: Compose,
});

const toBase64 = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(f);
  });

function Compose() {
  const { me } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const people = useQuery({ queryKey: ["people"], queryFn: fetchPeople });
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [to, setTo] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // إظهار جميع المستخدمين المسجلين ما عدا المستخدم الحالي
  const others = (people.data ?? []).filter((p) => p.id !== me.id);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (to.length === 0) {
      toast.error("يرجى اختيار مستلم واحد على الأقل");
      return;
    }

    setBusy(true);
    try {
      const res = await sendMessage({
        data: {
          subject,
          body,
          recipientIds: to,
          sheetUrl: sheetUrl.trim() || undefined,
          file: file ? { name: file.name, base64: await toBase64(file) } : undefined,
        },
      });
      toast.success("تم إرسال الرسالة بنجاح");
      qc.invalidateQueries({ queryKey: ["messages"] });
      navigate({ to: "/inbox/$id", params: { id: res.id }, search: { f: "sent" } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 md:p-6">
      <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6 rounded-md border bg-card p-4 shadow-soft md:p-8">
        <h1 className="text-xl font-bold md:text-2xl">رسالة جديدة</h1>

        {/* اختيار المستلمين */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">إلى (المستلمون):</Label>
            {to.length > 0 && (
              <span className="text-xs text-primary font-medium">تم تحديد {to.length}</span>
            )}
          </div>
          <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto p-1">
            {others.map((p) => {
              const on = to.includes(p.id);
              return (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                    on ? "border-primary bg-primary/10 font-medium" : "bg-background hover:bg-muted"
                  }`}
                >
                  <Checkbox
                    checked={on}
                    onCheckedChange={(v) =>
                      setTo((s) => (v ? [...s, p.id] : s.filter((x) => x !== p.id)))
                    }
                  />
                  <span>{p.full_name}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {p.role ? roleLabel[p.role] : `@${p.username}`}
                  </span>
                </label>
              );
            })}
            {others.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {people.isLoading ? "جاري تحميل قائمة المستخدمين..." : "لا يوجد مستخدمون مسجلون آخرون."}
              </p>
            )}
          </div>
        </div>

        {/* عنوان الرسالة */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">عنوان الرسالة</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="اكتب عنوان أو موضوع الرسالة..."
            required
          />
        </div>

        {/* نص الرسالة */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">نص الرسالة</Label>
          <Textarea
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="اكتب تفاصيل الرسالة أو الاستفسار هنا..."
          />
        </div>

        {/* المرفقات (اختيارية) */}
        <div className="rounded-md border border-dashed p-4 space-y-4 bg-muted/20">
          <span className="text-xs font-semibold text-muted-foreground block">
            المرفقات (اختياري - يمكنك الإرسال بدون شيت):
          </span>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs">ملف إكسل (Excel / CSV)</Label>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed bg-background p-3 text-sm hover:bg-muted">
                <Upload className="size-4 text-primary shrink-0" />
                <span className="truncate text-xs">{file ? file.name : "اختار ملف إكسل"}</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.ods"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {file && (
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-xs text-destructive hover:underline"
                >
                  إلغاء الملف
                </button>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs">أو رابط جوجل شيت</Label>
              <Input
                dir="ltr"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
        </div>

        <Button type="submit" size="lg" className="w-full gap-2 md:w-auto" disabled={busy}>
          <Send className="size-4" /> {busy ? "جاري الإرسال..." : "إرسال الرسالة"}
        </Button>
      </form>
    </div>
  );
                }
      
