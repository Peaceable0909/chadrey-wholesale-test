import { doc, getDoc, setDoc } from "firebase/firestore";
import type { User as FirebaseUser } from "firebase/auth";
import { firestore } from "@/lib/firebase";

export type FirebaseProfile = {
  uid: string;
  name: string;
  email: string | null;
  role: "admin" | "user";
};

export function profileFromFirebaseUser(user: FirebaseUser, role: "admin" | "user" = "user"): FirebaseProfile {
  return {
    uid: user.uid,
    name: user.displayName || user.email || "Chadrey customer",
    email: user.email,
    role,
  };
}

export async function getOrCreateFirebaseProfile(user: FirebaseUser): Promise<FirebaseProfile> {
  const profileRef = doc(firestore(), "users", user.uid);
  const snapshot = await getDoc(profileRef);
  if (snapshot.exists()) {
    const data = snapshot.data();
    return profileFromFirebaseUser(user, data.role === "admin" ? "admin" : "user");
  }

  const profile = profileFromFirebaseUser(user);
  await setDoc(profileRef, {
    uid: profile.uid,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  return profile;
}
