import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PhoneCall, RefreshCw, Save, Settings2, UserRound, Phone, FileSpreadsheet } from "lucide-react";
import {
  deactivateCallFollowupStatus,
  getCallFollowupSheetPreview,
  getCallFollowupWorkspace,
  saveCallFollowupLog,
  saveCallFollowupStatus,
  syncCallFollowupContacts,
} from "@/lib/call-followup.functions";

export const Route = createFileRoute("/_authenticated/call-follow-up")({
  head: () => ({ meta: [{ title: "متابعة المكالمات | بستطهالك" }] }),
  component: CallFollowupPage,
});

type Contact = { id: string; message_id: string; source_sheet: string; source_row: number; phone_index: number; full_name: string; phone: string };
type Status = { id: string; label: string; is_active: boolean; sort_order: number };
type Log = { id: string; contact_id: string; status_id: string; note: string; created_at: string; employeeName: string; statusLabel: string; contact: Contact | null };

function CallFollowupPage() {
  const qc = useQueryClient();
  const workspace = useQuery({ queryKey: ["call-followup-workspace"], queryFn: () => getCallFollowupWorkspace() });
  const [messageId, setMessageId] = useState("");
  const [phoneColumn, setPhoneColumn] = useState("-1");
  const [nameColumn, setNameColumn] = useState("-1");
  const [selectedId, setSelectedId] = useState("");
  const [statusId, setStatusId] = useState("");
  const [note, setNote] = useState("");
  const [statusLabel, setStatusLabel] = useState("");
  const [editingStatus, setEditingStatus] = useState<Status | null>(null);
  const [filter, setFilter] = useState("");

  const preview = useQuery({
    queryKey: ["call-followup-preview", messageId],
    queryFn: () => getCallFollowupSheetPreview({ data: { messageId } }),
    enabled: !!messageId,
  });
  const data = workspace.data;
  const contacts = (data?.contacts ?? []) as Contact[];
  const logs = (data?.logs ?? []) as Log[];
  const statuses = (data?.statuses ?? []) as Status[];
  const selected = contacts.find((c) => c.id === selectedId);
  const latestByContact = useMemo(() => {
    const map = new Map<string, Log>();
    for (const log of logs) if (!map.has(log.contact_id)) map.set(log.contact_id, log);
    return map;
  }, [logs]);
  const visibleContacts = contacts.filter((c) => c.message_id === messageId && (
    !filter || c.full_name.toLowerCase().includes(filter.toLowerCase()) || c.phone.includes(filter)
  ));

  const refresh = () => qc.invalidateQueries({ queryKey: ["call-followup-workspace"] });
  const sync = useMutation({
    mutationFn: () => syncCallFollowupContacts({ data: {
      messageId, phoneColumn: Number(phoneColumn), nameColumn: nameColumn === "60" ? -1 : Number(nameColumn),
    }}),
    onSuccess: (r) => { toast.success(`تم استيراد ${r.count} رقم من ${r.sheetsScanned} شيت`); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const saveLog = useMutation({
    mutationFn: () => saveCallFollowupLog({ data: { contactId: selectedId, statusId, note } }),
    onSuccess: () => { toast.success("تم حفظ نتيجة المكالمة"); setNote(""); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const saveStatus = useMutation({
    mutationFn: () => saveCallFollowupStatus({ data: {
      ...(editingStatus ? { id: editingStatus.id } : {}),
      label: statusLabel, sortOrder: editingStatus?.sort_order ?? statuses.length + 1,
    }}),
    onSuccess: () => { toast.success("تم حفظ الحالة"); setStatusLabel(""); setEditingStatus(null); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const deactivate = useMutation({
    mutationFn: (id: string) => deactivateCallFollowupStatus({ data: { id } }),
    onSuccess: () => { toast.success("تم تعطيل الحالة"); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });

  if (workspace.isLoading) return <div className="p-8 text-muted-foreground">جاري تحميل متابعة المكالمات...</div>;
  if (workspace.error) return <div className="p-8 text-destructive">{(workspace.error as Error).message}</div>;

  return (
    <div dir="rtl" className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold"><PhoneCall className="size-6 text-primary" /> متابعة المكالمات</h1>
          <p className="mt-1 text-sm text-muted-foreground">استيراد الأرقام من الشيت وتسجيل نتيجة كل مكالمة وملاحظاتها.</p>
        </div>
        <button onClick={refresh} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-accent"><RefreshCw className="size-4" /> تحديث</button>
      </div>

      <section className="rounded-2xl border bg-card p-4 shadow-sm space-y-4">
        <h2 className="font-bold flex items-center gap-2"><FileSpreadsheet className="size-5 text-primary" /> 1. اختيار ملف الأرقام</h2>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <select value={messageId} onChange={(e) => { setMessageId(e.target.value); setSelectedId(""); }} className="h-11 rounded-xl border bg-background px-3">
            <option value="">اختر شيت Excel مرفق برسالة</option>
            {data?.messages.map((m: any) => <option key={m.id} value={m.id}>{m.subject} {m.fileName ? `— ${m.fileName}` : ""}</option>)}
          </select>
          <button disabled={!messageId || preview.isLoading} onClick={() => preview.refetch()} className="rounded-xl border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50">معاينة الأعمدة</button>
        </div>
        {preview.error && <p className="text-sm text-destructive">{(preview.error as Error).message}</p>}
        {preview.data && (
          <div className="grid gap-3 rounded-xl bg-muted/40 p-3 md:grid-cols-3">
            <label className="space-y-1 text-sm"><span className="font-semibold">مصدر أرقام الهاتف</span><select value={phoneColumn} onChange={(e) => setPhoneColumn(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-2"><option value="-1">اكتشاف تلقائي — كل الأعمدة</option>{preview.data.headers.map((h: string, i: number) => <option key={i} value={i}>{h || `عمود ${i + 1}`}</option>)}</select></label>
            <label className="space-y-1 text-sm"><span className="font-semibold">عمود الاسم</span><select value={nameColumn} onChange={(e) => setNameColumn(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-2"><option value="-1">اكتشاف تلقائي من عنوان العمود</option><option value="60">بدون اسم</option>{preview.data.headers.map((h: string, i: number) => <option key={i} value={i}>{h || `عمود ${i + 1}`}</option>)}</select></label>
            <div className="flex items-end"><button disabled={sync.isPending} onClick={() => sync.mutate()} className="h-10 w-full rounded-lg bg-primary px-4 font-bold text-primary-foreground disabled:opacity-50">{sync.isPending ? "جارٍ الاستيراد..." : `استيراد نحو ${preview.data.estimatedPhones} رقم`}</button></div>
            <p className="text-xs text-muted-foreground md:col-span-3">يتم فحص كل أوراق Excel تلقائيًا واستخراج كل أرقام الهاتف من الخلايا، مع إزالة التكرار داخل الصف. يمكنك تحديد عمود يدويًا عند الحاجة. الملف يُقرأ على الخادم.</p>
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2"><h2 className="font-bold">2. قائمة الأرقام</h2><span className="text-xs text-muted-foreground">{visibleContacts.length} رقم</span></div>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="ابحث بالاسم أو رقم الهاتف..." className="h-10 w-full rounded-xl border bg-background px-3 text-sm" />
          {!messageId ? <p className="py-8 text-center text-sm text-muted-foreground">اختر ملفًا ثم استورد الأرقام لبدء المتابعة.</p> : visibleContacts.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">لا توجد أرقام مستوردة لهذا الشيت بعد.</p> : (
            <div className="max-h-[560px] space-y-2 overflow-auto">
              {visibleContacts.map((c) => {
                const last = latestByContact.get(c.id);
                return <button key={c.id} onClick={() => { setSelectedId(c.id); setStatusId(""); setNote(""); }} className={`w-full rounded-xl border p-3 text-right transition hover:bg-accent ${selectedId === c.id ? "border-primary bg-primary/5" : ""}`}>
                  <div className="flex items-center justify-between gap-2"><span className="font-bold">{c.full_name || "بدون اسم"}</span><span className="text-xs text-muted-foreground">{c.source_sheet || "الشيت"} · صف {c.source_row}</span></div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span dir="ltr" className="font-mono text-sm">{c.phone}</span><span className="text-xs text-muted-foreground">{last ? last.statusLabel : "لم تتم المتابعة"}</span></div>
                </button>;
              })}
            </div>
          )}
        </section>

        <section className="space-y-5">
          <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-4">
            <h2 className="font-bold">3. تسجيل نتيجة المكالمة</h2>
            {!selected ? <p className="py-8 text-center text-sm text-muted-foreground">اختار رقمًا من القائمة لبدء تسجيل المكالمة.</p> : <>
              <div className="rounded-xl bg-muted/40 p-3"><div className="font-bold">{selected.full_name || "بدون اسم"}</div><div dir="ltr" className="mt-1 font-mono text-sm">{selected.phone}</div><a href={`tel:${selected.phone}`} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><Phone className="size-4" /> اتصال</a><p className="mt-2 text-xs text-muted-foreground">بعد انتهاء المكالمة، ارجع واختر النتيجة يدويًا؛ الهاتف لا يرسل حالة الرد تلقائيًا.</p></div>
              <label className="block space-y-1 text-sm"><span className="font-semibold">نتيجة المكالمة</span><select value={statusId} onChange={(e) => setStatusId(e.target.value)} className="h-11 w-full rounded-xl border bg-background px-3"><option value="">اختر الحالة</option>{statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
              <label className="block space-y-1 text-sm"><span className="font-semibold">ملاحظة / تعليق</span><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} placeholder="اكتب ملخص المكالمة أو موعد إعادة الاتصال..." className="w-full rounded-xl border bg-background p-3" /></label>
              <button disabled={!statusId || saveLog.isPending} onClick={() => saveLog.mutate()} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50"><Save className="size-4" /> {saveLog.isPending ? "جارٍ الحفظ..." : "حفظ نتيجة المكالمة"}</button>
            </>}
          </div>

          {data?.isStaff && <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
            <h2 className="flex items-center gap-2 font-bold"><Settings2 className="size-5" /> إدارة حالات الاتصال</h2>
            <div className="flex gap-2"><input value={statusLabel} onChange={(e) => setStatusLabel(e.target.value)} placeholder={editingStatus ? "تعديل اسم الحالة" : "اسم حالة جديدة"} className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm" /><button disabled={statusLabel.trim().length < 2 || saveStatus.isPending} onClick={() => saveStatus.mutate()} className="rounded-lg bg-primary px-3 text-sm font-bold text-primary-foreground">حفظ</button></div>
            {editingStatus && <button onClick={() => { setEditingStatus(null); setStatusLabel(""); }} className="text-xs text-muted-foreground underline">إلغاء التعديل</button>}
            <div className="space-y-2">{statuses.map((s) => <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm"><span>{s.label}</span><div className="flex gap-2"><button onClick={() => { setEditingStatus(s); setStatusLabel(s.label); }} className="text-primary underline">تعديل</button><button onClick={() => deactivate.mutate(s.id)} className="text-destructive underline">تعطيل</button></div></div>)}</div>
            <p className="text-xs text-muted-foreground">إدارة الحالات متاحة للمدير والسوبر فايزر فقط. تعطيل الحالة يحافظ على سجلات المكالمات القديمة.</p>
          </div>}
        </section>
      </div>

      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 font-bold"><UserRound className="size-5" /> سجل المتابعة</h2>
        {logs.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد سجلات متابعة حتى الآن.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="border-b text-right text-muted-foreground"><th className="p-2">الاسم / الرقم</th><th className="p-2">النتيجة</th><th className="p-2">الموظف</th><th className="p-2">الملاحظة</th><th className="p-2">التاريخ</th></tr></thead><tbody>{logs.slice(0, 100).map((l) => <tr key={l.id} className="border-b last:border-0"><td className="p-2">{l.contact?.full_name || "—"}<div dir="ltr" className="text-xs text-muted-foreground">{l.contact?.phone}</div></td><td className="p-2">{l.statusLabel}</td><td className="p-2">{l.employeeName}</td><td className="max-w-56 truncate p-2">{l.note || "—"}</td><td className="p-2 whitespace-nowrap">{new Date(l.created_at).toLocaleString("ar-EG")}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}
