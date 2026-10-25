import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchPeople } from "@/lib/queries";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ title: "سجل العمليات | بريد بستطهالك" }] }),
  beforeLoad: ({ context }) => {
    if (context.me.role !== "supervisor") throw redirect({ to: "/inbox" });
  },
  component: ActivityPage,
});

const actions: Record<string, { label: string; tone: "default" | "warn" | "danger" }> = {
  login: { label: "تسجيل دخول", tone: "default" },
  logout: { label: "تسجيل خروج", tone: "default" },
  message_sent: { label: "إرسال رسالة", tone: "default" },
  view_message: { label: "فتح رسالة", tone: "default" },
  sheet_opened: { label: "فتح شيت", tone: "default" },
  message_deleted: { label: "حذف رسالة", tone: "danger" },
  account_created: { label: "إنشاء حساب", tone: "default" },
  account_deleted: { label: "حذف حساب", tone: "danger" },
  password_reset: { label: "كلمة مرور مؤقتة جديدة", tone: "warn" },
  password_changed: { label: "تغيير كلمة المرور", tone: "default" },
  reset_requested: { label: "طلب استعادة كلمة المرور", tone: "warn" },
  supervisor_recovered: { label: "استرداد حساب السوبر فايزر", tone: "warn" },
  recovery_failed: { label: "محاولة استرداد فاشلة", tone: "danger" },
  screenshot_attempt: { label: "محاولة تصوير", tone: "danger" },
  devtools_attempt: { label: "أدوات المطور", tone: "danger" },
  print_attempt: { label: "محاولة طباعة", tone: "danger" },
  save_attempt: { label: "محاولة حفظ", tone: "danger" },
  copy_attempt: { label: "محاولة نسخ", tone: "danger" },
};

const toneCls = {
  default: "bg-secondary text-secondary-foreground",
  warn: "bg-accent text-accent-foreground",
  danger: "bg-destructive text-destructive-foreground",
};

type Details = { subject?: string; recipients?: string[]; sender?: string; name?: string; file?: string; detail?: string; role?: string };

function ActivityPage() {
  const [action, setAction] = useState("all");
  const [actor, setActor] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const people = useQuery({ queryKey: ["people"], queryFn: fetchPeople });

  const log = useQuery({
    queryKey: ["activity", action, actor, from, to],
    queryFn: async () => {
      let query = supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(1000);
      if (action !== "all") query = query.eq("action", action);
      if (actor !== "all") query = query.or(`actor_id.eq.${actor},target_user_id.eq.${actor}`);
      if (from) query = query.gte("created_at", new Date(from).toISOString());
      if (to) query = query.lte("created_at", new Date(`${to}T23:59:59`).toISOString());
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    refetchInterval: 20000,
  });

  const nameOf = (id: string | null) => (id ? people.data?.find((p) => p.id === id)?.full_name ?? "حساب محذوف" : "—");

  const rows = useMemo(() => {
    const t = q.trim();
    if (!t) return log.data ?? [];
    return (log.data ?? []).filter((r) => JSON.stringify(r.details).includes(t) || nameOf(r.actor_id).includes(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log.data, q, people.data]);

  const describe = (r: { action: string; details: unknown; target_user_id: string | null }) => {
    const d = (r.details ?? {}) as Details;
    const parts: string[] = [];
    if (d.subject) parts.push(`«${d.subject}»`);
    if (d.sender) parts.push(`المرسل: ${d.sender}`);
    if (d.recipients?.length) parts.push(`المستلمين: ${d.recipients.join("، ")}`);
    if (d.file) parts.push(`الملف: ${d.file}`);
    if (d.name && r.action !== "reset_requested") parts.push(`الحساب: ${d.name}`);
    if (d.detail) parts.push(d.detail);
    return parts.join(" · ");
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl">سجل العمليات</h1>
          <p className="text-sm text-muted-foreground">كل اللي حصل على الموقع: مين بعت، مين استلم، مين فتح، ومين مسح.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => log.refetch()} className="gap-2">
          <RefreshCw className="size-4" /> تحديث
        </Button>
      </div>

      <div className="mt-4 grid gap-2 rounded-md border bg-card p-3 sm:grid-cols-2 lg:grid-cols-5">
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger>
            <SelectValue placeholder="نوع العملية" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل العمليات</SelectItem>
            {Object.entries(actions).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v.label}
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
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="من تاريخ" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="إلى تاريخ" />
        <Input placeholder="بحث في التفاصيل" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-md border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="p-3 text-right font-medium">الوقت</th>
              <th className="p-3 text-right font-medium">الشخص</th>
              <th className="p-3 text-right font-medium">العملية</th>
              <th className="p-3 text-right font-medium">التفاصيل</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const a = actions[r.action] ?? { label: r.action, tone: "default" as const };
              return (
                <tr key={r.id} className="border-t align-top hover:bg-muted/50">
                  <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("ar-EG")}
                  </td>
                  <td className="whitespace-nowrap p-3 font-medium">{nameOf(r.actor_id)}</td>
                  <td className="p-3">
                    <Badge className={toneCls[a.tone]}>{a.label}</Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">{describe(r)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {log.isLoading && <p className="p-6 text-center text-muted-foreground">جاري التحميل...</p>}
        {!log.isLoading && rows.length === 0 && <p className="p-6 text-center text-muted-foreground">لا توجد عمليات</p>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">يتم عرض آخر 1000 عملية حسب الفلتر.</p>
    </div>
  );
}
