import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PhoneCall, RefreshCw, Save, Settings2, UserRound, Phone, FileSpreadsheet, CheckCircle2, Clock3, ListFilter } from "lucide-react";
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
  const [queue, setQueue] = useState<"pending" | "answered" | "not_answered" | "all">("pending");

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
  const messageContacts = contacts.filter((c) => c.message_id === messageId);
  const contactedCount = messageContacts.filter((c) => latestByContact.has(c.id)).length;
  const pendingCount = messageContacts.filter((c) => !latestByContact.has(c.id)).length;
  const answeredCount = messageContacts.filter((c) => latestByContact.get(c.id)?.statusLabel?.trim() === "تم الرد").length;
  const notAnsweredCount = contactedCount - answeredCount;
  const visibleContacts = messageContacts.filter((c) => {
    const last = latestByContact.get(c.id);
    const matchesQueue = queue === "all" || (queue === "pending" && !last) ||
      (queue === "answered" && last?.statusLabel?.trim() === "تم الرد") ||
      (queue === "not_answered" && !!last && last.statusLabel?.trim() !== "تم الرد");
    const matchesSearch = !filter || c.full_name.toLowerCase().includes(filter.toLowerCase()) || c.phone.includes(filter);
    return matchesQueue && matchesSearch;
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["call-followup-workspace"] });
  const sync = useMutation({
    mutationFn: () => syncCallFollowupContacts({ data: {
      messageId, phoneColumn: Number(phoneColumn), nameColumn: Number(nameColumn),
    }}),
    onSuccess: (r) => { toast.success(`تم استيراد ${r.count} رقم (${r.uniquePhones} رقم فريد) من ${r.sheetsScanned} شيت`); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const saveLog = useMutation({
    mutationFn: () => saveCallFollowupLog({ data: { contactId: selectedId, statusId, note } }),
    onSuccess: () => { toast.success("تم حفظ الوسم والتعليق ونقل الرقم إلى سجل المتابعة"); setNote(""); setStatusId(""); setSelectedId(""); setQueue("pending"); refresh(); },
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
          <div className="space-y-2 rounded-xl border bg-background p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold">ملخص قراءة الملف</span>
              <span className="text-xs text-muted-foreground">{preview.data.totalRows} صف · {preview.data.sheets.length} ورقة · نحو {preview.data.estimatedPhones} رقم</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {preview.data.sheets.map((sheet: any) => (
                <div key={sheet.name} className="rounded-lg bg-muted/50 p-3 text-xs">
                  <div className="font-bold">{sheet.name}</div>
                  <div className="mt-1 text-muted-foreground">{sheet.totalRows} صف · {sheet.phoneColumns.length || "فحص تلقائي"} أعمدة هاتف · {sheet.estimatedPhones} رقم متوقع</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {preview.data?.sample?.length > 0 && (
          <div className="overflow-hidden rounded-xl border">
            <div className="border-b bg-muted/40 px-3 py-2 text-sm font-bold">معاينة الأسماء والأرقام التي سيتم عرضها بالموقع</div>
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background"><tr className="border-b text-right"><th className="p-2">الاسم</th><th className="p-2">رقم الهاتف</th><th className="p-2">صف الشيت</th></tr></thead>
                <tbody>{preview.data.sample.map((item: any, index: number) => (
                  <tr key={index} className="border-b last:border-0">
                    <td className="p-2">{item.fullName || "بدون اسم"}</td>
                    <td dir="ltr" className="p-2 text-right font-mono">{item.phone}</td>
                    <td className="p-2 text-muted-foreground">{item.row}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
        {preview.data && (
          <div className="grid gap-3 rounded-xl bg-muted/40 p-3 md:grid-cols-3">
            <label className="space-y-1 text-sm"><span className="font-semibold">مصدر أرقام الهاتف</span><select value={phoneColumn} onChange={(e) => setPhoneColumn(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-2"><option value="-1">تلقائي — كل أعمدة الهاتف المكتشفة</option>{preview.data.headers.map((h: string, i: number) => <option key={i} value={i}>{h || `عمود ${i + 1}`}</option>)}</select></label>
            <label className="space-y-1 text-sm"><span className="font-semibold">عمود الاسم</span><select value={nameColumn} onChange={(e) => setNameColumn(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-2"><option value="-1">اكتشاف تلقائي من عنوان العمود</option><option value="-2">بدون اسم</option>{preview.data.headers.map((h: string, i: number) => <option key={i} value={i}>{h || `عمود ${i + 1}`}</option>)}</select></label>
            <div className="flex items-end"><button disabled={sync.isPending} onClick={() => sync.mutate()} className="h-10 w-full rounded-lg bg-primary px-4 font-bold text-primary-foreground disabled:opacity-50">{sync.isPending ? "جارٍ الاستيراد..." : `استيراد نحو ${preview.data.estimatedPhones} رقم`}</button></div>
            <p className="text-xs text-muted-foreground md:col-span-3">يتم فحص كل أوراق Excel، وقراءة جميع أعمدة الهاتف المكتشفة في كل ورقة حتى لو اخترت عمودًا يدويًا إضافيًا. يتم ربط الرقم بالاسم تلقائيًا أو بأول خلية اسم واضحة في الصف. يدعم أرقام المحمول المصرية المكتوبة بالأرقام العربية أو الإنجليزية.</p>
          </div>
        )}
      </section>

      {messageId && (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "إجمالي جهات الاتصال", value: messageContacts.length },
            { label: "تم الرد", value: answeredCount },
            { label: "لم يتم الرد", value: notAnsweredCount },
            { label: "قيد المتابعة", value: pendingCount },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="mt-2 text-2xl font-extrabold tabular-nums">{item.value}</p>
            </div>
          ))}
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2"><h2 className="font-bold flex items-center gap-2"><ListFilter className="size-4" /> 2. قائمة المتابعة</h2><span className="text-xs text-muted-foreground">{visibleContacts.length} رقم</span></div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "pending", label: "لم تتم المتابعة", count: pendingCount },
              { id: "answered", label: "تم الرد", count: answeredCount },
              { id: "not_answered", label: "لم يتم الرد", count: notAnsweredCount },
              { id: "all", label: "كل الأرقام", count: messageContacts.length },
            ].map((item) => <button key={item.id} onClick={() => { setQueue(item.id as typeof queue); setSelectedId(""); }} className={`rounded-xl border p-2 text-right transition ${queue === item.id ? "border-primary bg-primary/10" : "hover:bg-accent"}`}>
              <span className="block text-xs text-muted-foreground">{item.label}</span><span className="mt-1 block text-lg font-extrabold tabular-nums">{item.count}</span>
            </button>)}
          </div>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="ابحث بالاسم أو رقم الهاتف..." className="h-10 w-full rounded-xl border bg-background px-3 text-sm" />
          {!messageId ? <p className="py-8 text-center text-sm text-muted-foreground">اختر ملفًا ثم استورد الأرقام لبدء المتابعة.</p> : visibleContacts.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{queue === "pending" ? "ممتاز! لا توجد أرقام متبقية في قائمة المتابعة." : "لا توجد أرقام في هذا التصنيف حاليًا."}</p> : (
            <div className="max-h-[560px] space-y-2 overflow-auto">
              {visibleContacts.map((c) => {
                const last = latestByContact.get(c.id);
                return <button key={c.id} onClick={() => { setSelectedId(c.id); setStatusId(""); setNote(""); }} className={`w-full rounded-xl border p-3 text-right transition hover:bg-accent ${selectedId === c.id ? "border-primary bg-primary/5" : ""}`}>
                  <div className="flex items-center justify-between gap-2"><span className="font-bold">{c.full_name || "بدون اسم"}</span><span className="text-xs text-muted-foreground">{c.source_sheet || "الشيت"} · صف {c.source_row}</span></div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span dir="ltr" className="font-mono text-sm">{c.phone}</span><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${!last ? "bg-muted text-muted-foreground" : last.statusLabel.trim() === "تم الرد" ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}>{!last ? <Clock3 className="size-3" /> : last.statusLabel.trim() === "تم الرد" ? <CheckCircle2 className="size-3" /> : <Clock3 className="size-3" />}{last ? last.statusLabel : "بانتظار الاتصال"}</span></div>
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
              <label className="block space-y-1 text-sm"><span className="font-semibold">التعليق (مطلوب لنقل الرقم من القائمة)</span><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} placeholder="اكتب نتيجة المكالمة أو سبب عدم الرد أو موعد إعادة الاتصال..." className="w-full rounded-xl border bg-background p-3" /></label>
              <button disabled={!statusId || !note.trim() || saveLog.isPending} onClick={() => saveLog.mutate()} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50"><Save className="size-4" /> {saveLog.isPending ? "جارٍ الحفظ..." : "حفظ الوسم والتعليق"}</button>
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
