/**
 * Unit tests: URL utilities used for Ollama endpoint configuration
 *
 * The completePath function is the single point where Ollama's base URL is
 * assembled.  Getting this wrong results in silent connection failures because
 * the error surfaces as a network error, not a configuration error.
 *
 * Additional coverage for:
 * - generateSignature / verifySignature (used in proxy mode Authorization header)
 * - multiApiKeyPolling (not applicable to Ollama but should not break when empty)
 */

import { completePath } from "@/utils/url";
import { generateSignature, verifySignature } from "@/utils/signature";
import { multiApiKeyPolling } from "@/utils/model";
import { OLLAMA_BASE_URL } from "@/constants/urls";

// ---------------------------------------------------------------------------
// completePath — Ollama-specific scenarios
// ---------------------------------------------------------------------------

describe("completePath — Ollama URL assembly", () => {
  describe("default Ollama base URL (http://localhost:11434)", () => {
    it("assembles the correct API URL from the default", () => {
      const result = completePath(OLLAMA_BASE_URL, "/api");
      expect(result).toBe("http://localhost:11434/api");
    });

    it("default base URL constant equals expected value", () => {
      expect(OLLAMA_BASE_URL).toBe("http://localhost:11434");
    });
  });

  describe("custom proxy URLs", () => {
    it("handles a custom hostname with port and no path", () => {
      expect(completePath("http://ollama-server:11434", "/api"))
        .toBe("http://ollama-server:11434/api");
    });

    it("handles HTTPS proxy", () => {
      expect(completePath("https://my-ollama-proxy.company.com", "/api"))
        .toBe("https://my-ollama-proxy.company.com/api");
    });

    it("handles a proxy that already has a path prefix", () => {
      // e.g. reverse proxy at /ollama
      expect(completePath("http://proxy.internal/ollama", "/api"))
        .toBe("http://proxy.internal/ollama/api");
    });

    it("does NOT append /api when the URL already ends with a version path", () => {
      // Some Ollama proxies expose versioned endpoints
      expect(completePath("http://proxy.internal/ollama/v1", "/api"))
        .toBe("http://proxy.internal/ollama/v1");
    });

    it("strips a trailing slash before appending the path", () => {
      expect(completePath("http://localhost:11434/", "/api"))
        .toBe("http://localhost:11434/api");
    });

    it("does not double-append /api", () => {
      // If the user already entered the full URL with /api
      expect(completePath("http://localhost:11434/api", "/api"))
        .toBe("http://localhost:11434/api");
    });
  });

  describe("edge cases", () => {
    it("returns the original string for a completely invalid URL", () => {
      const invalid = "not-a-url";
      expect(completePath(invalid, "/api")).toBe(invalid);
    });

    it("handles an empty path argument", () => {
      const result = completePath("http://localhost:11434", "");
      // Empty path → should return the origin
      expect(result).toBe("http://localhost:11434");
    });

    it("handles undefined path argument", () => {
      const result = completePath("http://localhost:11434");
      expect(result).toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// generateSignature / verifySignature
// — Used for Authorization header in Ollama proxy mode
// ---------------------------------------------------------------------------

describe("generateSignature", () => {
  it("returns a non-empty string", () => {
    const sig = generateSignature("secret", Date.now());
    expect(sig.length).toBeGreaterThan(0);
  });

  it("returns a consistent signature for the same inputs", () => {
    const ts = 1700000000000;
    const sig1 = generateSignature("key", ts);
    const sig2 = generateSignature("key", ts);
    expect(sig1).toBe(sig2);
  });

  it("returns different signatures for different keys", () => {
    const ts = 1700000000000;
    expect(generateSignature("key1", ts)).not.toBe(generateSignature("key2", ts));
  });

  it("is insensitive to sub-second timestamp differences (uses first 8 digits)", () => {
    // The implementation truncates timestamp to 8 digits, so timestamps within
    // the same ~10-second window produce the same signature
    const base = 1700000012345;
    const nearBy = 1700000019999; // same 8-digit prefix
    expect(generateSignature("key", base)).toBe(generateSignature("key", nearBy));
  });

  it("returns an MD5 hex string (32 hex characters)", () => {
    const sig = generateSignature("secret", 1700000000000);
    expect(sig).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("verifySignature", () => {
  it("returns true for a valid signature", () => {
    const ts = 1700000000000;
    const sig = generateSignature("mypassword", ts);
    expect(verifySignature(sig, "mypassword", ts)).toBe(true);
  });

  it("returns false for a tampered signature", () => {
    const ts = 1700000000000;
    const sig = generateSignature("mypassword", ts);
    expect(verifySignature(sig + "X", "mypassword", ts)).toBe(false);
  });

  it("returns false for a wrong key", () => {
    const ts = 1700000000000;
    const sig = generateSignature("correctpassword", ts);
    expect(verifySignature(sig, "wrongpassword", ts)).toBe(false);
  });

  it("handles empty signature gracefully", () => {
    expect(verifySignature("", "key", 1700000000000)).toBe(false);
  });

  it("handles undefined signature gracefully", () => {
    expect(verifySignature(undefined, "key", 1700000000000)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// multiApiKeyPolling — Ollama has no API key; empty string must not throw
// ---------------------------------------------------------------------------

describe("multiApiKeyPolling — Ollama has no key", () => {
  it("returns a string (possibly empty) for an empty key list", () => {
    const result = multiApiKeyPolling("");
    expect(typeof result).toBe("string");
  });

  it("does not throw for undefined input", () => {
    expect(() => multiApiKeyPolling(undefined as unknown as string)).not.toThrow();
  });

  it("returns one of the provided keys when multiple are present", () => {
    const result = multiApiKeyPolling("key1,key2,key3");
    expect(["key1", "key2", "key3"]).toContain(result);
  });

  it("returns the single key when only one key is present", () => {
    // With a single key, shuffle still returns it
    const result = multiApiKeyPolling("onlykey");
    expect(result).toBe("onlykey");
  });
});
