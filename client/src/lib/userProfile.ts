import type { User as SupabaseUser } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";

export type SupabaseProfile = {
  uid: string;
  name: string;
  email: string | null;
  role: "admin" | "user";
};

export function profileFromSupabaseUser(user: SupabaseUser, role: "admin" | "user" = "user"): SupabaseProfile {
  return {
    uid: user.id,
    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Chadrey customer",
    email: user.email ?? null,
    role,
  };
}

export async function getOrCreateSupabaseProfile(user: SupabaseUser): Promise<SupabaseProfile> {
  const client = getSupabaseClient();
  const fallback = profileFromSupabaseUser(user);
  const { data, error } = await client
    .from("profiles")
    .upsert({ id: user.id, email: fallback.email, name: fallback.name, last_signed_in: new Date().toISOString() }, { onConflict: "id" })
    .select("id,email,name,role")
    .single();
  if (error) throw error;
  return {
    uid: data.id,
    name: data.name || fallback.name,
    email: data.email ?? fallback.email,
    role: data.role === "admin" ? "admin" : "user",
  };
}
