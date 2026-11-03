
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  RefreshCw,
  Search,
  Activity,
  CalendarDays,
  UserRound,
  ShieldAlert,
  Mail,
  Trash2,
  KeyRound,
  LogIn,
  LogOut,
  Eye,
  FileSpreadsheet,
  Filter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchPeople } from "@/lib/queries";
import { clearActivityLog } from "@/lib/mail.functions";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ title: "سجل العمليات | بريد بستطهالك" }] }),
  beforeLoad: ({ context }) => {
    if (context.me.role !== "supervisor") throw redirect({ to: "/inbox" });
  },
  component: ActivityPage,
});

const actions: Record<
  string,
  { label: string; tone: "default" | "warn" | "danger"; icon: typeof Activity }
> = {
  login: { label: "تسجيل دخول", tone: "default", icon: LogIn },
  logout: { label: "تسجيل خروج", tone: "default", icon: LogOut },
  message_sent: { label: "إرسال رسالة", tone: "default", icon: Mail },
  view_message: { label: "فتح رسالة", tone: "default", icon: Eye },
  sheet_opened: { label: "فتح شيت", tone: "default", icon: FileSpreadsheet },
  message_deleted: { label: "حذف رسالة", tone: "danger", icon: Trash2 },
  account_created: { label: "إنشاء حساب", tone: "default", icon: UserRound },
  account_deleted: { label: "حذف حساب", tone: "danger", icon: Trash2 },
  password_reset: { label: "كلمة مرور مؤقتة جديدة", tone: "warn", icon: KeyRound },
  password_changed: { label: "تغيير كلمة المرور", tone: "default", icon: KeyRound },
  reset_requested: { label: "طلب استعادة كلمة المرور", tone: "warn", icon: KeyRound },
  supervisor_recovered: { label: "استرداد حساب السوبر فايزر", tone: "warn", icon: ShieldAlert },
  recovery_failed: { label: "محاولة استرداد فاشلة", tone: "danger", icon: ShieldAlert },
  screenshot_attempt: { label: "محاولة تصوير", tone: "danger", icon: ShieldAlert },
  devtools_attempt: { label: "أدوات المطور", tone: "danger", icon: ShieldAlert },
  print_attempt: { label: "محاولة طباعة", tone: "danger", icon: ShieldAlert },
  save_attempt: { label: "محاولة حفظ", tone: "danger", icon: ShieldAlert },
  copy_attempt: { label: "محاولة نسخ", tone: "danger", icon: ShieldAlert },
};

const toneCls = {
  default: "bg-secondary text-secondary-foreground border-transparent",
  warn: "bg-accent text-accent-foreground border-transparent",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
};

type Details = {
  subject?: string;
  recipients?: string[];
  sender?: string;
  name?: string;
  file?: string;
  detail?: string;
  role?: string;
};

function ActivityPage() {
  const [action, setAction] = useState("all");
  const [actor, setActor] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  const people = useQuery({
    queryKey: ["people"],
    queryFn: fetchPeople,
  });

  const log = useQuery({
    queryKey: ["activity", action, actor, from, to],
    queryFn: async () => {
      let query = supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (action !== "all") query = query.eq("action", action);
      if (actor !== "all") {
        query = query.or(
          `actor_id.eq.${actor},target_user_id.eq.${actor}`
        );
      }
      if (from) {
        query = query.gte("created_at", new Date(from).toISOString());
      }
      if (to) {
        const end = new Date(`${to}T23:59:59.999`);
        query = query.lte("created_at", end.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 20000,
  });

  const nameOf = (id: string | null) =>
    id
      ? people.data?.find((p) => p.id === id)?.full_name ?? "حساب غير متاح"
      : "—";

  const rows = useMemo(() => {
    const data = log.data ?? [];
    const term = q.trim().toLowerCase();

    if (!term) return data;

    return data.filter((r) => {
      const actorName = nameOf(r.actor_id).toLowerCase();
      const targetName = nameOf(r.target_user_id).toLowerCase();
      const details = JSON.stringify(r.details ?? {}).toLowerCase();
      const actionName = (actions[r.action]?.label ?? r.action).toLowerCase();

      return (
        actorName.includes(term) ||
        targetName.includes(term) ||
        details.includes(term) ||
        actionName.includes(term)
      );
    });
  }, [log.data, q, people.data]);

  const describe = (r: {
    action: string;
    details: unknown;
    target_user_id: string | null;
  }) => {
    const d = (r.details ?? {}) as Details;
    const parts: string[] = [];

    if (d.subject) parts.push(`«${d.subject}»`);
    if (d.sender) parts.push(`المرسل: ${d.sender}`);
    if (d.recipients?.length) {
      parts.push(`المستلمون: ${d.recipients.join("، ")}`);
    }
    if (d.file) parts.push(`الملف: ${d.file}`);
    if (d.name && r.action !== "reset_requested") {
      parts.push(`الحساب: ${d.name}`);
    }
    if (d.detail) parts.push(d.detail);

    return parts.join(" · ") || "لا توجد تفاصيل إضافية";
  };

  const dangerCount = rows.filter(
    (r) => actions[r.action]?.tone === "danger"
  ).length;

  const clear = async (scope: "logins" | "all") => {
    const msg = scope === "logins" ? "مسح كل تسجيلات الدخول والخروج وفتح الرسائل؟" : "مسح سجل العمليات بالكامل؟ لا يمكن التراجع.";
    if (!window.confirm(msg)) return;
    try {
      const r = await clearActivityLog({ data: { scope, olderThanDays: 0 } });
      toast.success(`تم مسح ${r.deleted} عملية`);
      log.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-3 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <Activity className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold">سجل العمليات</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              متابعة أنشطة المستخدمين والعمليات داخل النظام
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => log.refetch()}
            disabled={log.isFetching}
            className="gap-2"
          >
            <RefreshCw className={`size-4 ${log.isFetching ? "animate-spin" : ""}`} />
            تحديث السجل
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => clear("logins")}
          >
            <Trash2 className="size-4" />
            مسح تسجيلات الدخول
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="gap-2"
            onClick={() => clear("all")}
          >
            <Trash2 className="size-4" />
            مسح السجل كله
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        يتم مسح تسجيلات الدخول والخروج وفتح الرسائل تلقائيًا بعد 7 أيام، وباقي العمليات بعد 90 يومًا.
      </p>


      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">العمليات المعروضة</span>
            <Activity className="size-5 text-primary" />
          </div>
          <p className="mt-3 text-2xl font-bold tabular-nums">{rows.length}</p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">عمليات ذات تنبيه</span>
            <ShieldAlert className="size-5 text-destructive" />
          </div>
          <p className="mt-3 text-2xl font-bold tabular-nums">{dangerCount}</p>
        </div>
      </div>

      {/* Filters */}
      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 font-semibold">
          <Filter className="size-4 text-primary" />
          تصفية وبحث
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger>
              <SelectValue placeholder="نوع العملية" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل العمليات</SelectItem>
              {Object.entries(actions).map(([key, value]) => (
                <SelectItem key={key} value={key}>
                  {value.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={actor} onValueChange={setActor}>
            <SelectTrigger>
              <SelectValue placeholder="الشخص" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأشخاص</SelectItem>
              {people.data?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث في السجل..."
              className="pr-9"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">من تاريخ</label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="من تاريخ"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">إلى تاريخ</label>
            <Input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              aria-label="إلى تاريخ"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setAction("all");
              setActor("all");
              setFrom("");
              setTo("");
              setQ("");
            }}
          >
            مسح الفلاتر
          </Button>
        </div>
      </section>

      {/* Log list */}
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-bold">تفاصيل العمليات</h2>
          <Badge variant="secondary">{rows.length} نتيجة</Badge>
        </div>

        {log.isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            جاري تحميل السجل...
          </div>
        ) : log.isError ? (
          <div className="p-10 text-center">
            <p className="text-sm text-destructive">تعذر تحميل سجل العمليات.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => log.refetch()}
            >
              إعادة المحاولة
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <CalendarDays className="mx-auto mb-3 size-9 text-muted-foreground" />
            <p className="font-medium">لا توجد عمليات مطابقة</p>
            <p className="mt-1 text-xs text-muted-foreground">
              جرّب تغيير البحث أو الفلاتر.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {rows.map((r) => {
              const item = actions[r.action] ?? {
                label: r.action,
                tone: "default" as const,
                icon: Activity,
              };
              const Icon = item.icon;

              return (
                <article
                  key={r.id}
                  className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-start"
                >
                  <div className="flex items-start gap-3 sm:w-52 sm:shrink-0">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {nameOf(r.actor_id)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("ar-EG")}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 space-y-2 sm:pt-1">
                    <Badge className={toneCls[item.tone]}>{item.label}</Badge>
                    <p className="break-words text-sm leading-6 text-muted-foreground">
                      {describe(r)}
                    </p>
                    {r.target_user_id && (
                      <p className="text-xs text-muted-foreground">
                        الحساب المستهدف: {nameOf(r.target_user_id)}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-center text-xs text-muted-foreground">
        يتم عرض آخر 1000 عملية حسب الفلاتر المحددة.
      </p>
    </div>
  );
  }
