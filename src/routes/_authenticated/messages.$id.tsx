import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { ArrowRight, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { deleteMessage, getSheet } from "@/lib/mail.functions";
import { fetchPeople } from "@/lib/queries";
import { isStaff } from "@/lib/me";
import { ProtectedSheet } from "@/components/ProtectedSheet";
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

export const Route = createFileRoute("/_authenticated/messages/$id")({
  head: () => ({ meta: [{ title: "رسالة | بريد بستطهالك" }] }),
  component: MessagePage,
});

function MessagePage() {
  const { id } = Route.useParams();
  const { me } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const msg = useQuery({
    queryKey: ["message", id],
    queryFn: async () => {
      const { data } = await supabase.from("messages").select("*").eq("id", id).maybeSingle();
      return data;
    },
    refetchInterval: 15000,
  });
  const people = useQuery({ queryKey: ["people"], queryFn: fetchPeople });
  const sheet = useQuery({
    queryKey: ["sheet", id],
    queryFn: () => getSheet({ data: { id } }),
    enabled: !!msg.data?.file_path,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!msg.data) return;
    supabase
      .from("message_recipients")
      .update({ read_at: new Date().toISOString() })
      .eq("message_id", id)
      .eq("recipient_id", me.id)
      .is("read_at", null)
      .then(() => qc.invalidateQueries({ queryKey: ["messages"] }));
  }, [msg.data, id, me.id, qc]);

  if (msg.isLoading) return <p className="text-muted-foreground">جاري التحميل...</p>;
  if (!msg.data)
    return (
      <div className="mx-auto max-w-md rounded-2xl border bg-card p-10 text-center">
        <p className="text-lg">الرسالة دي اتمسحت أو مش متاحة ليك.</p>
        <Button asChild className="mt-4">
          <Link to="/inbox">رجوع للرسائل</Link>
        </Button>
      </div>
    );

  const m = msg.data;
  const sender = people.data?.find((p) => p.id === m.sender_id)?.full_name;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/inbox" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <ArrowRight className="size-4" /> الرسائل
          </Link>
          <h1 className="text-3xl text-primary">{m.subject}</h1>
          <p className="text-sm text-muted-foreground">
            من {sender ?? "—"} · {new Date(m.created_at).toLocaleString("ar-EG")}
          </p>
        </div>
        {isStaff(me.role) && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                <Trash2 className="size-4" /> مسح الرسالة
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>مسح الرسالة نهائيًا؟</AlertDialogTitle>
                <AlertDialogDescription>
                  الرسالة والشيت هيتشالوا من عند كل المستلمين ومش هينفع ترجعهم.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    try {
                      await deleteMessage({ data: { id } });
                      toast.success("تم مسح الرسالة");
                      qc.invalidateQueries({ queryKey: ["messages"] });
                      navigate({ to: "/inbox" });
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  مسح
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {m.body && <p className="whitespace-pre-wrap rounded-2xl border bg-card p-5 leading-8">{m.body}</p>}

      {m.file_path && sheet.isLoading && <p className="text-muted-foreground">جاري فتح الشيت...</p>}
      {sheet.error && <p className="text-destructive">{(sheet.error as Error).message}</p>}
      {(sheet.data || m.sheet_url) && (
        <ProtectedSheet
          sheets={sheet.data?.sheets}
          embedUrl={m.sheet_url}
          messageId={m.id}
          userId={me.id}
          watermark={`${me.username} · ${new Date().toLocaleDateString("ar-EG")}`}
        />
      )}
    </div>
  );
}
