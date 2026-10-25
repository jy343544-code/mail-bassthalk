import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Send, Upload } from "lucide-react";
import { sendMessage } from "@/lib/mail.functions";
import { fetchPeople } from "@/lib/queries";
import { isStaff } from "@/lib/me";
import { roleLabel } from "@/lib/identity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/compose")({
  head: () => ({ meta: [{ title: "رسالة جديدة | بريد بستطهالك" }] }),
  beforeLoad: ({ context }) => {
    if (!isStaff(context.me.role)) throw redirect({ to: "/inbox" });
  },
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

  const others = (people.data ?? []).filter((p) => p.id !== me.id && p.role);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await sendMessage({
        data: {
          subject,
          body,
          recipientIds: to,
          sheetUrl: sheetUrl || undefined,
          file: file ? { name: file.name, base64: await toBase64(file) } : undefined,
        },
      });
      toast.success("تم الإرسال");
      qc.invalidateQueries({ queryKey: ["messages"] });
      navigate({ to: "/inbox/$id", params: { id: res.id }, search: { f: "sent" } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 md:p-6"><form onSubmit={submit} className="mx-auto max-w-3xl space-y-6 rounded-md border bg-card p-6 shadow-soft md:p-8">
      <h1 className="text-2xl">رسالة جديدة</h1>

      <div className="space-y-2">
        <Label>إلى</Label>
        <div className="flex flex-wrap gap-2">
          {others.map((p) => {
            const on = to.includes(p.id);
            return (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${on ? "border-primary bg-secondary" : ""}`}
              >
                <Checkbox
                  checked={on}
                  onCheckedChange={(v) => setTo((s) => (v ? [...s, p.id] : s.filter((x) => x !== p.id)))}
                />
                {p.full_name}
                <span className="text-xs text-muted-foreground">{p.role && roleLabel[p.role]}</span>
              </label>
            );
          })}
          {others.length === 0 && <p className="text-sm text-muted-foreground">لا يوجد حسابات بعد.</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label>العنوان</Label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>نص الرسالة</Label>
        <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>شيت إكسل</Label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4 text-sm hover:bg-muted">
            <Upload className="size-5 text-primary" />
            <span className="truncate">{file ? file.name : "اختار ملف xlsx / xls / csv"}</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.ods"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <div className="space-y-2">
          <Label>أو رابط جوجل شيت</Label>
          <Input
            dir="ltr"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">خلي الشيت "عرض فقط" في جوجل.</p>
        </div>
      </div>

      <Button type="submit" size="lg" className="gap-2" disabled={busy}>
        <Send className="size-4" /> {busy ? "جاري الإرسال..." : "إرسال"}
      </Button>
    </form></div>
  );
}
