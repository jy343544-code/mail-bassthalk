import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { ArrowRight, ExternalLink, FileSpreadsheet, Trash2 } from "lucide-react";
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

function MessagePage() {
  const { id } = Route.useParams();
  const { me } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const logged = useRef<string | null>(null);

  const msg = useQuery({
    queryKey: ["message", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("*, message_recipients(recipient_id, read_at)")
        .eq("id", id)
        .maybeSingle();
      return data;
    },
    refetchInterval: 15000,
  });
  const people = useQuery({ queryKey: ["people"], queryFn: fetchPeople });

  useEffect(() => {
    if (!msg.data || logged.current === id) return;
    logged.current = id;
    supabase.from("activity_log").insert({ actor_id: me.id, action: "view_message", message_id: id, details: { subject: msg.data.subject } }).then();
    supabase
      .from("message_recipients")
      .update({ read_at: new Date().toISOString() })
      .eq("message_id", id)
      .eq("recipient_id", me.id)
      .is("read_at", null)
      .then(() => qc.invalidateQueries({ queryKey: ["messages"] }));
  }, [msg.data, id, me.id, qc]);

  if (msg.isLoading) return <p className="p-6 text-muted-foreground">جاري التحميل...</p>;
  if (!msg.data)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg">الرسالة دي اتمسحت أو مش متاحة ليك.</p>
        <Button asChild variant="outline">
          <Link to="/inbox">رجوع للوارد</Link>
        </Button>
      </div>
    );

  const m = msg.data;
  const nameOf = (uid: string) => people.data?.find((p) => p.id === uid);
  const sender = nameOf(m.sender_id);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-card px-4 py-2">
        <Button asChild variant="ghost" size="sm" className="md:hidden">
          <Link to="/inbox">
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <div className="flex-1" />
        {isStaff(me.role) && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 text-destructive">
                <Trash2 className="size-4" /> حذف
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>حذف الرسالة نهائيًا؟</AlertDialogTitle>
                <AlertDialogDescription>
                  الرسالة والشيت هيتشالوا من عند كل المستلمين، والعملية هتتسجل في سجل العمليات.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction
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
                  حذف
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-auto p-4 md:p-6">
        <h1 className="text-2xl">{m.subject}</h1>
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
            {sender?.full_name?.[0] ?? "?"}
          </span>
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-semibold">
              {sender?.full_name ?? "—"}{" "}
              <span className="font-normal text-muted-foreground">{sender?.role && `(${roleLabel[sender.role]})`}</span>
            </div>
            <div className="text-muted-foreground">
              إلى: {m.message_recipients.map((r) => nameOf(r.recipient_id)?.full_name ?? "—").join("، ")}
            </div>
          </div>
          <time className="shrink-0 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("ar-EG")}</time>
        </div>

        {m.body && <p className="whitespace-pre-wrap leading-8">{m.body}</p>}

        {(m.file_path || m.sheet_url) && (
          <a
            href={`/sheet/${m.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border bg-muted px-4 py-3 text-sm hover:bg-accent"
          >
            <FileSpreadsheet className="size-5 text-primary" />
            <span className="font-medium">{m.file_name ?? "Google Sheet"}</span>
            <ExternalLink className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">فتح في تبويب جديد · عرض فقط</span>
          </a>
        )}
      </div>
    </div>
  );
}
