export function pickApiKey(userKey?: string): string {
  if (userKey && userKey.trim().length > 0) return userKey.trim();
  throw new Error('Missing BYOK header');
}
