import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { Inbox, LogOut, Mail, PenSquare, ScanEye, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadMe, isStaff } from "@/lib/me";
import { roleLabel } from "@/lib/identity";
import { Button } from "@/components/ui/button";

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

function Layout() {
  const { me } = Route.useRouteContext();
  const navigate = useNavigate();
  const links = [
    { to: "/inbox", label: "الرسائل", icon: Inbox, show: true },
    { to: "/compose", label: "رسالة جديدة", icon: PenSquare, show: isStaff(me.role) },
    { to: "/users", label: "الحسابات", icon: Users, show: me.role === "supervisor" },
    { to: "/screenshots", label: "سجل التصوير", icon: ScanEye, show: me.role === "supervisor" },
  ] as const;

  return (
    <div className="min-h-screen md:grid md:grid-cols-[250px_1fr]">
      <aside className="flex flex-col bg-sidebar text-sidebar-foreground md:min-h-screen">
        <div className="flex items-center gap-3 p-5 text-lg font-display">
          <span className="grid size-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <Mail className="size-5" />
          </span>
          بستطهالك
        </div>
        {!me.mustChange && (
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
            {links
              .filter((l) => l.show)
              .map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent"
                  activeProps={{ className: "bg-sidebar-accent text-sidebar-primary" }}
                >
                  <l.icon className="size-4" />
                  {l.label}
                </Link>
              ))}
          </nav>
        )}
        <div className="mt-auto hidden border-t border-sidebar-border p-4 md:block">
          <div className="text-sm font-medium">{me.fullName}</div>
          <div className="text-xs opacity-70">{roleLabel[me.role]}</div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full justify-start gap-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut className="size-4" /> خروج
          </Button>
        </div>
      </aside>
      <main className="p-4 md:p-8">
        <div className="mb-4 flex items-center justify-between md:hidden">
          <span className="text-sm text-muted-foreground">
            {me.fullName} · {roleLabel[me.role]}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
