import { FieldValue } from "firebase-admin/firestore";
import { FIRESTORE_COLLECTIONS, getFirestoreDb } from "./firestore";

export type FirestoreQuoteItem = {
  productId: string;
  quantity: number;
  color: string;
  size: string;
  packaging: string;
  customization: string;
  note?: string;
};

export type FirestoreQuoteRequest = {
  ownerUid: string;
  ref: string;
  status: "pending" | "quoted" | "accepted" | "declined" | "rejected" | "cancelled";
  notes: string | null;
  items: FirestoreQuoteItem[];
  createdAt: FieldValue;
  updatedAt: FieldValue;
};

export function buildFirestoreQuoteDocument(input: {
  ownerUid: string;
  ref: string;
  notes?: string;
  items: FirestoreQuoteItem[];
}): Omit<FirestoreQuoteRequest, "createdAt" | "updatedAt"> {
  return {
    ownerUid: input.ownerUid,
    ref: input.ref,
    status: "pending",
    notes: input.notes ?? null,
    items: input.items,
  };
}

export async function createFirestoreQuote(input: {
  ownerUid: string;
  ref: string;
  notes?: string;
  items: FirestoreQuoteItem[];
}) {
  const ref = getFirestoreDb().collection(FIRESTORE_COLLECTIONS.quoteRequests).doc();
  await ref.set({
    ...buildFirestoreQuoteDocument(input),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function getFirestoreQuote(id: string) {
  const snapshot = await getFirestoreDb()
    .collection(FIRESTORE_COLLECTIONS.quoteRequests)
    .doc(id)
    .get();
  return snapshot.exists ? (snapshot.data() as FirestoreQuoteRequest) : null;
}

export async function listFirestoreCustomerQuotes(ownerUid: string) {
  const snapshot = await getFirestoreDb()
    .collection(FIRESTORE_COLLECTIONS.quoteRequests)
    .where("ownerUid", "==", ownerUid)
    .orderBy("createdAt", "desc")
    .get();
  return snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
}

export async function listFirestoreAdminQuotes() {
  const snapshot = await getFirestoreDb()
    .collection(FIRESTORE_COLLECTIONS.quoteRequests)
    .orderBy("createdAt", "desc")
    .get();
  return snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
}
