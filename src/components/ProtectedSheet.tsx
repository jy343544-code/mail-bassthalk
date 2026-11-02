
import { useState } from "react";
import {
  ShieldCheck,
  Phone,
  Search,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { Input } from "@/components/ui/input";

type Sheet = {
  name: string;
  rows: string[][];
};

function isPhone(val: string) {
  const clean = val.replace(/[\s\-()]/g, "");
  return /^(\+?\d{8,15})$/.test(clean);
}

export function ProtectedSheet({
  sheets,
  embedUrl,
  watermark,
}: {
  sheets?: Sheet[];
  embedUrl?: string | null;
  messageId: string;
  userId: string;
  watermark: string;
}) {
  const [active, setActive] = useState(0);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState("");

  const sheet = sheets?.[active];

  const filteredRows = sheet?.rows.filter((row, idx) => {
    if (idx === 0) return true;
    if (!search.trim()) return true;

    return row.some((cell) =>
      cell.toLowerCase().includes(search.toLowerCase())
    );
  });

  const openFullSheet = () => {
    if (!embedUrl) return;

    window.open(
      embedUrl,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const copyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(phone);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setCopied("");
    }
  };

  return (
    <div className="relative flex flex-col rounded-md border bg-card shadow-sm">

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/50 p-3">

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" />
          <span>عرض آمن · مسموح القراءة والنسخ والاتصال</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">

          {embedUrl && (
            <button
              type="button"
              onClick={openFullSheet}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <ExternalLink className="size-4" />
              فتح الشيت بالكامل
            </button>
          )}

          {sheet && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute right-2.5 top-2.5 size-3.5 text-muted-foreground" />

              <Input
                type="text"
                placeholder="بحث عن رقم أو اسم..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pr-8 text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* Sheet Tabs */}
      {sheets && sheets.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b bg-background p-2">
          {sheets.map((s, i) => (
            <button
              key={s.name}
              type="button"
              onClick={() => setActive(i)}
              className={`shrink-0 rounded px-3 py-2 text-xs font-medium ${
                i === active
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Sheet Content */}
      <div className="relative select-text overflow-auto">

        {sheet && (
          <div className="max-h-[75vh] overflow-auto" dir="ltr">

            <table className="w-full border-collapse text-sm">
              <tbody>
                {filteredRows?.map((row, i) => (
                  <tr
                    key={i}
                    className={
                      i === 0
                        ? "sticky top-0 bg-secondary font-semibold"
                        : "hover:bg-muted/40 even:bg-muted/20"
                    }
                  >
                    <td className="select-none border bg-muted/60 px-2.5 py-1.5 text-center text-xs text-muted-foreground">
                      {i === 0 ? "#" : i}
                    </td>

                    {row.map((cell, j) => {
                      const phone = isPhone(cell);
                      const cleanPhone = cell.replace(/[\s\-()]/g, "");

                      return (
                        <td
                          key={j}
                          className="whitespace-nowrap border px-3 py-2"
                        >
                          {phone ? (
                            <div className="flex items-center gap-3">

                              <a
                                href={`tel:${cleanPhone}`}
                                className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                                title="الاتصال بالرقم"
                              >
                                <Phone className="size-3" />
                                <span>{cell}</span>
                              </a>

                              <button
                                type="button"
                                onClick={() => copyPhone(cleanPhone)}
                                className="rounded p-1 hover:bg-muted"
                                title="نسخ الرقم"
                              >
                                {copied === cleanPhone ? (
                                  <Check className="size-4 text-green-500" />
                                ) : (
                                  <Copy className="size-4 text-muted-foreground" />
                                )}
                              </button>

                            </div>
                          ) : (
                            <span>{cell}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredRows?.length === 0 && (
              <p className="p-8 text-center text-sm text-muted-foreground">
                لا توجد نتائج مطابقة للبحث
              </p>
            )}
          </div>
        )}

        {/* Original embedded viewer */}
        {embedUrl && (
          <iframe
            src={embedUrl}
            title="Google Sheet"
            sandbox="allow-scripts allow-same-origin"
            referrerPolicy="no-referrer"
            className="h-[75vh] w-full border-0"
          />
        )}

        {!sheet && !embedUrl && (
          <p className="p-8 text-center text-muted-foreground">
            لا توجد بيانات متاحة للعرض
          </p>
        )}

        {/* Employee Watermark */}
        <div className="pointer-events-none absolute inset-0 grid grid-cols-2 content-around gap-12 overflow-hidden opacity-[0.04] md:grid-cols-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="-rotate-12 whitespace-nowrap text-center text-sm font-bold text-foreground"
            >
              {watermark}
            </span>
          ))}
        </div>

      </div>
    </div>
  );
    }
                
