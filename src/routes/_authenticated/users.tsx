
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  KeyRound,
  Trash2,
  UserPlus,
  Wand2,
  Search,
  Users,
  ShieldCheck,
  RefreshCw,
  UserRound,
} from "lucide-react";
import {
  createAccount,
  deleteAccount,
  resetTempPassword,
} from "@/lib/mail.functions";
import { fetchPeople } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { roleLabel } from "@/lib/identity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "إدارة الحسابات | بريد بستطهالك" }] }),
  beforeLoad: ({ context }) => {
    if (context.me.role !== "supervisor") throw redirect({ to: "/inbox" });
  },
  component: UsersPage,
});

const genPassword = () => {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const a = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(a, (n) => chars[n % chars.length]).join("");
};

function UsersPage() {
  const { me } = Route.useRouteContext();
  const qc = useQueryClient();

  const people = useQuery({
    queryKey: ["people"],
    queryFn: fetchPeople,
  });

  const requests = useQuery({
    queryKey: ["reset-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("password_reset_requests")
        .select("*")
        .is("resolved_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState(genPassword());
  const [role, setRole] = useState<"supervisor" | "manager" | "employee">("employee");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people.data ?? [];

    return (people.data ?? []).filter(
      (p) =>
        p.full_name?.toLowerCase().includes(q) ||
        p.username?.toLowerCase().includes(q) ||
        (p.role && roleLabel[p.role]?.toLowerCase().includes(q))
    );
  }, [people.data, search]);

  const counts = useMemo(() => {
    const all = people.data ?? [];
    return {
      total: all.length,
      employees: all.filter((p) => p.role === "employee").length,
      managers: all.filter((p) => p.role === "manager").length,
      supervisors: all.filter((p) => p.role === "supervisor").length,
    };
  }, [people.data]);

  async function resetFor(userId: string) {
    setResettingId(userId);
    const pw = genPassword();

    try {
      await resetTempPassword({ data: { userId, password: pw } });
      toast.success(`كلمة المرور المؤقتة الجديدة: ${pw}`, {
        duration: 30000,
      });
      qc.invalidateQueries({ queryKey: ["people"] });
      qc.invalidateQueries({ queryKey: ["reset-requests"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setResettingId(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (!fullName.trim() || !username.trim() || !password.trim()) {
      toast.error("يرجى استكمال جميع البيانات");
      return;
    }

    setBusy(true);

    try {
      await createAccount({
        data: {
          fullName: fullName.trim(),
          username: username.trim(),
          password,
          role,
        },
      });

      toast.success(`تم إنشاء الحساب. كلمة المرور المؤقتة: ${password}`, {
        duration: 30000,
      });

      setFullName("");
      setUsername("");
      setPassword(genPassword());
      setRole("employee");
      qc.invalidateQueries({ queryKey: ["people"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeAccount(userId: string, name: string) {
    if (!confirm(`هل أنت متأكد من حذف حساب ${name}؟ لا يمكن التراجع عن هذه العملية.`)) {
      return;
    }

    setDeletingId(userId);

    try {
      await deleteAccount({ data: { userId } });
      toast.success("تم حذف الحساب");
      qc.invalidateQueries({ queryKey: ["people"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-3 md:p-6">
      {/* Page heading */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">إدارة الحسابات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            إدارة الموظفين والمديرين وصلاحيات الدخول
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => {
            qc.invalidateQueries({ queryKey: ["people"] });
            qc.invalidateQueries({ queryKey: ["reset-requests"] });
          }}
        >
          <RefreshCw className="size-4" />
          تحديث البيانات
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "إجمالي الحسابات", value: counts.total, icon: Users },
          { label: "الموظفون", value: counts.employees, icon: UserRound },
          { label: "المديرون", value: counts.managers, icon: ShieldCheck },
          { label: "السوبر فايزر", value: counts.supervisors, icon: KeyRound },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <item.icon className="size-5 text-primary" />
            </div>
            <p className="mt-3 text-2xl font-bold tabular-nums">
              {people.isLoading ? "—" : item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Password requests */}
      {!!requests.data?.length && (
        <section className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-bold">طلبات استعادة كلمة المرور</h2>
            <Badge>{requests.data.length} طلب</Badge>
          </div>

          <div className="space-y-2">
            {requests.data.map((r) => {
              const person = people.data?.find((p) => p.id === r.user_id);

              return (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {person?.full_name ?? "حساب غير معروف"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("ar-EG")}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    className="gap-2"
                    disabled={resettingId === r.user_id}
                    onClick={() => resetFor(r.user_id)}
                  >
                    <KeyRound className="size-4" />
                    {resettingId === r.user_id ? "جاري الإنشاء..." : "كلمة مؤقتة"}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Create account */}
      <form
        onSubmit={submit}
        className="space-y-5 rounded-xl border bg-card p-4 shadow-sm md:p-6"
      >
        <div className="flex items-center gap-3 border-b pb-4">
          <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
            <UserPlus className="size-5" />
          </span>
          <div>
            <h2 className="font-bold">إنشاء حساب جديد</h2>
            <p className="text-xs text-muted-foreground">
              إضافة عضو جديد إلى نظام المراسلات
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>الاسم بالكامل</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="اسم الموظف"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>اسم المستخدم</Label>
            <Input
              dir="ltr"
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>الصلاحية</Label>
            <Select
              value={role}
              onValueChange={(v) =>
                setRole(v as "supervisor" | "manager" | "employee")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">موظف</SelectItem>
                <SelectItem value="manager">مدير</SelectItem>
                <SelectItem value="supervisor">سوبر فايزر</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>كلمة مرور مؤقتة</Label>
            <div className="flex gap-2">
              <Input
                dir="ltr"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="توليد كلمة مرور"
                onClick={() => setPassword(genPassword())}
              >
                <Wand2 className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <Button type="submit" disabled={busy} className="w-full gap-2 sm:w-auto">
          <UserPlus className="size-4" />
          {busy ? "جاري إنشاء الحساب..." : "إنشاء الحساب"}
        </Button>
      </form>

      {/* Accounts list */}
      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="space-y-3 border-b p-4 md:flex md:items-center md:justify-between md:space-y-0">
          <div>
            <h2 className="font-bold">حسابات المستخدمين</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              عرض وإدارة الحسابات المسجلة
            </p>
          </div>

          <div className="relative md:w-72">
            <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو المستخدم..."
              className="pr-9"
            />
          </div>
        </div>

        {people.isLoading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            جاري تحميل الحسابات...
          </p>
        ) : people.isError ? (
          <div className="p-8 text-center">
            <p className="text-sm text-destructive">تعذر تحميل الحسابات.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => people.refetch()}
            >
              إعادة المحاولة
            </Button>
          </div>
        ) : filteredPeople.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            لا توجد حسابات مطابقة للبحث.
          </p>
        ) : (
          <div className="divide-y">
            {filteredPeople.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-muted/30"
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 font-bold text-primary">
                  {p.full_name?.trim()?.[0] ?? "؟"}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground" dir="ltr">
                    @{p.username}
                  </p>
                </div>

                {p.role && (
                  <Badge variant="secondary">{roleLabel[p.role]}</Badge>
                )}

                {p.must_change_password && (
                  <Badge variant="outline">تغيير كلمة المرور مطلوب</Badge>
                )}

                {p.id !== me.id && (
                  <div className="flex w-full gap-2 sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1 sm:flex-none"
                      disabled={resettingId === p.id || deletingId === p.id}
                      onClick={() => resetFor(p.id)}
                    >
                      <KeyRound className="size-4" />
                      {resettingId === p.id ? "جاري..." : "إعادة تعيين"}
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`حذف حساب ${p.full_name}`}
                      disabled={deletingId === p.id || resettingId === p.id}
                      onClick={() => removeAccount(p.id, p.full_name)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
    }
