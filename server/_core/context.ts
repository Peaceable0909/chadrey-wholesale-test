import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { createClient } from "@supabase/supabase-js";
import type { User } from "../../drizzle/schema";
import { getUserByOpenId, upsertUser } from "../db";
import { ENV } from "./env";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

function getBearerToken(req: CreateExpressContextOptions["req"]) {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
}

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;
  const token = getBearerToken(opts.req);

  if (token && ENV.supabaseUrl && ENV.supabaseAnonKey) {
    try {
      const supabase = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: authData, error: authError } = await supabase.auth.getUser(token);
      if (authError || !authData.user) throw authError ?? new Error("Supabase user was not returned.");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id,email,name,role,company_name,phone,whatsapp")
        .eq("id", authData.user.id)
        .maybeSingle();
      if (profileError) throw profileError;

      const name = profile?.name ?? authData.user.user_metadata?.full_name ?? authData.user.email ?? "Chadrey customer";
      const role = profile?.role === "admin" ? "admin" : "user";
      const existing = await getUserByOpenId(authData.user.id);
      await upsertUser({
        openId: authData.user.id,
        email: authData.user.email ?? profile?.email ?? null,
        name,
        loginMethod: "supabase",
        role,
        companyName: profile?.company_name ?? null,
        phone: profile?.phone ?? null,
        whatsapp: profile?.whatsapp ?? null,
      });
      user = existing
        ? { ...existing, email: authData.user.email ?? existing.email, name, role, loginMethod: "supabase" }
        : (await getUserByOpenId(authData.user.id)) ?? null;
    } catch {
      user = null;
    }
  }

  return { req: opts.req, res: opts.res, user };
}
