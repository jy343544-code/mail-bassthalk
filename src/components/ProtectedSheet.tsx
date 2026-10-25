import { useEffect, useRef, useState } from "react";
import { EyeOff, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Sheet = { name: string; rows: string[][] };

const IDLE_MS = 90_000;

/**
 * View-only sheet. Blocks copy/select/right-click/print/save, hides when the window
 * loses focus, the pointer leaves, dev tools open or the user goes idle, and logs
 * suspicious actions to the activity log (visible to the supervisor).
 */
export function ProtectedSheet({
  sheets,
  embedUrl,
  messageId,
  userId,
  watermark,
}: {
  sheets?: Sheet[] | undefined;
  embedUrl?: string | null;
  messageId: string;
  userId: string;
  watermark: string;
}) {
  const [active, setActive] = useState(0);
  const [reason, setReason] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const lastLog = useRef<Record<string, number>>({});
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const log = (action: string, detail: string) => {
      const t = Date.now();
      if (t - (lastLog.current[action] ?? 0) < 4000) return;
      lastLog.current[action] = t;
      supabase
        .from("activity_log")
        .insert({ actor_id: userId, action, message_id: messageId, details: { detail } })
        .then();
    };
    const hide = (r: string, ms = 2500) => {
      setReason(r);
      if (ms) setTimeout(() => setReason((cur) => (cur === r ? null : cur)), ms);
    };
    const resetIdle = () => {
      clearTimeout(idleTimer.current);
      setReason((cur) => (cur === "idle" ? null : cur));
      idleTimer.current = setTimeout(() => setReason("idle"), IDLE_MS);
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      if (k === "printscreen") {
        hide("shot");
        log("screenshot_attempt", "زر تصوير الشاشة");
        navigator.clipboard?.writeText("").catch(() => {});
      } else if (e.metaKey && e.shiftKey && ["3", "4", "5", "s"].includes(k)) {
        hide("shot");
        log("screenshot_attempt", "اختصار تصوير الشاشة");
      } else if (ctrl && e.shiftKey && k === "s") {
        e.preventDefault();
        hide("shot");
        log("screenshot_attempt", "أداة القص");
      } else if (k === "f12" || (ctrl && e.shiftKey && ["i", "j", "c"].includes(k)) || (ctrl && k === "u")) {
        e.preventDefault();
        hide("dev");
        log("devtools_attempt", "محاولة فتح أدوات المطور");
      } else if (ctrl && k === "p") {
        e.preventDefault();
        log("print_attempt", "محاولة طباعة");
      } else if (ctrl && k === "s") {
        e.preventDefault();
        log("save_attempt", "محاولة حفظ الصفحة");
      } else if (ctrl && (k === "c" || k === "x" || k === "a")) {
        e.preventDefault();
        if (k !== "a") log("copy_attempt", "محاولة نسخ");
      }
      resetIdle();
    };
    const onBlur = () => setReason("blur");
    const onFocus = () => setReason((cur) => (cur === "blur" ? null : cur));
    const onVis = () => (document.visibilityState === "visible" ? onFocus() : onBlur());
    const onPrint = () => log("print_attempt", "محاولة طباعة");
    const devCheck = setInterval(() => {
      const open = window.outerWidth - window.innerWidth > 200 || window.outerHeight - window.innerHeight > 250;
      if (open) {
        setReason("dev");
        log("devtools_attempt", "أدوات المطور مفتوحة");
      } else setReason((cur) => (cur === "dev" ? null : cur));
    }, 1500);
    const clock = setInterval(() => setNow(new Date()), 30_000);

    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("beforeprint", onPrint);
    window.addEventListener("mousemove", resetIdle);
    window.addEventListener("touchstart", resetIdle);
    document.addEventListener("visibilitychange", onVis);
    resetIdle();
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("beforeprint", onPrint);
      window.removeEventListener("mousemove", resetIdle);
      window.removeEventListener("touchstart", resetIdle);
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(devCheck);
      clearInterval(clock);
      clearTimeout(idleTimer.current);
    };
  }, [messageId, userId]);

  const block = (e: React.SyntheticEvent) => e.preventDefault();
  const sheet = sheets?.[active];
  const mark = `${watermark} · ${now.toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}`;
  const messages: Record<string, string> = {
    blur: "المحتوى مخفي — ارجع للصفحة للعرض",
    shot: "تصوير الشاشة غير مسموح — تم تسجيل المحاولة",
    dev: "اقفل أدوات المطور لعرض الشيت",
    idle: "تم الإخفاء لعدم النشاط — حرّك الماوس للعرض",
    leave: "قرّب الماوس للعرض",
  };

  return (
    <div
      className="protected-view relative overflow-hidden rounded-md border bg-card shadow-soft"
      onContextMenu={block}
      onCopy={block}
      onCut={block}
      onDragStart={block}
      onMouseLeave={() => setReason((c) => c ?? "leave")}
      onMouseEnter={() => setReason((c) => (c === "leave" ? null : c))}
    >
      <div className="flex items-center gap-2 border-b bg-muted px-3 py-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 text-primary" /> عرض محمي · ممنوع التنزيل والنسخ والتصوير
      </div>
      {sheets && sheets.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b p-1.5">
          {sheets.map((s, i) => (
            <button
              key={s.name}
              onClick={() => setActive(i)}
              className={`shrink-0 rounded px-3 py-1 text-xs ${i === active ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className={`transition duration-200 ${reason ? "blur-2xl" : ""}`}>
        {reason ? (
          <div className="h-[60vh]" />
        ) : (
          <>
            {sheet && (
              <div className="max-h-[65vh] overflow-auto" dir="ltr">
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    {sheet.rows.map((r, i) => (
                      <tr key={i} className={i === 0 ? "sticky top-0 bg-secondary font-semibold" : "even:bg-muted/50"}>
                        <td className="border bg-muted px-2 text-center text-xs text-muted-foreground">{i + 1}</td>
                        {r.map((c, j) => (
                          <td key={j} className="whitespace-nowrap border px-3 py-1.5">
                            {c}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sheet.rows.length === 0 && <p className="p-6 text-center text-muted-foreground">الشيت فاضي</p>}
              </div>
            )}
            {embedUrl && (
              <iframe
                src={embedUrl}
                title="Google Sheet"
                sandbox="allow-scripts allow-same-origin"
                referrerPolicy="no-referrer"
                className="h-[65vh] w-full"
              />
            )}
          </>
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 top-8 grid grid-cols-2 content-around gap-10 overflow-hidden opacity-[0.09] md:grid-cols-3">
        {Array.from({ length: 15 }).map((_, i) => (
          <span key={i} className="-rotate-12 whitespace-nowrap text-center text-sm font-bold text-foreground">
            {mark}
          </span>
        ))}
      </div>

      {reason && (
        <div className="absolute inset-0 top-8 grid place-items-center">
          <div className="flex items-center gap-2 rounded-md border bg-card px-4 py-2 text-sm text-muted-foreground shadow-soft">
            <EyeOff className="size-4" /> {messages[reason]}
          </div>
        </div>
      )}
    </div>
  );
}
