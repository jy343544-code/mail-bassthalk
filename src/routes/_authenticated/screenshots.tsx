import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ScanEye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchMessages, fetchPeople } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/screenshots")({
  head: () => ({ meta: [{ title: "سجل التصوير | بريد بستطهالك" }] }),
  beforeLoad: ({ context }) => {
    if (context.me.role !== "supervisor") throw redirect({ to: "/inbox" });
  },
  component: Screenshots,
});

function Screenshots() {
  const events = useQuery({
    queryKey: ["screenshots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("screenshot_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    refetchInterval: 20000,
  });
  const people = useQuery({ queryKey: ["people"], queryFn: fetchPeople });
  const messages = useQuery({ queryKey: ["messages"], queryFn: fetchMessages });

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl text-primary">سجل محاولات التصوير</h1>
      <p className="mt-1 text-sm text-muted-foreground">بيظهر هنا ليك إنت بس.</p>
      <div className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-soft">
        {events.data?.length === 0 && (
          <div className="flex flex-col items-center gap-3 p-12 text-muted-foreground">
            <ScanEye className="size-10" /> مفيش محاولات
          </div>
        )}
        {events.data?.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center gap-3 border-b p-4 last:border-0">
            <div className="flex-1">
              <div className="font-medium">{people.data?.find((p) => p.id === e.user_id)?.full_name ?? "—"}</div>
              <div className="text-sm text-muted-foreground">
                {e.kind}
                {e.message_id &&
                  ` · ${messages.data?.find((m) => m.id === e.message_id)?.subject ?? "رسالة محذوفة"}`}
              </div>
            </div>
            <time className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("ar-EG")}</time>
          </div>
        ))}
      </div>
    </div>
  );
}
