
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  ExternalLink,
  FileSpreadsheet,
  Trash2,
  Users,
  Clock3,
  Mail,
  CheckCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { deleteMessage } from "@/lib/mail.functions";
import { fetchPeople } from "@/lib/queries";
import { isStaff } from "@/lib/me";
import { roleLabel } from "@/lib/identity";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/inbox/$id")({
  head: () => ({ meta: [{ title: "رسالة | بريد بستطهالك" }] }),
  component: MessagePage,
});

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MessagePage() {
  const { id } = Route.useParams();
  const { me } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const logged = useRef<string | null>(null);

  const msg = useQuery({
    queryKey: ["message", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*, message_recipients(recipient_id, read_at)")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });

  const people = useQuery({
    queryKey: ["people"],
    queryFn: fetchPeople,
  });

  useEffect(() => {
    if (!msg.data || logged.current === id) return;

    logged.current = id;

    supabase
      .from("activity_log")
      .insert({
        actor_id: me.id,
        action: "view_message",
        message_id: id,
        details: { subject: msg.data.subject },
      })
      .then();

    supabase
      .from("message_recipients")
      .update({ read_at: new Date().toISOString() })
      .eq("message_id", id)
      .eq("recipient_id", me.id)
      .is("read_at", null)
      .then(() => qc.invalidateQueries({ queryKey: ["messages"] }));
  }, [msg.data, id, me.id, qc]);

  if (msg.isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <div className="mx-auto mb-3 size-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <p className="text-sm text-muted-foreground">جاري تحميل الرسالة...</p>
        </div>
      </div>
    );
  }

  if (msg.isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <Mail className="size-12 text-destructive" />
        <p className="text-lg font-semibold">تعذر تحميل الرسالة</p>
        <p className="text-sm text-muted-foreground">
          حصل خطأ أثناء تحميل البيانات. حاول مرة أخرى.
        </p>
        <Button onClick={() => msg.refetch()}>إعادة المحاولة</Button>
        <Button asChild variant="outline">
          <Link to="/inbox">العودة للوارد</Link>
        </Button>
      </div>
    );
  }

  if (!msg.data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <Mail className="size-12 text-muted-foreground" />
        <p className="text-lg font-semibold">الرسالة غير متاحة</p>
        <p className="text-sm text-muted-foreground">
          الرسالة دي اتمسحت أو مش متاحة ليك.
        </p>
        <Button asChild variant="outline">
          <Link to="/inbox">رجوع للوارد</Link>
        </Button>
      </div>
    );
  }

  const m = msg.data;
  const recipients = m.message_recipients ?? [];

  const nameOf = (uid: string) =>
    people.data?.find((person) => person.id === uid);

  const sender = nameOf(m.sender_id);

  const readCount = recipients.filter((recipient) => recipient.read_at).length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Toolbar */}
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-card/95 px-3 py-3 backdrop-blur md:px-6">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link to="/inbox" aria-label="العودة للوارد">
            <ArrowRight className="size-5" />
          </Link>
        </Button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">تفاصيل الرسالة</p>
          <p className="text-xs text-muted-foreground">بريد بستطهالك</p>
        </div>

        {isStaff(me.role) && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
                <span className="hidden sm:inline">حذف الرسالة</span>
                <span className="sm:hidden">حذف</span>
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>تأكيد حذف الرسالة</AlertDialogTitle>
                <AlertDialogDescription>
                  الرسالة والشيت هيتشالوا من عند كل المستلمين، والعملية هتتسجل
                  في سجل العمليات. هل أنت متأكد؟
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter>
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async () => {
                    try {
                      await deleteMessage({ data: { id } });
                      toast.success("تم حذف الرسالة");
                      qc.invalidateQueries({ queryKey: ["messages"] });
                      navigate({ to: "/inbox" });
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  تأكيد الحذف
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </header>

      {/* Message Content */}
      <main className="flex-1 overflow-y-auto p-3 md:p-6">
        <div className="mx-auto max-w-4xl space-y-5">
          {/* Subject */}
          <section className="rounded-2xl border bg-card p-5 shadow-sm md:p-7">
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-lg bg-primary/10 p-2 text-primary">
                <Mail className="size-5" />
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                رسالة بريد إلكتروني
              </span>
            </div>

            <h1 className="break-words text-xl font-bold leading-relaxed md:text-3xl">
              {m.subject || "بدون عنوان"}
            </h1>

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t pt-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="size-4" />
                {formatDate(m.created_at)}
              </span>

              <span className="inline-flex items-center gap-1.5">
                <Users className="size-4" />
                {recipients.length} مستلم
              </span>
            </div>
          </section>

          {/* Sender and Recipients */}
          <section className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
            <div className="flex items-start gap-3">
              <div className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                {sender?.full_name?.trim()?.[0] ?? "؟"}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <p className="break-words font-bold">
                  {sender?.full_name ?? "مرسل غير معروف"}
                </p>

                {sender?.role && (
                  <p className="text-xs text-muted-foreground">
                    {roleLabel[sender.role]}
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  المرسل
                </p>
              </div>
            </div>

            <div className="my-5 border-t" />

            <div className="flex items-start gap-3">
              <Users className="mt-1 size-4 shrink-0 text-muted-foreground" />

              <div className="min-w-0 flex-1">
                <p className="mb-2 text-sm font-semibold">إلى</p>

                <div className="flex flex-wrap gap-2">
                  {recipients.map((recipient) => {
                    const person = nameOf(recipient.recipient_id);

                    return (
                      <span
                        key={recipient.recipient_id}
                        className="inline-flex max-w-full items-center gap-2 rounded-full border bg-muted/50 px-3 py-1.5 text-xs"
                      >
                        <span className="truncate">
                          {person?.full_name ?? "مستلم"}
                        </span>
                        {recipient.read_at ? (
                          <CheckCheck
                            className="size-3.5 shrink-0 text-emerald-600"
                            aria-label="تمت القراءة"
                          />
                        ) : (
                          <span className="size-2 shrink-0 rounded-full bg-muted-foreground/40" />
                        )}
                      </span>
                    );
                  })}
                </div>

                {recipients.length > 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    تمت القراءة بواسطة {readCount} من {recipients.length}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Message Body */}
          <section className="rounded-2xl border bg-card p-5 shadow-sm md:p-7">
            <div className="mb-4 flex items-center gap-2 border-b pb-3">
              <Mail className="size-4 text-primary" />
              <h2 className="text-sm font-bold">محتوى الرسالة</h2>
            </div>

            {m.body ? (
              <div className="whitespace-pre-wrap break-words text-sm leading-8 text-foreground md:text-base">
                {m.body}
              </div>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                لا يوجد نص داخل الرسالة.
              </p>
            )}
          </section>

          {/* Attachment */}
          {(m.file_path || m.sheet_url) && (
            <section className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
              <div className="mb-4 flex items-center gap-2">
                <FileSpreadsheet className="size-5 text-primary" />
                <h2 className="font-bold">المرفقات</h2>
              </div>

              <a
                href={m.sheet_url ? m.sheet_url.replace(/\/preview$/, "/edit") : `/sheet/${m.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-xl border bg-muted/40 p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <FileSpreadsheet className="size-6" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-semibold">
                    {m.file_name ?? "Google Sheet"}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {m.sheet_url ? "فتح في جوجل شيت" : "فتح المرفق"}
                  </span>
                </span>

                <ExternalLink className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              </a>
            </section>
          )}

          <p className="pb-4 text-center text-xs text-muted-foreground">
            نهاية الرسالة · بريد بستطهالك
          </p>
        </div>
      </main>
    </div>
  );
    }
            
