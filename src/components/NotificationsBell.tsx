import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** Unread counter + live alerts (in-app toast and, if allowed, a system notification) for new messages. */
export function NotificationsBell({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");

  const unread = useQuery({
    queryKey: ["unread", userId],
    queryFn: async () => {
      const { count } = await supabase
        .from("message_recipients")
        .select("message_id", { count: "exact", head: true })
        .eq("recipient_id", userId)
        .is("read_at", null);
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  useEffect(() => {
    const ch = supabase
      .channel(`notify-${userId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_recipients", filter: `recipient_id=eq.${userId}` },
        async (payload) => {
          const id = (payload.new as { message_id: string }).message_id;
          qc.invalidateQueries({ queryKey: ["unread"] });
          qc.invalidateQueries({ queryKey: ["messages"] });
          const { data } = await supabase.from("messages").select("subject").eq("id", id).maybeSingle();
          const title = "رسالة جديدة";
          const body = data?.subject ?? "";
          toast(title, {
            description: body,
            action: { label: "فتح", onClick: () => navigate({ to: "/inbox/$id", params: { id } }) },
          });
          if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
            const n = new Notification(title, { body, tag: id });
            n.onclick = () => {
              window.focus();
              navigate({ to: "/inbox/$id", params: { id } });
            };
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "message_recipients", filter: `recipient_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["unread"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc, navigate]);

  const n = unread.data ?? 0;
  const onClick = async () => {
    if (perm === "default" && typeof Notification !== "undefined") {
      const p = await Notification.requestPermission();
      setPerm(p);
      if (p === "granted") toast.success("تم تفعيل تنبيهات المتصفح");
    }
    navigate({ to: "/inbox" });
  };

  return (
    <button
      onClick={onClick}
      aria-label={`التنبيهات: ${n} غير مقروءة`}
      title={perm === "default" ? "اضغط لتفعيل التنبيهات" : "الرسائل غير المقروءة"}
      className="relative grid size-8 place-items-center rounded-full hover:bg-primary-foreground/15"
    >
      {n > 0 ? <BellRing className="size-4" /> : <Bell className="size-4" />}
      {n > 0 && (
        <span className="absolute -top-0.5 -left-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          {n > 99 ? "99+" : n}
        </span>
      )}
    </button>
  );
}
