/**
 * Unit tests: Ollama provider creation and URL configuration
 *
 * Tests the createAIProvider factory for the "ollama" branch, verifying that:
 * - The correct baseURL is assembled (custom proxy vs default)
 * - The custom fetch wrapper strips the Authorization header when talking
 *   directly to a local Ollama instance (not proxied through the app server)
 * - An unsupported provider name throws early
 *
 * All actual HTTP calls are intercepted by mocking `ollama-ai-provider` and
 * the global `fetch` — no live Ollama instance is required.
 */

// ---------------------------------------------------------------------------
// Mock the ollama-ai-provider ESM package before any imports resolve it
// ---------------------------------------------------------------------------
const mockOllamaInstance = jest.fn();
const mockCreateOllama = jest.fn().mockImplementation((opts: unknown) => {
  // Return a callable that records what settings were used
  const fn = (model: string, settings?: unknown) => ({
    __provider: "ollama",
    __model: model,
    __settings: settings,
    __opts: opts,
  });
  mockOllamaInstance(opts);
  return fn;
});

jest.mock("ollama-ai-provider", () => ({
  createOllama: mockCreateOllama,
}));

import { createAIProvider } from "@/utils/deep-research/provider";
import { completePath } from "@/utils/url";
import { OLLAMA_BASE_URL } from "@/constants/urls";

// ---------------------------------------------------------------------------
// Helper: create a minimal AIProviderOptions object for Ollama
// ---------------------------------------------------------------------------
function makeOllamaOpts(overrides: Partial<Parameters<typeof createAIProvider>[0]> = {}) {
  return {
    provider: "ollama" as const,
    baseURL: completePath(OLLAMA_BASE_URL, "/api"), // default local URL
    model: "llama3",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createAIProvider — Ollama", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Silence console.error inside completePath for invalid URLs
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Happy path: default local URL
  // -------------------------------------------------------------------------
  it("creates an Ollama model instance with the default base URL", async () => {
    const model = await createAIProvider(makeOllamaOpts());

    expect(mockCreateOllama).toHaveBeenCalledTimes(1);
    expect(model).toMatchObject({
      __provider: "ollama",
      __model: "llama3",
    });
  });

  it("passes the default OLLAMA_BASE_URL + /api path to createOllama", async () => {
    const expectedBase = completePath(OLLAMA_BASE_URL, "/api");
    await createAIProvider(makeOllamaOpts({ baseURL: expectedBase }));

    const callArgs = mockCreateOllama.mock.calls[0][0] as { baseURL: string };
    expect(callArgs.baseURL).toBe(expectedBase);
  });

  // -------------------------------------------------------------------------
  // 2. Custom proxy URL
  // -------------------------------------------------------------------------
  it("uses a custom proxy URL when provided", async () => {
    const customProxy = "http://my-proxy-server:11434/api";
    await createAIProvider(makeOllamaOpts({ baseURL: customProxy }));

    const callArgs = mockCreateOllama.mock.calls[0][0] as { baseURL: string };
    expect(callArgs.baseURL).toBe(customProxy);
  });

  // -------------------------------------------------------------------------
  // 3. Authorization header stripping for local requests
  // -------------------------------------------------------------------------
  it("strips Authorization header when the request target is NOT the app origin", async () => {
    // Simulate the app running at http://localhost:3000
    Object.defineProperty(global, "location", {
      value: { origin: "http://localhost:3000" },
      writable: true,
      configurable: true,
    });

    let capturedFetch: ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) | undefined;

    mockCreateOllama.mockImplementationOnce((opts: { fetch?: typeof fetch }) => {
      capturedFetch = opts.fetch;
      return (model: string) => ({ __provider: "ollama", __model: model, __opts: opts });
    });

    await createAIProvider(makeOllamaOpts({
      baseURL: completePath(OLLAMA_BASE_URL, "/api"), // http://localhost:11434/api — NOT the app origin
    }));

    expect(capturedFetch).toBeDefined();

    const mockNativeFetch = jest.fn().mockResolvedValue(new Response("{}"));
    global.fetch = mockNativeFetch;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: "sometoken123",
    };

    await capturedFetch!("http://localhost:11434/api/chat", {
      method: "POST",
      headers,
    });

    const passedInit = mockNativeFetch.mock.calls[0][1] as RequestInit;
    const passedHeaders = passedInit.headers as Record<string, string>;

    // Authorization MUST be stripped for requests going to the local Ollama instance
    expect(passedHeaders["Authorization"]).toBeUndefined();
    // Other headers must be preserved
    expect(passedHeaders["Content-Type"]).toBe("application/json");
  });

  it("keeps Authorization header when the request goes through the app proxy (same origin)", async () => {
    const appOrigin = "http://localhost:3000";
    Object.defineProperty(global, "location", {
      value: { origin: appOrigin },
      writable: true,
      configurable: true,
    });

    let capturedFetch: ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) | undefined;

    mockCreateOllama.mockImplementationOnce((opts: { fetch?: typeof fetch }) => {
      capturedFetch = opts.fetch;
      return (model: string) => ({ __provider: "ollama", __model: model });
    });

    // baseURL points at the app proxy — same origin
    await createAIProvider(makeOllamaOpts({
      baseURL: `${appOrigin}/api/ai/ollama/api`,
    }));

    const mockNativeFetch = jest.fn().mockResolvedValue(new Response("{}"));
    global.fetch = mockNativeFetch;

    const headers: Record<string, string> = {
      Authorization: "proxysig",
      "Content-Type": "application/json",
    };

    await capturedFetch!(`${appOrigin}/api/ai/ollama/api/chat`, {
      method: "POST",
      headers,
    });

    const passedInit = mockNativeFetch.mock.calls[0][1] as RequestInit;
    const passedHeaders = passedInit.headers as Record<string, string>;

    // Authorization must be kept for proxy requests
    expect(passedHeaders["Authorization"]).toBe("proxysig");
  });

  // -------------------------------------------------------------------------
  // 4. credentials: "omit" is always set (prevents cookies leaking to Ollama)
  // -------------------------------------------------------------------------
  it("always sets credentials: omit on the underlying fetch", async () => {
    let capturedFetch: ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) | undefined;

    mockCreateOllama.mockImplementationOnce((opts: { fetch?: typeof fetch }) => {
      capturedFetch = opts.fetch;
      return (model: string) => ({ __provider: "ollama", __model: model });
    });

    await createAIProvider(makeOllamaOpts());

    const mockNativeFetch = jest.fn().mockResolvedValue(new Response("{}"));
    global.fetch = mockNativeFetch;

    await capturedFetch!("http://localhost:11434/api/chat", { method: "POST" });

    const passedInit = mockNativeFetch.mock.calls[0][1] as RequestInit;
    expect(passedInit.credentials).toBe("omit");
  });

  // -------------------------------------------------------------------------
  // 5. Unsupported provider throws
  // -------------------------------------------------------------------------
  it("throws an error for an unsupported provider", async () => {
    await expect(
      createAIProvider({ provider: "nonexistent", baseURL: "", model: "x" })
    ).rejects.toThrow("Unsupported Provider: nonexistent");
  });

  // -------------------------------------------------------------------------
  // 6. Model name is forwarded correctly (important for local model names)
  // -------------------------------------------------------------------------
  it.each([
    ["llama3"],
    ["llama3:8b"],
    ["mistral:7b-instruct"],
    ["deepseek-r1:14b"],
    ["gemma3:27b"],
  ])("forwards model name %s unchanged", async (modelName) => {
    const result = await createAIProvider(makeOllamaOpts({ model: modelName }));
    expect((result as { __model: string }).__model).toBe(modelName);
  });
});

// ---------------------------------------------------------------------------
// Tests for completePath (URL assembly used for Ollama baseURL)
// ---------------------------------------------------------------------------

describe("completePath — Ollama URL assembly", () => {
  it("appends /api to a bare hostname URL", () => {
    expect(completePath("http://localhost:11434", "/api"))
      .toBe("http://localhost:11434/api");
  });

  it("does not double-append /api when already present", () => {
    // The function checks if path already ends with /api
    expect(completePath("http://localhost:11434/api", "/api"))
      .toBe("http://localhost:11434/api");
  });

  it("returns the URL unchanged when it already has a version path (/v1)", () => {
    // Version paths should not be mutated
    const result = completePath("http://my-proxy.internal/ollama/v1", "/api");
    expect(result).toBe("http://my-proxy.internal/ollama/v1");
  });

  it("handles URLs with trailing slashes gracefully", () => {
    const result = completePath("http://localhost:11434/", "/api");
    expect(result).toBe("http://localhost:11434/api");
  });

  it("returns original string for completely invalid URLs", () => {
    // completePath swallows errors and returns the original string
    const invalid = "not-a-url";
    expect(completePath(invalid, "/api")).toBe(invalid);
  });

  it("uses custom port correctly", () => {
    expect(completePath("http://127.0.0.1:12345", "/api"))
      .toBe("http://127.0.0.1:12345/api");
  });
});
