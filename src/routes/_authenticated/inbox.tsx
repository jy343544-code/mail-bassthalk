import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Paperclip, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchMessages, fetchPeople } from "@/lib/queries";
import { Input } from "@/components/ui/input";

type Folder = "inbox" | "sent";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({ meta: [{ title: "الرسائل | بريد بستطهالك" }] }),
  validateSearch: (s: Record<string, unknown>): { f?: Folder | undefined } => ({
    f: s["f"] === "sent" ? "sent" : undefined,
  }),
  component: InboxLayout,
});

const titles: Record<Folder, string> = { inbox: "الوارد", sent: "المرسل" };

function InboxLayout() {
  const { me } = Route.useRouteContext();
  const { f } = Route.useSearch();
  const folder: Folder = f ?? "inbox";
  const params = useParams({ strict: false }) as { id?: string };
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const messages = useQuery({ queryKey: ["messages"], queryFn: fetchMessages, refetchInterval: 20000 });
  const people = useQuery({ queryKey: ["people"], queryFn: fetchPeople });

  useEffect(() => {
    const ch = supabase
      .channel(`inbox-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_recipients" }, () => {
        qc.invalidateQueries({ queryKey: ["messages"] });
        qc.invalidateQueries({ queryKey: ["message"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const nameOf = (id: string) => people.data?.find((p) => p.id === id)?.full_name ?? "—";

  const list = useMemo(() => {
    const all = messages.data ?? [];
    const byFolder = all.filter((m) =>
      folder === "inbox"
        ? m.message_recipients.some((r) => r.recipient_id === me.id)
        : m.sender_id === me.id,
    );
    const t = q.trim();
    return t ? byFolder.filter((m) => m.subject.includes(t) || m.body.includes(t)) : byFolder;
  }, [messages.data, folder, me.id, q]);

  return (
    <div className="flex h-full">
      <section
        className={`flex w-full flex-col border-l bg-card md:w-[360px] md:shrink-0 ${params.id ? "hidden md:flex" : ""}`}
      >
        <div className="border-b p-3">
          <h1 className="mb-2 text-lg">{titles[folder]}</h1>
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث" className="bg-muted pr-9" />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {messages.isLoading && <p className="p-4 text-sm text-muted-foreground">جاري التحميل...</p>}
          {!messages.isLoading && list.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">لا توجد رسائل</p>
          )}
          {list.map((m) => {
            const mine = m.message_recipients.find((r) => r.recipient_id === me.id);
            const unread = !!mine && !mine.read_at;
            const who =
              folder === "sent"
                ? `إلى: ${m.message_recipients.map((r) => nameOf(r.recipient_id)).join("، ")}`
                : nameOf(m.sender_id);
            const active = params.id === m.id;
            return (
              <Link
                key={m.id}
                to="/inbox/$id"
                params={{ id: m.id }}
                search={{ f }}
                className={`relative block border-b px-4 py-3 transition-colors hover:bg-muted ${active ? "bg-accent" : ""}`}
              >
                {unread && <span className="absolute inset-y-0 right-0 w-1 bg-unread" />}
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate text-sm ${unread ? "font-bold" : ""}`}>{who}</span>
                  <time className={`shrink-0 text-xs ${unread ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                    {new Date(m.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}
                  </time>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`truncate text-sm ${unread ? "font-semibold text-primary" : ""}`}>{m.subject}</span>
                  {(m.file_path || m.sheet_url) && <Paperclip className="size-3 shrink-0 text-muted-foreground" />}
                </div>
                <p className="truncate text-xs text-muted-foreground">{m.body || "شيت مرفق"}</p>
              </Link>
            );
          })}
        </div>
      </section>
      <section className={`min-w-0 flex-1 ${params.id ? "" : "hidden md:block"}`}>
        <Outlet />
      </section>
    </div>
  );
}
