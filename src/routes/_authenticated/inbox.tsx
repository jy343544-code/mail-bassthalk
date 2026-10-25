import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { FileSpreadsheet, Inbox as InboxIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchMessages, fetchPeople } from "@/lib/queries";
import { isStaff } from "@/lib/me";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({ meta: [{ title: "الرسائل | بريد بستطهالك" }] }),
  component: InboxPage,
});

function InboxPage() {
  const { me } = Route.useRouteContext();
  const qc = useQueryClient();
  const messages = useQuery({ queryKey: ["messages"], queryFn: fetchMessages, refetchInterval: 20000 });
  const people = useQuery({ queryKey: ["people"], queryFn: fetchPeople });

  useEffect(() => {
    const ch = supabase
      .channel(`inbox-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_recipients" }, () =>
        qc.invalidateQueries({ queryKey: ["messages"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const nameOf = (id: string) => people.data?.find((p) => p.id === id)?.full_name ?? "—";

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl text-primary">{isStaff(me.role) ? "كل الرسائل" : "الوارد"}</h1>
      <div className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-soft">
        {messages.isLoading && <p className="p-6 text-muted-foreground">جاري التحميل...</p>}
        {messages.data?.length === 0 && (
          <div className="flex flex-col items-center gap-3 p-12 text-muted-foreground">
            <InboxIcon className="size-10" />
            لا توجد رسائل
          </div>
        )}
        {messages.data?.map((m) => {
          const mine = m.message_recipients.find((r) => r.recipient_id === me.id);
          const unread = mine && !mine.read_at;
          return (
            <Link
              key={m.id}
              to="/messages/$id"
              params={{ id: m.id }}
              className="flex items-center gap-4 border-b p-4 transition-colors last:border-0 hover:bg-muted"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                <FileSpreadsheet className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={unread ? "font-bold" : "font-medium"}>{m.subject}</span>
                  {unread && <Badge className="bg-accent text-accent-foreground">جديد</Badge>}
                </div>
                <div className="truncate text-sm text-muted-foreground">
                  من {nameOf(m.sender_id)}
                  {isStaff(me.role) && ` · إلى ${m.message_recipients.map((r) => nameOf(r.recipient_id)).join("، ")}`}
                </div>
              </div>
              <time className="shrink-0 text-xs text-muted-foreground">
                {new Date(m.created_at).toLocaleDateString("ar-EG")}
              </time>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
