export function base64UrlEncode(input: Uint8Array) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function sha256Base64Url(input: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return base64UrlEncode(new Uint8Array(hash));
}

export function randomVerifier(len = 64) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return base64UrlEncode(bytes);
}
