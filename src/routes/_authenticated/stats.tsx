
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Mail,
  MailWarning,
  Send,
  Users,
  RefreshCw,
  TrendingUp,
  CalendarDays,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { getStats } from "@/lib/mail.functions";
import { isStaff } from "@/lib/me";
import { roleLabel, type AppRole } from "@/lib/identity";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/stats")({
  head: () => ({ meta: [{ title: "الإحصائيات | بريد بستطهالك" }] }),
  beforeLoad: ({ context }) => {
    if (!isStaff(context.me.role)) throw redirect({ to: "/inbox" });
  },
  component: Stats,
});

function StatCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: typeof Mail;
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/20 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-4 text-3xl font-bold tabular-nums">
        {value.toLocaleString("ar-EG")}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function Stats() {
  const q = useQuery({
    queryKey: ["stats"],
    queryFn: () => getStats(),
    refetchInterval: 30000,
  });

  if (q.isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 size-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <p className="text-sm text-muted-foreground">جاري تحميل الإحصائيات...</p>
        </div>
      </div>
    );
  }

  if (q.error || !q.data) {
    return (
      <div className="p-6 text-center">
        <Activity className="mx-auto mb-3 size-9 text-destructive" />
        <p className="text-sm text-destructive">
          {(q.error as Error)?.message || "تعذر تحميل الإحصائيات"}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 gap-2"
          onClick={() => q.refetch()}
        >
          <RefreshCw className="size-4" />
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  const s = q.data;
  const max = Math.max(1, ...s.days.map((d) => d.count));
  const people = Object.values(s.byRole).reduce((a, b) => a + b, 0);
  const readRate =
    s.totalMessages > 0
      ? Math.round(
          ((s.totalMessages - s.unread) / s.totalMessages) * 100
        )
      : 0;

  const roles = Object.keys(s.byRole) as AppRole[];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-3 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">لوحة الإحصائيات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            نظرة عامة على نشاط المراسلات وأداء النظام
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={q.isFetching}
          onClick={() => q.refetch()}
        >
          <RefreshCw className={`size-4 ${q.isFetching ? "animate-spin" : ""}`} />
          تحديث البيانات
        </Button>
      </div>

      {/* Main stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Mail}
          label="إجمالي الرسائل"
          value={s.totalMessages}
          description="إجمالي الرسائل المسجلة"
        />
        <StatCard
          icon={Send}
          label="رسائل اليوم"
          value={s.today}
          description="الرسائل المرسلة اليوم"
        />
        <StatCard
          icon={MailWarning}
          label="غير مقروءة"
          value={s.unread}
          description="رسائل لم يتم تسجيل قراءتها"
        />
        <StatCard
          icon={Users}
          label="الحسابات"
          value={people}
          description="إجمالي الحسابات حسب الصلاحية"
        />
      </div>

      {/* Chart and role distribution */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border bg-card p-4 shadow-sm lg:col-span-2 md:p-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">حركة الرسائل</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                عدد الرسائل خلال آخر 14 يومًا
              </p>
            </div>
            <Badge variant="secondary">
              <CalendarDays className="ml-1 size-3" />
              14 يوم
            </Badge>
          </div>

          <div className="flex h-48 items-end gap-1.5 sm:gap-3">
            {s.days.map((d) => {
              const height = Math.max(3, (d.count / max) * 145);

              return (
                <div
                  key={d.day}
                  className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2"
                  title={`${d.day}: ${d.count} رسالة`}
                >
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {d.count > 0 ? d.count : ""}
                  </span>
                  <div
                    className="w-full max-w-10 rounded-t-lg bg-primary transition-all duration-300 group-hover:opacity-75"
                    style={{ height: `${height}px` }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {Number(d.day.slice(8))}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-primary" />
            عدد الرسائل اليومية
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              <h2 className="font-bold">الحسابات حسب الصلاحية</h2>
            </div>

            {roles.map((r) => {
              const count = s.byRole[r];
              const percentage =
                people > 0 ? ((count ?? 0) / people) * 100 : 0;

              return (
                <div key={r} className="mb-4 last:mb-0">
                  <div className="mb-2 flex justify-between gap-2 text-sm">
                    <span>{roleLabel[r]}</span>
                    <span className="font-semibold tabular-nums">
                      {count}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </section>

          <section className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="size-5 text-primary" />
              <h2 className="font-bold">الأكثر إرسالًا</h2>
            </div>

            {s.topSenders.length === 0 ? (
              <p className="py-3 text-center text-sm text-muted-foreground">
                لا توجد بيانات إرسال بعد
              </p>
            ) : (
              <div className="space-y-3">
                {s.topSenders.map((t, index) => (
                  <div
                    key={t.name}
                    className="flex items-center gap-3"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {t.name}
                    </span>
                    <Badge variant="secondary">{t.count}</Badge>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
              ترتيب آخر 14 يومًا
            </p>
          </section>
        </div>
      </div>

      {/* Read status */}
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">مؤشر قراءة الرسائل</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              تقدير مبني على إجمالي الرسائل والرسائل غير المقروءة
            </p>
          </div>
          <span className="text-2xl font-bold text-primary tabular-nums">
            {readRate.toLocaleString("ar-EG")}%
          </span>
        </div>

        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${readRate}%` }}
          />
        </div>

        <div className="mt-3 flex justify-between text-xs text-muted-foreground">
          <span>مقروءة: {Math.max(0, s.totalMessages - s.unread)}</span>
          <span>غير مقروءة: {s.unread}</span>
        </div>
      </section>

      <p className="text-center text-xs text-muted-foreground">
        يتم تحديث البيانات تلقائيًا كل 30 ثانية. الإحصائيات لا تعرض محتوى الرسائل.
      </p>
    </div>
  );
                  }
      
