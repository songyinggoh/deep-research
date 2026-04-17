const BUCKET_MS = 100_000; // 100-second window — matches previous MD5 bucket behaviour

async function hmacSha256(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", keyMaterial, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function generateSignature(
  key: string,
  timestamp: number
): Promise<string> {
  return hmacSha256(key, String(Math.floor(timestamp / BUCKET_MS)));
}

export async function verifySignature(
  signature = "",
  key: string,
  timestamp: number
): Promise<boolean> {
  const bucket = Math.floor(timestamp / BUCKET_MS);
  for (const b of [bucket - 1, bucket, bucket + 1]) {
    if (signature === (await hmacSha256(key, String(b)))) return true;
  }
  return false;
}
