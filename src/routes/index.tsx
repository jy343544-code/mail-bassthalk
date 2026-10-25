import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "بريد بستطهالك" },
      { name: "description", content: "البريد الداخلي الآمن لشركة بستطهالك" },
      { property: "og:title", content: "بريد بستطهالك" },
      { property: "og:description", content: "البريد الداخلي الآمن لشركة بستطهالك" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/inbox" });
  },
});
