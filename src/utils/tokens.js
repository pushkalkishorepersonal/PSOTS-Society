export function generateSessionId() {
  return crypto.randomUUID() + '-' + Date.now().toString(36);
}
