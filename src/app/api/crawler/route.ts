import { NextResponse, type NextRequest } from "next/server";

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB

function isPrivateHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  // Loopback / localhost / IPv6 loopback
  if (host === "localhost" || host === "::1") return true;

  // IPv6 link-local (fe80::/10) and ULA (fc00::/7)
  if (/^fe[89ab][0-9a-f]/i.test(host) || /^f[cd][0-9a-f]{2}/i.test(host))
    return true;

  // IPv4 private / reserved ranges
  const octs = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (octs) {
    const [a, b] = [Number(octs[1]), Number(octs[2])];
    return (
      a === 0 || // 0.0.0.0/8
      a === 10 || // 10.0.0.0/8 (private)
      a === 127 || // 127.0.0.0/8 (loopback)
      (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 (CGNAT)
      (a === 169 && b === 254) || // 169.254.0.0/16 (link-local / cloud metadata)
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 (private)
      (a === 192 && b === 168) || // 192.168.0.0/16 (private)
      (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15 (benchmarking)
      a >= 224 // 224.0.0.0/4+ (multicast & reserved)
    );
  }

  return false;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) throw new Error("Missing parameters!");

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("Invalid URL");
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Only http and https URLs are allowed");
    }

    if (isPrivateHost(parsed.hostname)) {
      throw new Error("Requests to private or reserved addresses are not allowed");
    }

    const response = await fetch(parsed.href, {
      signal: AbortSignal.timeout(10_000),
    });

    // Reject oversized responses early if Content-Length is present
    const contentLength = Number(response.headers.get("content-length") ?? NaN);
    if (!isNaN(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
      throw new Error("Response too large");
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Response too large");
      }
      chunks.push(value);
    }

    const merged = new Uint8Array(totalBytes);
    let pos = 0;
    for (const chunk of chunks) {
      merged.set(chunk, pos);
      pos += chunk.byteLength;
    }
    const result = new TextDecoder().decode(merged);

    const titleMatch = result.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";

    return NextResponse.json({ url, title, content: result });
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return NextResponse.json(
        { code: 500, message: error.message },
        { status: 500 }
      );
    }
  }
}
