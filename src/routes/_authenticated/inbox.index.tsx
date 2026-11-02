
import { createFileRoute, Link } from "@tanstack/react-router";
import { MailOpen, PenSquare, Inbox, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inbox/")({
  component: InboxHome,
});

function InboxHome() {
  return (
    <div className="flex h-full min-h-[65vh] items-center justify-center p-5">
      <div className="mx-auto w-full max-w-md text-center">
        <div className="relative mx-auto mb-6 grid size-24 place-items-center rounded-3xl bg-primary/10 text-primary">
          <MailOpen className="size-12 stroke-[1.5]" />
          <span className="absolute -bottom-2 -right-2 grid size-9 place-items-center rounded-xl border bg-card text-primary shadow-sm">
            <Inbox className="size-5" />
          </span>
        </div>

        <h1 className="text-2xl font-bold">مرحبًا بك في بريد بستطهالك</h1>

        <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-muted-foreground">
          اختر رسالة من القائمة لعرض تفاصيلها ومتابعة المراسلات مع فريق العمل.
          يمكنك أيضًا إنشاء رسالة جديدة وإرسالها إلى زملائك.
        </p>

        <Link
          to="/compose"
          className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
        >
          <PenSquare className="size-4" />
          إنشاء رسالة جديدة
        </Link>

        <div className="mt-9 flex items-center justify-center gap-2 border-t pt-5 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" />
          <span>مساحة مراسلات فريق العمل</span>
        </div>
      </div>
    </div>
  );
}
