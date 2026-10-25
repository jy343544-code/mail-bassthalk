import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/identity";

export type Person = { id: string; full_name: string; username: string; role: AppRole | null; must_change_password: boolean };

export async function fetchPeople(): Promise<Person[]> {
  const [{ data: profiles }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("user_roles").select("user_id, role"),
  ]);
  return (profiles ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    username: p.username,
    must_change_password: p.must_change_password,
    role: (roles?.find((r) => r.user_id === p.id)?.role as AppRole) ?? null,
  }));
}

export async function fetchMessages() {
  const { data, error } = await supabase
    .from("messages")
    .select("*, message_recipients(recipient_id, read_at)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
