import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mail, MailWarning, Send, Users } from "lucide-react";
import { getStats } from "@/lib/mail.functions";
import { isStaff } from "@/lib/me";
import { roleLabel, type AppRole } from "@/lib/identity";

export const Route = createFileRoute("/_authenticated/stats")({
  head: () => ({ meta: [{ title: "الإحصائيات | بريد بستطهالك" }] }),
  beforeLoad: ({ context }) => {
    if (!isStaff(context.me.role)) throw redirect({ to: "/inbox" });
  },
  component: Stats,
});

function Card({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: number }) {
  return (
    <div className="flex items-center gap-4 rounded-md border bg-card p-4 shadow-soft">
      <span className="grid size-11 place-items-center rounded-md bg-accent text-accent-foreground">
        <Icon className="size-5" />
      </span>
      <div>
        <div className="text-2xl font-semibold">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function Stats() {
  const q = useQuery({ queryKey: ["stats"], queryFn: () => getStats(), refetchInterval: 30000 });
  if (q.isLoading) return <p className="p-6 text-muted-foreground">جاري التحميل...</p>;
  if (q.error || !q.data) return <p className="p-6 text-destructive">{(q.error as Error)?.message}</p>;
  const s = q.data;
  const max = Math.max(1, ...s.days.map((d) => d.count));
  const people = Object.values(s.byRole).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="text-2xl">الإحصائيات</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card icon={Mail} label="إجمالي الرسائل" value={s.totalMessages} />
        <Card icon={Send} label="رسائل النهارده" value={s.today} />
        <Card icon={MailWarning} label="غير مقروءة" value={s.unread} />
        <Card icon={Users} label="الحسابات" value={people} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-md border bg-card p-4 shadow-soft lg:col-span-2">
          <h2 className="mb-4 text-base">الرسائل آخر 14 يوم</h2>
          <div className="flex h-44 items-end gap-1.5">
            {s.days.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{d.count || ""}</span>
                <div className="w-full rounded-t bg-primary" style={{ height: `${(d.count / max) * 140}px`, minHeight: 2 }} />
                <span className="text-[10px] text-muted-foreground">{Number(d.day.slice(8))}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-md border bg-card p-4 shadow-soft">
            <h2 className="mb-3 text-base">الحسابات حسب الصلاحية</h2>
            {(Object.keys(s.byRole) as AppRole[]).map((r) => (
              <div key={r} className="flex justify-between border-b py-2 text-sm last:border-0">
                <span>{roleLabel[r]}</span>
                <span className="font-semibold">{s.byRole[r]}</span>
              </div>
            ))}
          </div>
          <div className="rounded-md border bg-card p-4 shadow-soft">
            <h2 className="mb-3 text-base">الأكثر إرسالًا (14 يوم)</h2>
            {s.topSenders.length === 0 && <p className="text-sm text-muted-foreground">لا يوجد</p>}
            {s.topSenders.map((t) => (
              <div key={t.name} className="flex justify-between border-b py-2 text-sm last:border-0">
                <span>{t.name}</span>
                <span className="font-semibold">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">الإحصائيات أرقام فقط — محتوى الرسائل لا يظهر لأي حد غير المرسل والمستلمين.</p>
    </div>
  );
}
