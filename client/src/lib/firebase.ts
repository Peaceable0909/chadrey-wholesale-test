import { getAnalytics, isSupported as analyticsIsSupported } from "firebase/analytics";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

export function buildFirebaseConfig(
  source: Record<string, string | undefined>
): FirebaseConfig {
  return {
    apiKey: source.VITE_FIREBASE_API_KEY ?? "",
    authDomain: source.VITE_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: source.VITE_FIREBASE_PROJECT_ID ?? "",
    storageBucket: source.VITE_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: source.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: source.VITE_FIREBASE_APP_ID ?? "",
    measurementId: source.VITE_FIREBASE_MEASUREMENT_ID || undefined,
  };
}

export const firebaseConfig = buildFirebaseConfig(import.meta.env);

export function isFirebaseConfigured(config: FirebaseConfig = firebaseConfig) {
  return Boolean(
    config.apiKey &&
      config.authDomain &&
      config.projectId &&
      config.storageBucket &&
      config.messagingSenderId &&
      config.appId
  );
}

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase is not configured. Add the VITE_FIREBASE_* environment variables before using Firebase services."
    );
  }

  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

export const firebaseAuth = () => getAuth(getFirebaseApp());
export const firestore = () => getFirestore(getFirebaseApp());
export const firebaseStorage = () => getStorage(getFirebaseApp());

export async function firebaseAnalytics() {
  if (typeof window === "undefined" || !isFirebaseConfigured()) return null;
  if (!(await analyticsIsSupported())) return null;
  return getAnalytics(getFirebaseApp());
}
