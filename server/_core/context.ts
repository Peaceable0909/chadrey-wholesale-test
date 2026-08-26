import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getUserByOpenId, upsertUser } from "../db";
import { verifyFirebaseRequest } from "../firebaseAdmin";
import { sdk } from "./sdk";
import { ENV } from "./env";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // Firebase is the forward-looking authentication boundary. The existing
  // database user shape is retained temporarily so current procedures remain
  // type-compatible while Firestore repositories are introduced.
  try {
    const firebaseUser = await verifyFirebaseRequest(opts.req);
    if (firebaseUser) {
      const allowlistedAdmin = ENV.firebaseAdminUids.includes(firebaseUser.uid);
      user = (await getUserByOpenId(firebaseUser.uid)) ?? null;
      if (!user) {
        await upsertUser({
          openId: firebaseUser.uid,
          email: firebaseUser.email ?? null,
          name: firebaseUser.name ?? firebaseUser.email ?? "Chadrey customer",
          loginMethod: "firebase",
          role: allowlistedAdmin ? "admin" : "user",
        });
        user = (await getUserByOpenId(firebaseUser.uid)) ?? null;
      } else if (allowlistedAdmin && user.role !== "admin") {
        await upsertUser({
          openId: user.openId,
          email: user.email,
          name: user.name,
          loginMethod: "firebase",
          role: "admin",
        });
        user = { ...user, role: "admin", loginMethod: "firebase" };
      }
    }
  } catch (error) {
    // Invalid or unavailable Firebase credentials fall through to the legacy
    // session during the migration; public procedures remain anonymous.
  }

  if (!user) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
