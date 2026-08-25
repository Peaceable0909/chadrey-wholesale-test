import { describe, expect, it } from "vitest";
import { buildFirebaseConfig, isFirebaseConfigured, isGoogleSignInAvailable } from "./firebase";

describe("Firebase web configuration", () => {
  it("maps the Firebase web settings to the SDK configuration shape", () => {
    const config = buildFirebaseConfig({
      VITE_FIREBASE_API_KEY: "test-api-key",
      VITE_FIREBASE_AUTH_DOMAIN: "example.firebaseapp.com",
      VITE_FIREBASE_PROJECT_ID: "example",
      VITE_FIREBASE_STORAGE_BUCKET: "example.firebasestorage.app",
      VITE_FIREBASE_MESSAGING_SENDER_ID: "123456789",
      VITE_FIREBASE_APP_ID: "1:123456789:web:test",
      VITE_FIREBASE_MEASUREMENT_ID: "G-TEST",
    });

    expect(config).toEqual({
      apiKey: "test-api-key",
      authDomain: "example.firebaseapp.com",
      projectId: "example",
      storageBucket: "example.firebasestorage.app",
      messagingSenderId: "123456789",
      appId: "1:123456789:web:test",
      measurementId: "G-TEST",
    });
    expect(isFirebaseConfigured(config)).toBe(true);
  });

  it("exposes Google sign-in only when Firebase is fully configured", () => {
    const complete = buildFirebaseConfig({
      VITE_FIREBASE_API_KEY: "key",
      VITE_FIREBASE_AUTH_DOMAIN: "project.firebaseapp.com",
      VITE_FIREBASE_PROJECT_ID: "project",
      VITE_FIREBASE_STORAGE_BUCKET: "project.firebasestorage.app",
      VITE_FIREBASE_MESSAGING_SENDER_ID: "123",
      VITE_FIREBASE_APP_ID: "app",
    });
    expect(isGoogleSignInAvailable(complete)).toBe(true);
    expect(isGoogleSignInAvailable(buildFirebaseConfig({ VITE_FIREBASE_PROJECT_ID: "project" }))).toBe(false);
  });

  it("does not treat missing required values as configured", () => {
    expect(
      isFirebaseConfigured(
        buildFirebaseConfig({
          VITE_FIREBASE_PROJECT_ID: "example",
        })
      )
    ).toBe(false);
  });
});
