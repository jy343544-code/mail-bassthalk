import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSheet } from "@/lib/mail.functions";
import { ProtectedSheet } from "@/components/ProtectedSheet";

export const Route = createFileRoute("/_authenticated/sheet/$id")({
  head: () => ({ meta: [{ title: "عرض الشيت | بريد بستطهالك" }] }),
  component: SheetPage,
});

function SheetPage() {
  const { id } = Route.useParams();
  const { me } = Route.useRouteContext();
  const msg = useQuery({
    queryKey: ["message", id],
    queryFn: async () =>
      (await supabase.from("messages").select("id, subject, file_path, sheet_url").eq("id", id).maybeSingle()).data,
  });
  // Never cached: fetched fresh each open.
  const sheet = useQuery({
    queryKey: ["sheet", id],
    queryFn: () => getSheet({ data: { id } }),
    enabled: !!msg.data?.file_path,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  if (msg.isLoading) return <p className="p-6 text-muted-foreground">جاري التحميل...</p>;
  if (!msg.data) return <p className="p-6 text-lg">الشيت غير متاح أو تم حذفه.</p>;
  return (
    <div className="h-full space-y-4 overflow-auto p-4 md:p-6">
      <h1 className="text-xl">{msg.data.subject}</h1>
      {sheet.isLoading && <p className="text-sm text-muted-foreground">جاري فتح الشيت...</p>}
      {sheet.error && <p className="text-sm text-destructive">{(sheet.error as Error).message}</p>}
      {(sheet.data || msg.data.sheet_url) && (
        <ProtectedSheet
          sheets={sheet.data?.sheets}
          embedUrl={msg.data.sheet_url}
          messageId={id}
          userId={me.id}
          watermark={`${me.fullName} · @${me.username}`}
        />
      )}
    </div>
  );
}
