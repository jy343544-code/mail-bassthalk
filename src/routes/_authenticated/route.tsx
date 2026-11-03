
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
} from "@tanstack/react-router";

import {
  Activity,
  Inbox,
  KeyRound,
  LogOut,
  Mail,
  PenSquare,
  Send,
  Users,
  BarChart3,
  ChevronLeft,
  ShieldCheck,
  PhoneCall,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { loadMe, isStaff } from "@/lib/me";
import { roleLabel } from "@/lib/identity";

import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationsBell } from "@/components/NotificationsBell";
import { Button } from "@/components/ui/button";
import { DailyAyah } from "@/components/DailyAyah";

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

    if (!data.user) {
      throw redirect({ to: "/auth" });
    }

    const me = await loadMe(data.user.id);

    if (!me) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }

    if (
      me.mustChange &&
      location.pathname !== "/change-password"
    ) {
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
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function Layout() {
  const { me } = Route.useRouteContext();
  const navigate = useNavigate();

  const staff = isStaff(me.role);

  const signOut = async () => {
    await supabase
      .from("activity_log")
      .insert({
        actor_id: me.id,
        action: "logout",
      });

    await supabase.auth.signOut();

    navigate({ to: "/auth" });
  };

  const folders = [
    {
      f: "inbox",
      label: "الوارد",
      icon: Inbox,
    },
    {
      f: "sent",
      label: "المرسل",
      icon: Send,
    },
  ] as const;

  const navClass =
    "group flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-sidebar-foreground transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

  const activeClass =
    "bg-sidebar-accent text-sidebar-accent-foreground font-bold shadow-sm";

  return (
    <div
      dir="rtl"
      className="relative isolate flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground"
    >
      <div className="app-live-backdrop pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        <span className="app-glow app-glow-one" />
        <span className="app-glow app-glow-two" />
        <span className="app-glow app-glow-three" />
      </div>

      {/* TOP HEADER */}

      <header className="relative z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-topbar px-3 text-topbar-foreground shadow-sm sm:px-5">

        {/* BRAND */}

        <div className="flex min-w-0 items-center gap-3">

          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-white shadow-md">
            <Mail className="size-5" />
          </div>

          <div className="min-w-0">
            <div className="truncate text-base font-extrabold tracking-tight">
              بستطهالك
            </div>

            <div className="hidden text-xs opacity-70 sm:block">
              البريد والتواصل الداخلي
            </div>
          </div>

        </div>

        <div className="flex-1" />

        {/* HEADER ACTIONS */}

        <div className="flex shrink-0 items-center gap-2">

          <NotificationsBell userId={me.id} />

          <ThemeToggle />

          <div className="mx-1 hidden h-8 w-px bg-border sm:block" />

          {/* USER MENU */}

          <DropdownMenu>

            <DropdownMenuTrigger asChild>
              <button
                aria-label="قائمة حساب المستخدم"
                className="flex items-center gap-2 rounded-xl p-1.5 transition-colors hover:bg-accent"
              >

                <div className="grid size-9 place-items-center rounded-full bg-brand text-xs font-bold text-white shadow-sm">
                  {initials(me.fullName)}
                </div>

                <div className="hidden min-w-0 text-right sm:block">

                  <div className="max-w-32 truncate text-sm font-bold">
                    {me.fullName}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {roleLabel[me.role]}
                  </div>

                </div>

              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              className="w-60 rounded-xl p-2"
            >

              <DropdownMenuLabel>
                <div className="font-bold">
                  {me.fullName}
                </div>

                <div className="mt-1 text-xs font-normal text-muted-foreground">
                  {roleLabel[me.role]} · @{me.username}
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <DropdownMenuItem asChild>
                <Link
                  to="/change-password"
                  className="flex cursor-pointer items-center gap-2 rounded-lg"
                >
                  <KeyRound className="size-4" />
                  تغيير كلمة المرور
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={signOut}
                className="cursor-pointer rounded-lg text-destructive focus:text-destructive"
              >
                <LogOut className="size-4" />
                تسجيل الخروج
              </DropdownMenuItem>

            </DropdownMenuContent>

          </DropdownMenu>

        </div>

      </header>

      {/* MAIN APPLICATION */}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">

        {!me.mustChange && (

          <aside className="relative z-10 flex shrink-0 flex-col border-b bg-sidebar/90 text-sidebar-foreground backdrop-blur-xl md:w-64 md:border-b-0 md:border-l">

            {/* SIDEBAR HEADER */}

            <div className="hidden items-center justify-between px-5 pb-3 pt-5 md:flex">

              <div>
                <div className="text-xs font-bold text-muted-foreground">
                  مساحة العمل
                </div>

                <div className="mt-1 text-sm font-bold">
                  القائمة الرئيسية
                </div>
              </div>

              <ShieldCheck className="size-5 text-primary" />

            </div>

            {/* COMPOSE BUTTON */}

            <div className="hidden px-4 pb-4 pt-2 md:block">

              <Button
                asChild
                className="h-11 w-full justify-center gap-2 rounded-xl bg-brand font-bold text-white shadow-md hover:opacity-90"
              >
                <Link to="/compose">
                  <PenSquare className="size-4" />
                  إنشاء رسالة جديدة
                </Link>
              </Button>

            </div>

            {/* MOBILE COMPOSE */}

            <div className="flex gap-1 overflow-x-auto p-2 md:hidden">

              <Link
                to="/compose"
                className={`${navClass} bg-primary text-primary-foreground hover:bg-primary/90`}
              >
                <PenSquare className="size-4" />
                جديدة
              </Link>

              {folders.map((folder) => (
                <Link
                  key={folder.f}
                  to="/inbox"
                  search={{ f: folder.f }}
                  className={navClass}
                  activeOptions={{ includeSearch: true }}
                  activeProps={{ className: activeClass }}
                >
                  <folder.icon className="size-4" />
                  {folder.label}
                </Link>
              ))}

              <Link to="/call-follow-up" className={navClass} activeProps={{ className: activeClass }}>
                <PhoneCall className="size-4" />
                متابعة المكالمات
              </Link>

              {staff && (
                <Link
                  to="/stats"
                  className={navClass}
                  activeProps={{ className: activeClass }}
                >
                  <BarChart3 className="size-4" />
                  الإحصائيات
                </Link>
              )}

              {me.role === "supervisor" && (
                <Link
                  to="/users"
                  className={navClass}
                  activeProps={{ className: activeClass }}
                >
                  <Users className="size-4" />
                  الحسابات
                </Link>
              )}

            </div>

            {/* DESKTOP NAVIGATION */}

            <nav className="hidden flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4 md:flex">

              <div className="px-3 pb-2 pt-2 text-xs font-bold text-muted-foreground">
                البريد الإلكتروني
              </div>

              {folders.map((folder) => (
                <Link
                  key={folder.f}
                  to="/inbox"
                  search={{ f: folder.f }}
                  className={navClass}
                  activeOptions={{ includeSearch: true }}
                  activeProps={{ className: activeClass }}
                >
                  <folder.icon className="size-4 shrink-0" />

                  <span>{folder.label}</span>

                  <ChevronLeft className="mr-auto size-4 opacity-0 transition-opacity group-hover:opacity-60" />
                </Link>
              ))}

              <Link to="/call-follow-up" className={navClass} activeProps={{ className: activeClass }}>
                <PhoneCall className="size-4 shrink-0" />
                <span>متابعة المكالمات</span>
                <ChevronLeft className="mr-auto size-4 opacity-0 transition-opacity group-hover:opacity-60" />
              </Link>

              {staff && (
                <>
                  <div className="px-3 pb-2 pt-6 text-xs font-bold text-muted-foreground">
                    التقارير والأداء
                  </div>

                  <Link
                    to="/stats"
                    className={navClass}
                    activeProps={{ className: activeClass }}
                  >
                    <BarChart3 className="size-4" />
                    <span>الإحصائيات</span>
                    <ChevronLeft className="mr-auto size-4 opacity-0 transition-opacity group-hover:opacity-60" />
                  </Link>
                </>
              )}

              {me.role === "supervisor" && (
                <>
                  <div className="px-3 pb-2 pt-6 text-xs font-bold text-muted-foreground">
                    إدارة النظام
                  </div>

                  <Link
                    to="/users"
                    className={navClass}
                    activeProps={{ className: activeClass }}
                  >
                    <Users className="size-4" />
                    <span>الحسابات والموظفين</span>
                    <ChevronLeft className="mr-auto size-4 opacity-0 transition-opacity group-hover:opacity-60" />
                  </Link>

                  <Link
                    to="/activity"
                    className={navClass}
                    activeProps={{ className: activeClass }}
                  >
                    <Activity className="size-4" />
                    <span>سجل العمليات</span>
                    <ChevronLeft className="mr-auto size-4 opacity-0 transition-opacity group-hover:opacity-60" />
                  </Link>
                </>
              )}

            </nav>

            {/* SIDEBAR FOOTER */}

            <div className="hidden border-t border-sidebar-border p-4 md:block">

              <div className="flex items-center gap-2 rounded-xl bg-background/60 p-3">

                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="size-5" />
                </div>

                <div className="min-w-0">
                  <div className="text-xs font-bold">
                    بيئة عمل داخلية
                  </div>

                  <div className="mt-1 truncate text-[11px] text-muted-foreground">
                    بستطهالك Mail
                  </div>
                </div>

              </div>

            </div>

          </aside>

        )}

        {/* PAGE CONTENT */}

        <main className="relative z-10 min-h-0 min-w-0 flex-1 overflow-auto bg-background/75 backdrop-blur-[3px]">
          {!me.mustChange && <DailyAyah />}
          <div className="min-h-full">
            <Outlet />
          </div>

        </main>

      </div>

    </div>
  );
  }
              
