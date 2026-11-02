
import {
  createFileRoute,
  Link,
  Outlet,
  useParams,
} from "@tanstack/react-router";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import {
  Paperclip,
  Search,
  Inbox,
  Send,
  Mail,
  MailOpen,
  RefreshCw,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { fetchMessages, fetchPeople } from "@/lib/queries";
import { Input } from "@/components/ui/input";

type Folder = "inbox" | "sent";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [{ title: "الرسائل | بريد بستطهالك" }],
  }),

  validateSearch: (
    s: Record<string, unknown>,
  ): { f?: Folder | undefined } => ({
    f: s["f"] === "sent" ? "sent" : undefined,
  }),

  component: InboxLayout,
});

const titles: Record<Folder, string> = {
  inbox: "الوارد",
  sent: "المرسل",
};

function InboxLayout() {
  const { me } = Route.useRouteContext();
  const { f } = Route.useSearch();

  const folder: Folder = f ?? "inbox";

  const params = useParams({ strict: false }) as {
    id?: string;
  };

  const qc = useQueryClient();

  const [q, setQ] = useState("");

  const messages = useQuery({
    queryKey: ["messages"],
    queryFn: fetchMessages,
    refetchInterval: 20000,
  });

  const people = useQuery({
    queryKey: ["people"],
    queryFn: fetchPeople,
  });

  useEffect(() => {
    const ch = supabase
      .channel(`inbox-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_recipients",
        },
        () => {
          qc.invalidateQueries({ queryKey: ["messages"] });
          qc.invalidateQueries({ queryKey: ["message"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const nameOf = (id: string) =>
    people.data?.find((p) => p.id === id)?.full_name ?? "غير معروف";

  const list = useMemo(() => {
    const all = messages.data ?? [];

    const byFolder = all.filter((m) =>
      folder === "inbox"
        ? m.message_recipients.some(
            (r) => r.recipient_id === me.id,
          )
        : m.sender_id === me.id,
    );

    const term = q.trim().toLocaleLowerCase("ar");

    const filtered = term
      ? byFolder.filter((m) => {
          const subject = (m.subject ?? "").toLocaleLowerCase("ar");
          const body = (m.body ?? "").toLocaleLowerCase("ar");

          const sender = nameOf(m.sender_id).toLocaleLowerCase("ar");

          return (
            subject.includes(term) ||
            body.includes(term) ||
            sender.includes(term)
          );
        })
      : byFolder;

    return [...filtered].sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime(),
    );
  }, [messages.data, folder, me.id, q, people.data]);

  const unreadCount = useMemo(() => {
    if (folder !== "inbox") return 0;

    return list.filter((m) => {
      const recipient = m.message_recipients.find(
        (r) => r.recipient_id === me.id,
      );

      return !!recipient && !recipient.read_at;
    }).length;
  }, [list, folder, me.id]);

  const formatDate = (date: string) => {
    const value = new Date(date);

    if (Number.isNaN(value.getTime())) return "";

    return value.toLocaleDateString("ar-EG", {
      day: "numeric",
      month: "short",
    });
  };

  const formatTime = (date: string) => {
    const value = new Date(date);

    if (Number.isNaN(value.getTime())) return "";

    return value.toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const refreshMessages = () => {
    qc.invalidateQueries({ queryKey: ["messages"] });
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-background">

      {/* MESSAGE LIST */}

      <section
        className={`flex w-full flex-col border-l bg-card md:w-[390px] md:shrink-0 ${
          params.id ? "hidden md:flex" : ""
        }`}
      >

        {/* HEADER */}

        <div className="border-b p-4">

          <div className="mb-4 flex items-center justify-between">

            <div>
              <div className="flex items-center gap-2">

                <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  {folder === "inbox" ? (
                    <Inbox className="size-5" />
                  ) : (
                    <Send className="size-5" />
                  )}
                </div>

                <div>
                  <h1 className="text-xl font-extrabold">
                    {titles[folder]}
                  </h1>

                  <p className="text-xs text-muted-foreground">
                    إدارة ومتابعة رسائلك
                  </p>
                </div>

              </div>
            </div>

            <button
              type="button"
              onClick={refreshMessages}
              aria-label="تحديث الرسائل"
              className="grid size-9 place-items-center rounded-xl border bg-background transition hover:bg-accent"
            >
              <RefreshCw className="size-4" />
            </button>

          </div>

          {/* FOLDER TABS */}

          <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">

            <Link
              to="/inbox"
              search={{ f: undefined }}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                folder === "inbox"
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Inbox className="size-4" />
              الوارد
            </Link>

            <Link
              to="/inbox"
              search={{ f: "sent" }}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                folder === "sent"
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Send className="size-4" />
              المرسل
            </Link>

          </div>

          {/* SEARCH */}

          <div className="relative">

            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث عن رسالة أو مرسل..."
              className="h-11 rounded-xl border bg-muted/60 pr-10 pl-10"
            />

            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="مسح البحث"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}

          </div>

          {/* COUNTERS */}

          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">

            <span>
              {list.length} رسالة
            </span>

            {folder === "inbox" && unreadCount > 0 && (
              <span className="flex items-center gap-1 font-bold text-primary">
                <MailOpen className="size-3.5" />
                {unreadCount} غير مقروءة
              </span>
            )}

          </div>

        </div>

        {/* MESSAGES */}

        <div className="flex-1 overflow-auto">

          {messages.isLoading && (
            <div className="flex flex-col items-center gap-3 p-10 text-center">

              <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <RefreshCw className="size-5 animate-spin" />
              </div>

              <p className="text-sm text-muted-foreground">
                جاري تحميل الرسائل...
              </p>

            </div>
          )}

          {messages.isError && (
            <div className="p-8 text-center">

              <Mail className="mx-auto mb-3 size-9 text-destructive" />

              <p className="text-sm font-semibold">
                تعذر تحميل الرسائل
              </p>

              <button
                type="button"
                onClick={() => messages.refetch()}
                className="mt-3 text-sm font-bold text-primary hover:underline"
              >
                حاول مرة أخرى
              </button>

            </div>
          )}

          {!messages.isLoading &&
            !messages.isError &&
            list.length === 0 && (

              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">

                <div className="mb-4 grid size-16 place-items-center rounded-2xl bg-muted text-muted-foreground">
                  {q ? (
                    <Search className="size-7" />
                  ) : (
                    <Mail className="size-7" />
                  )}
                </div>

                <h3 className="font-bold">
                  {q ? "لا توجد نتائج" : "لا توجد رسائل"}
                </h3>

                <p className="mt-2 text-sm text-muted-foreground">
                  {q
                    ? "جرب البحث بكلمات مختلفة"
                    : "ستظهر رسائلك هنا عند وصولها"}
                </p>

              </div>
            )}

          {!messages.isLoading &&
            !messages.isError &&
            list.map((m) => {

              const mine = m.message_recipients.find(
                (r) => r.recipient_id === me.id,
              );

              const unread = !!mine && !mine.read_at;

              const who =
                folder === "sent"
                  ? `إلى: ${m.message_recipients
                      .map((r) => nameOf(r.recipient_id))
                      .join("، ")}`
                  : nameOf(m.sender_id);

              const active = params.id === m.id;

              return (
                <Link
                  key={m.id}
                  to="/inbox/$id"
                  params={{ id: m.id }}
                  search={{ f }}
                  className={`relative block border-b px-4 py-4 transition-all hover:bg-muted/70 ${
                    active
                      ? "bg-accent/70"
                      : "bg-card"
                  }`}
                >

                  {unread && (
                    <span className="absolute inset-y-0 right-0 w-1 bg-primary" />
                  )}

                  <div className="flex items-start gap-3">

                    {/* AVATAR */}

                    <div className={`grid size-10 shrink-0 place-items-center rounded-xl text-sm font-bold ${
                      unread
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {who.trim().charAt(0) || "؟"}
                    </div>

                    <div className="min-w-0 flex-1">

                      {/* SENDER + DATE */}

                      <div className="mb-1 flex items-center justify-between gap-2">

                        <span className={`truncate text-sm ${
                          unread
                            ? "font-extrabold text-foreground"
                            : "font-medium text-muted-foreground"
                        }`}>
                          {who}
                        </span>

                        <div className="shrink-0 text-left">

                          <time className={`block text-[11px] ${
                            unread
                              ? "font-bold text-primary"
                              : "text-muted-foreground"
                          }`}>
                            {formatDate(m.created_at)}
                          </time>

                          <span className="text-[10px] text-muted-foreground">
                            {formatTime(m.created_at)}
                          </span>

                        </div>

                      </div>

                      {/* SUBJECT */}

                      <div className="flex items-center gap-2">

                        <span className={`truncate text-sm ${
                          unread
                            ? "font-bold text-primary"
                            : "font-semibold"
                        }`}>
                          {m.subject || "بدون عنوان"}
                        </span>

                        {(m.file_path || m.sheet_url) && (
                          <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                        )}

                      </div>

                      {/* PREVIEW */}

                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {m.body || "شيت أو ملف مرفق"}
                      </p>

                      {/* STATUS */}

                      <div className="mt-2 flex items-center justify-between">

                        {unread ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                            جديد
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">
                            {folder === "sent" ? "رسالة مرسلة" : "رسالة"}
                          </span>
                        )}

                        {active && (
                          <span className="size-2 rounded-full bg-primary" />
                        )}

                      </div>

                    </div>

                  </div>

                </Link>
              );
            })}

        </div>

      </section>

      {/* MESSAGE DETAILS */}

      <section
        className={`min-w-0 flex-1 ${
          params.id ? "" : "hidden md:block"
        }`}
      >
        <Outlet />
      </section>

    </div>
  );
}
