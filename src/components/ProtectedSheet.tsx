import { useEffect, useRef, useState } from "react";
import { EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Sheet = { name: string; rows: string[][] };

/**
 * Renders sheet data inside the page only. Blocks copy, right-click, printing and
 * common save/screenshot shortcuts, and logs suspected screenshots for the supervisor.
 */
export function ProtectedSheet({
  sheets,
  embedUrl,
  messageId,
  userId,
  watermark,
}: {
  sheets?: Sheet[];
  embedUrl?: string | null;
  messageId: string;
  userId: string;
  watermark: string;
}) {
  const [active, setActive] = useState(0);
  const [hidden, setHidden] = useState(false);
  const lastLog = useRef(0);

  useEffect(() => {
    const log = (kind: string) => {
      const now = Date.now();
      if (now - lastLog.current < 3000) return;
      lastLog.current = now;
      supabase.from("screenshot_events").insert({ user_id: userId, message_id: messageId, kind }).then();
    };
    const flash = () => {
      setHidden(true);
      setTimeout(() => setHidden(false), 2500);
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      if (k === "printscreen") {
        flash();
        log("زر تصوير الشاشة");
        navigator.clipboard?.writeText("").catch(() => {});
      } else if (e.metaKey && e.shiftKey && ["3", "4", "5", "s"].includes(k)) {
        flash();
        log("اختصار تصوير الشاشة");
      } else if (ctrl && e.shiftKey && k === "s") {
        e.preventDefault();
        flash();
        log("اختصار أداة القص");
      } else if (ctrl && ["s", "p", "c", "a"].includes(k)) {
        e.preventDefault();
        if (k !== "a" && k !== "c") log(k === "p" ? "محاولة طباعة" : "محاولة حفظ");
      }
    };
    const onBlur = () => setHidden(true);
    const onFocus = () => setHidden(false);
    const onVis = () => setHidden(document.visibilityState !== "visible");
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [messageId, userId]);

  const block = (e: React.SyntheticEvent) => e.preventDefault();
  const sheet = sheets?.[active];

  return (
    <div
      className="protected-view relative overflow-hidden rounded-2xl border bg-card"
      onContextMenu={block}
      onCopy={block}
      onCut={block}
      onDragStart={block}
    >
      {sheets && sheets.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b bg-muted p-2">
          {sheets.map((s, i) => (
            <button
              key={s.name}
              onClick={() => setActive(i)}
              className={`shrink-0 rounded-md px-3 py-1 text-sm ${i === active ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className={`transition ${hidden ? "blur-xl" : ""}`}>
        {sheet && (
          <div className="max-h-[70vh] overflow-auto" dir="ltr">
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
            className="h-[70vh] w-full"
          />
        )}
      </div>

      {/* watermark */}
      <div className="pointer-events-none absolute inset-0 grid grid-cols-3 content-around gap-8 overflow-hidden opacity-[0.08]">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className="-rotate-12 whitespace-nowrap text-center text-lg font-bold text-foreground">
            {watermark}
          </span>
        ))}
      </div>

      {hidden && (
        <div className="absolute inset-0 grid place-items-center bg-background/60">
          <div className="flex items-center gap-2 text-muted-foreground">
            <EyeOff className="size-5" /> المحتوى مخفي — ارجع للصفحة للعرض
          </div>
        </div>
      )}
    </div>
  );
}
