import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Trash2, UserPlus, Wand2 } from "lucide-react";
import { createAccount, deleteAccount, resetTempPassword } from "@/lib/mail.functions";
import { fetchPeople } from "@/lib/queries";
import { roleLabel } from "@/lib/identity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "الحسابات | بريد بستطهالك" }] }),
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
  const people = useQuery({ queryKey: ["people"], queryFn: fetchPeople });
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState(genPassword());
  const [role, setRole] = useState<"manager" | "employee">("employee");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createAccount({ data: { fullName, username, password, role } });
      toast.success(`تم إنشاء الحساب. كلمة المرور المؤقتة: ${password}`, { duration: 15000 });
      setFullName("");
      setUsername("");
      setPassword(genPassword());
      qc.invalidateQueries({ queryKey: ["people"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <h1 className="text-3xl text-primary">الحسابات</h1>

      <form onSubmit={submit} className="grid gap-4 rounded-2xl border bg-card p-6 shadow-soft md:grid-cols-2">
        <h2 className="flex items-center gap-2 text-xl md:col-span-2">
          <UserPlus className="size-5 text-primary" /> حساب جديد
        </h2>
        <div className="space-y-2">
          <Label>الاسم بالكامل</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>اسم المستخدم (إنجليزي)</Label>
          <Input dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>الصلاحية</Label>
          <Select value={role} onValueChange={(v) => setRole(v as "manager" | "employee")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="employee">موظف</SelectItem>
              <SelectItem value="manager">مدير</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>كلمة مرور مؤقتة</Label>
          <div className="flex gap-2">
            <Input dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button type="button" variant="outline" size="icon" onClick={() => setPassword(genPassword())}>
              <Wand2 className="size-4" />
            </Button>
          </div>
        </div>
        <Button type="submit" disabled={busy} className="md:col-span-2 md:w-fit">
          {busy ? "جاري..." : "إنشاء الحساب"}
        </Button>
      </form>

      <div className="overflow-hidden rounded-2xl border bg-card">
        {people.data?.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 border-b p-4 last:border-0">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{p.full_name}</div>
              <div className="text-sm text-muted-foreground" dir="ltr">
                @{p.username}
              </div>
            </div>
            {p.role && <Badge variant="secondary">{roleLabel[p.role]}</Badge>}
            {p.must_change_password && <Badge variant="outline">كلمة مرور مؤقتة</Badge>}
            {p.id !== me.id && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={async () => {
                    const pw = genPassword();
                    try {
                      await resetTempPassword({ data: { userId: p.id, password: pw } });
                      toast.success(`كلمة المرور المؤقتة الجديدة: ${pw}`, { duration: 20000 });
                      qc.invalidateQueries({ queryKey: ["people"] });
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  <KeyRound className="size-4" /> مؤقتة جديدة
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={async () => {
                    if (!confirm(`حذف حساب ${p.full_name}؟`)) return;
                    try {
                      await deleteAccount({ data: { userId: p.id } });
                      qc.invalidateQueries({ queryKey: ["people"] });
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
