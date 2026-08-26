export function parseAdminFirebaseUids(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map(uid => uid.trim())
    .filter(Boolean);
}

export function isFirebaseAdminUid(uid: string, configuredUids: string[]): boolean {
  return configuredUids.includes(uid);
}
