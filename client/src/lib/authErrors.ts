export function formatAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "The email or password is incorrect.";
  if (normalized.includes("email not confirmed")) return "Please confirm your email address before signing in.";
  if (normalized.includes("user already registered")) return "An account with this email already exists. Try signing in instead.";
  if (normalized.includes("password should be at least")) return "Choose a password with at least 6 characters.";
  if (normalized.includes("provider") || normalized.includes("oauth")) return "Google sign-in could not be completed. Please try again.";
  return message || "Authentication could not be completed. Please try again.";
}

export const formatFirebaseAuthError = formatAuthError;
