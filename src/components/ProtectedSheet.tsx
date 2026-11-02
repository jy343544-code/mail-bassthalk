import { useState } from "react";
import { ShieldCheck, Phone, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

type Sheet = { name: string; rows: string[][] };

function isPhone(val: string) {
  const clean = val.replace(/[\s\-()]/g, "");
  return /^(\+?\d{8,15})$/.test(clean);
}

export function ProtectedSheet({
  sheets,
  embedUrl,
  watermark,
}: {
  sheets?: Sheet[] | undefined;
  embedUrl?: string | null;
  messageId: string;
  userId: string;
  watermark: string;
}) {
  const [active, setActive] = useState(0);
  const [search, setSearch] = useState("");

  const sheet = sheets?.[active];

  const filteredRows = sheet?.rows.filter((row, idx) => {
    if (idx === 0) return true;
    if (!search.trim()) return true;
    return row.some((cell) => cell.toLowerCase().includes(search.toLowerCase()));
  });

  return (
    <div className="relative flex flex-col rounded-md border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/50 p-2.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" />
          <span>عرض آمن · مسموح القراءة والنسخ للاتصال</span>
        </div>
        {sheet && (
          <div className="relative w-full max-w-xs sm:w-64">
            <Search className="absolute right-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="بحث عن رقم أو اسم..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pr-8 text-xs"
            />
          </div>
        )}
      </div>

      {sheets && sheets.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b bg-background p-1.5">
          {sheets.map((s, i) => (
            <button
              key={s.name}
              onClick={() => setActive(i)}
              className={`shrink-0 rounded px-3 py-1 text-xs font-medium transition-colors ${
                i === active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="relative select-text overflow-auto">
        {sheet && (
          <div className="max-h-[75vh] overflow-auto" dir="ltr">
            <table className="w-full border-collapse text-sm">
              <tbody>
                {filteredRows?.map((r, i) => (
                  <tr key={i} className={i === 0 ? "sticky top-0 bg-secondary font-semibold" : "hover:bg-muted/40 even:bg-muted/20"}>
                    <td className="border bg-muted/60 px-2.5 py-1.5 text-center text-xs text-muted-foreground select-none">
                      {i === 0 ? "#" : i}
                    </td>
                    {r.map((c, j) => {
                      const isNumber = isPhone(c);
                      return (
                        <td key={j} className="whitespace-nowrap border px-3 py-2">
                          {isNumber ? (
                            <a
                              href={`tel:${c.replace(/[\s\-()]/g, "")}`}
                              className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                              title="اضغط للاتصال أو حدد لنسخ الرقم"
                            >
                              <Phone className="size-3 opacity-70" />
                              <span>{c}</span>
                            </a>
                          ) : (
                            <span>{c}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredRows?.length === 0 && (
              <p className="p-8 text-center text-sm text-muted-foreground">لا توجد نتائج مطابقة للبحث</p>
            )}
          </div>
        )}

        {embedUrl && (
          <iframe
            src={embedUrl}
            title="Google Sheet"
            sandbox="allow-scripts allow-same-origin"
            referrerPolicy="no-referrer"
            className="h-[75vh] w-full border-0"
          />
        )}

        <div className="pointer-events-none absolute inset-0 grid grid-cols-2 content-around gap-12 overflow-hidden opacity-[0.04] md:grid-cols-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="-rotate-12 whitespace-nowrap text-center text-sm font-bold text-foreground">
              {watermark}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
        }
