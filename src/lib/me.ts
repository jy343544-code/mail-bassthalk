import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/identity";

export type Me = {
  id: string;
  fullName: string;
  username: string;
  role: AppRole;
  mustChange: boolean;
};

export async function loadMe(userId: string): Promise<Me | null> {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (!profile || !roles?.length) return null;
  const order: AppRole[] = ["supervisor", "manager", "employee"];
  const role = order.find((r) => roles.some((x) => x.role === r)) ?? "employee";
  return {
    id: profile.id,
    fullName: profile.full_name,
    username: profile.username,
    role,
    mustChange: profile.must_change_password,
  };
}

export const isStaff = (r: AppRole) => r === "supervisor" || r === "manager";
