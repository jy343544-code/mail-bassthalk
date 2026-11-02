
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Send,
  Upload,
  UserCheck,
  Users,
  Search,
  X,
  FileSpreadsheet,
  Link2,
  MessageSquare,
  AtSign,
} from "lucide-react";
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

  const people = useQuery({
    queryKey: ["people"],
    queryFn: fetchPeople,
  });

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [to, setTo] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const others = useMemo(
    () => (people.data ?? []).filter((p) => p.id !== me.id),
    [people.data, me.id]
  );

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return others;

    return others.filter(
      (p) =>
        p.full_name?.toLowerCase().includes(q) ||
        p.username?.toLowerCase().includes(q)
    );
  }, [others, search]);

  const allSelected =
    filteredPeople.length > 0 &&
    filteredPeople.every((p) => to.includes(p.id));

  function togglePerson(id: string, checked: boolean) {
    setTo((current) =>
      checked
        ? current.includes(id)
          ? current
          : [...current, id]
        : current.filter((x) => x !== id)
    );
  }

  function toggleAll() {
    const visibleIds = filteredPeople.map((p) => p.id);

    if (allSelected) {
      setTo((current) => current.filter((id) => !visibleIds.includes(id)));
    } else {
      setTo((current) => [...new Set([...current, ...visibleIds])]);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (to.length === 0) {
      toast.error("يرجى اختيار مستلم واحد على الأقل");
      return;
    }

    if (!subject.trim()) {
      toast.error("يرجى كتابة عنوان الرسالة");
      return;
    }

    setBusy(true);

    try {
      const res = await sendMessage({
        data: {
          subject: subject.trim(),
          body,
          recipientIds: to,
          sheetUrl: sheetUrl.trim() || undefined,
          file: file
            ? {
                name: file.name,
                base64: await toBase64(file),
              }
            : undefined,
        },
      });

      toast.success("تم إرسال الرسالة بنجاح");
      qc.invalidateQueries({ queryKey: ["messages"] });

      navigate({
        to: "/inbox/$id",
        params: { id: res.id },
        search: { f: "sent" },
      });
    } catch (err) {
      toast.error((err as Error).message || "تعذر إرسال الرسالة");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-background p-3 md:p-6">
      <form
        onSubmit={submit}
        className="mx-auto max-w-4xl space-y-6 rounded-2xl border bg-card p-4 shadow-sm md:p-7"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b pb-5">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <MessageSquare className="size-6" />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold md:text-2xl">رسالة جديدة</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              أنشئ رسالة وأرسلها إلى أعضاء فريق العمل
            </p>
          </div>
        </div>

        {/* Recipients */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4 text-primary" />
              المستلمون
            </Label>

            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              تم تحديد {to.length} مستلم
            </span>
          </div>

          <div className="rounded-xl border bg-background p-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث باسم الموظف أو اسم المستخدم..."
                className="pr-9"
              />
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-b pb-3">
              <span className="text-xs text-muted-foreground">
                {filteredPeople.length} مستخدم ظاهر
              </span>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-2 text-xs"
                onClick={toggleAll}
                disabled={filteredPeople.length === 0}
              >
                <UserCheck className="size-4" />
                {allSelected ? "إلغاء تحديد الظاهر" : "تحديد كل الظاهر"}
              </Button>
            </div>

            <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
              {people.isLoading && (
                <p className="col-span-full py-5 text-center text-sm text-muted-foreground">
                  جاري تحميل قائمة الموظفين...
                </p>
              )}

              {people.isError && (
                <div className="col-span-full py-5 text-center">
                  <p className="text-sm text-destructive">
                    تعذر تحميل المستخدمين.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => people.refetch()}
                  >
                    إعادة المحاولة
                  </Button>
                </div>
              )}

              {!people.isLoading &&
                !people.isError &&
                filteredPeople.map((p) => {
                  const selected = to.includes(p.id);

                  return (
                    <label
                      key={p.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                        selected
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/60"
                      }`}
                    >
                      <Checkbox
                        checked={selected}
                        onCheckedChange={(value) =>
                          togglePerson(p.id, value === true)
                        }
                      />

                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-sm font-bold">
                        {p.full_name?.trim()?.[0] ?? "؟"}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {p.full_name}
                        </span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {p.role
                            ? roleLabel[p.role]
                            : `@${p.username ?? ""}`}
                        </span>
                      </span>
                    </label>
                  );
                })}

              {!people.isLoading &&
                !people.isError &&
                filteredPeople.length === 0 && (
                  <p className="col-span-full py-5 text-center text-sm text-muted-foreground">
                    لا توجد نتائج مطابقة للبحث.
                  </p>
                )}
            </div>
          </div>
        </section>

        {/* Subject */}
        <section className="space-y-2">
          <Label className="text-sm font-semibold">عنوان الرسالة</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="اكتب عنوان الرسالة..."
            maxLength={200}
            required
          />
        </section>

        {/* Body */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">محتوى الرسالة</Label>
            <span className="text-xs text-muted-foreground">
              {body.length} حرف
            </span>
          </div>

          <Textarea
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="اكتب تفاصيل رسالتك هنا..."
            className="min-h-40 resize-y leading-7"
          />
        </section>

        {/* Attachments */}
        <section className="space-y-4 rounded-xl border border-dashed bg-muted/20 p-4">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <FileSpreadsheet className="size-4 text-primary" />
              المرفقات
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              يمكنك إرفاق ملف Excel أو CSV أو إضافة رابط Google Sheets.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* File */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">ملف Excel / CSV</Label>

              <label className="flex min-h-20 cursor-pointer items-center gap-3 rounded-xl border border-dashed bg-background p-3 transition-colors hover:border-primary hover:bg-primary/5">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Upload className="size-5" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {file ? file.name : "اختيار ملف"}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {file
                      ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                      : "XLSX · XLS · CSV · ODS"}
                  </span>
                </span>

                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.ods"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>

              {file && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-2 text-xs text-destructive"
                  onClick={() => setFile(null)}
                >
                  <X className="size-3" />
                  إزالة الملف
                </Button>
              )}
            </div>

            {/* Google Sheet */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">رابط Google Sheets</Label>

              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  dir="ltr"
                  placeholder="https://docs.google.com/..."
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              <p className="text-xs text-muted-foreground">
                تأكد من أن إعدادات مشاركة الشيت تسمح للمستلمين بفتحه.
              </p>
            </div>
          </div>
        </section>

        {/* Send */}
        <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            الرسالة ستُرسل إلى {to.length} مستلم.
          </p>

          <Button
            type="submit"
            size="lg"
            className="gap-2 sm:min-w-44"
            disabled={busy || people.isLoading || people.isError}
          >
            <Send className="size-4" />
            {busy ? "جاري الإرسال..." : "إرسال الرسالة"}
          </Button>
        </div>
      </form>
    </div>
  );
}
