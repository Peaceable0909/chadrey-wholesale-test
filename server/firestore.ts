import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "./firebaseAdmin";

export const FIRESTORE_COLLECTIONS = {
  users: "users",
  products: "products",
  quoteRequests: "quoteRequests",
  quotations: "quotations",
  invoices: "invoices",
  payments: "payments",
  orders: "orders",
  messages: "messages",
  notifications: "notifications",
  deviceTokens: "deviceTokens",
} as const;

export type FirestoreCollection =
  (typeof FIRESTORE_COLLECTIONS)[keyof typeof FIRESTORE_COLLECTIONS];

let firestoreDb: Firestore | null = null;

export function getFirestoreDb() {
  if (!firestoreDb) firestoreDb = getFirestore(getFirebaseAdminApp());
  return firestoreDb;
}

export function documentPath(collection: FirestoreCollection, id: string) {
  return `${collection}/${id}`;
}

export async function getFirestoreDocument<T>(
  collection: FirestoreCollection,
  id: string
): Promise<T | null> {
  const snapshot = await getFirestoreDb().collection(collection).doc(id).get();
  return snapshot.exists ? (snapshot.data() as T) : null;
}

export async function setFirestoreDocument<T extends Record<string, unknown>>(
  collection: FirestoreCollection,
  id: string,
  value: T,
  merge = true
) {
  await getFirestoreDb().collection(collection).doc(id).set(value, { merge });
}
