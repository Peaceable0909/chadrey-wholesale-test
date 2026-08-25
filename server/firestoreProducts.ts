import { FieldValue } from "firebase-admin/firestore";
import type { Product } from "../drizzle/schema";
import { getFirestoreDb, FIRESTORE_COLLECTIONS } from "./firestore";

export type FirestoreProductDocument = {
  slug: string;
  name: string;
  description: string;
  category: string;
  moq: number;
  colors: string[];
  sizes: string[];
  packagingOptions: string[];
  customizationOptions: string[];
  images?: string[] | null;
  primaryImage?: string | null;
  isActive?: boolean;
  createdAt?: Date | { toDate: () => Date };
};

function asDate(value: FirestoreProductDocument["createdAt"]) {
  if (!value) return new Date(0);
  return value instanceof Date ? value : value.toDate();
}

export function mapFirestoreProduct(id: string, value: FirestoreProductDocument): Product {
  const images = value.images ?? [];
  const orderedImages = value.primaryImage && images.includes(value.primaryImage)
    ? [value.primaryImage, ...images.filter(image => image !== value.primaryImage)]
    : images;

  return {
    id: Number.isFinite(Number(id)) ? Number(id) : 0,
    slug: value.slug,
    name: value.name,
    description: value.description,
    category: value.category,
    moq: value.moq,
    colors: value.colors ?? [],
    sizes: value.sizes ?? [],
    packagingOptions: value.packagingOptions ?? [],
    customizationOptions: value.customizationOptions ?? [],
    images: orderedImages.length ? orderedImages : null,
    isActive: value.isActive === false ? 0 : 1,
    createdAt: asDate(value.createdAt),
  };
}

export async function createFirestoreProduct(input: {
  slug: string;
  name: string;
  description: string;
  category: string;
  moq: number;
  colors: string[];
  sizes: string[];
  packagingOptions: string[];
  customizationOptions: string[];
  images: string[];
  primaryImage: string;
  createdByUid: string;
}) {
  const ref = getFirestoreDb().collection(FIRESTORE_COLLECTIONS.products).doc(input.slug);
  await ref.create({
    ...input,
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function listFirestoreProducts(): Promise<Product[]> {
  const snapshot = await getFirestoreDb()
    .collection(FIRESTORE_COLLECTIONS.products)
    .where("isActive", "==", true)
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map(doc =>
    mapFirestoreProduct(doc.id, doc.data() as FirestoreProductDocument)
  );
}
