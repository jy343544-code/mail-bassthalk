import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { Activity, Inbox, KeyRound, LogOut, Mail, PenSquare, Send, Users, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadMe, isStaff } from "@/lib/me";
import { roleLabel } from "@/lib/identity";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const me = await loadMe(data.user.id);
    if (!me) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
    if (me.mustChange && location.pathname !== "/change-password") {
      throw redirect({ to: "/change-password" });
    }
    return { me };
  },
  component: Layout,
});

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}

function Layout() {
  const { me } = Route.useRouteContext();
  const navigate = useNavigate();
  const staff = isStaff(me.role);

  const signOut = async () => {
    await supabase.from("activity_log").insert({ actor_id: me.id, action: "logout" });
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const folders = [
    { f: "inbox", label: "الوارد", icon: Inbox, show: true },
    { f: "sent", label: "المرسل", icon: Send, show: staff },
    { f: "all", label: "كل الرسائل", icon: Layers, show: staff },
  ] as const;
  const navCls =
    "flex shrink-0 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent";

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center gap-3 bg-topbar px-4 text-topbar-foreground">
        <Mail className="size-5" />
        <span className="font-semibold">بستطهالك</span>
        <span className="hidden text-sm opacity-80 sm:inline">· البريد الداخلي</span>
        <div className="flex-1" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="grid size-8 place-items-center rounded-full bg-card text-xs font-semibold text-primary">
              {initials(me.fullName)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div>{me.fullName}</div>
              <div className="text-xs font-normal text-muted-foreground">
                {roleLabel[me.role]} · @{me.username}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/change-password">
                <KeyRound className="size-4" /> تغيير كلمة المرور
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={signOut} className="text-destructive">
              <LogOut className="size-4" /> تسجيل الخروج
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {!me.mustChange && (
          <aside className="flex shrink-0 gap-1 overflow-x-auto border-b bg-sidebar p-2 text-sidebar-foreground md:w-56 md:flex-col md:border-b-0 md:border-l md:p-3">
            {staff && (
              <Button asChild className="mb-2 hidden gap-2 md:flex">
                <Link to="/compose">
                  <PenSquare className="size-4" /> رسالة جديدة
                </Link>
              </Button>
            )}
            {staff && (
              <Link to="/compose" className={`${navCls} md:hidden`}>
                <PenSquare className="size-4" /> جديدة
              </Link>
            )}
            <div className="hidden px-3 pb-1 pt-2 text-xs font-semibold text-muted-foreground md:block">المجلدات</div>
            {folders
              .filter((x) => x.show)
              .map((x) => (
                <Link
                  key={x.f}
                  to="/inbox"
                  search={{ f: x.f }}
                  className={navCls}
                  activeOptions={{ includeSearch: true }}
                  activeProps={{ className: "bg-sidebar-accent font-semibold text-sidebar-accent-foreground" }}
                >
                  <x.icon className="size-4" /> {x.label}
                </Link>
              ))}
            {me.role === "supervisor" && (
              <>
                <div className="hidden px-3 pb-1 pt-4 text-xs font-semibold text-muted-foreground md:block">الإدارة</div>
                <Link to="/users" className={navCls} activeProps={{ className: "bg-sidebar-accent font-semibold text-sidebar-accent-foreground" }}>
                  <Users className="size-4" /> الحسابات
                </Link>
                <Link to="/activity" className={navCls} activeProps={{ className: "bg-sidebar-accent font-semibold text-sidebar-accent-foreground" }}>
                  <Activity className="size-4" /> سجل العمليات
                </Link>
              </>
            )}
          </aside>
        )}
        <main className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
