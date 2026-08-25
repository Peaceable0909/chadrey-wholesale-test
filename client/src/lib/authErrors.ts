export function formatFirebaseAuthError(caught: unknown) {
  if (!(caught instanceof Error)) return "Unable to authenticate.";
  return caught.message.replace(/^Firebase:\s*/i, "").replace(/\s*\([^)]*\)\.?$/, "");
}
