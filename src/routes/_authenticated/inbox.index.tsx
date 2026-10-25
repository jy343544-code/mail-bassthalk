import { createFileRoute } from "@tanstack/react-router";
import { MailOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inbox/")({
  component: () => (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <MailOpen className="size-14 stroke-1" />
      <p>اختار رسالة لعرضها</p>
    </div>
  ),
});
