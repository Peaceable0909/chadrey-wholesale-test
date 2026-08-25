import { applicationDefault, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth, type DecodedIdToken } from "firebase-admin/auth";
import type { Request } from "express";

let adminApp: App | null = null;
let adminAuth: Auth | null = null;

function getFirebaseAdminApp(): App {
  if (adminApp) return adminApp;

  adminApp =
    getApps()[0] ??
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID ?? "chadrey-wholesale",
    });

  return adminApp;
}

export function getFirebaseAdminAuth(): Auth {
  if (!adminAuth) adminAuth = getAuth(getFirebaseAdminApp());
  return adminAuth;
}

export function getBearerToken(request: Pick<Request, "headers">) {
  const value = request.headers.authorization;
  if (!value?.startsWith("Bearer ")) return null;
  const token = value.slice("Bearer ".length).trim();
  return token || null;
}

export async function verifyFirebaseRequest(
  request: Pick<Request, "headers">
): Promise<DecodedIdToken | null> {
  const token = getBearerToken(request);
  if (!token) return null;

  return getFirebaseAdminAuth().verifyIdToken(token);
}
