import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getCustomModelList, multiApiKeyPolling } from "@/utils/model";
import { verifySignature } from "@/utils/signature";
import { generateAuthToken } from "@/utils/vertex-auth";

const accessPassword = process.env.ACCESS_PASSWORD || "";
// AI provider API keys
const GOOGLE_GENERATIVE_AI_API_KEY =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const XAI_API_KEY = process.env.XAI_API_KEY || "";
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || "";
const AZURE_API_KEY = process.env.AZURE_API_KEY || "";
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL || "";
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY || "";
const GOOGLE_PRIVATE_KEY_ID = process.env.GOOGLE_PRIVATE_KEY_ID || "";
const OPENAI_COMPATIBLE_API_KEY = process.env.OPENAI_COMPATIBLE_API_KEY || "";
// Search provider API keys
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || "";
const EXA_API_KEY = process.env.EXA_API_KEY || "";
const BOCHA_API_KEY = process.env.BOCHA_API_KEY || "";
// Configuration
const DISABLED_AI_PROVIDER = process.env.NEXT_PUBLIC_DISABLED_AI_PROVIDER || "";
const DISABLED_SEARCH_PROVIDER =
  process.env.NEXT_PUBLIC_DISABLED_SEARCH_PROVIDER || "";
const MODEL_LIST = process.env.NEXT_PUBLIC_MODEL_LIST || "";

// Limit the middleware to paths starting with `/api/`
export const config = {
  matcher: "/api/:path*",
};

const ERRORS = {
  NO_PERMISSIONS: {
    code: 403,
    message: "No permissions",
    status: "FORBIDDEN",
  },
  NO_API_KEY: {
    code: 500,
    message: "The server does not have an API key.",
    status: "Internal Server Error",
  },
};

interface ProviderConfig {
  /** URL path prefix to match */
  path: string;
  /** Require POST method (search providers) */
  requirePost?: true;
  /** Key used in the disabled-provider env var */
  disabledKey: string;
  /** Which disabled list to check */
  disabledList: "ai" | "search";
  /** Model-disabled check variant, or null for search providers */
  modelCheck: "gemini" | "ai" | null;
  /** Incoming header that carries the HMAC signature */
  sigHeader: string;
  /** Strip "Bearer " (7 chars) from the signature before verifying */
  stripBearer?: true;
  /** Server-side API key to inject (module-level constant). Absent = pass-through. */
  serverKey?: string;
  /** Google Vertex: generate a token instead of polling serverKey */
  generateVertex?: true;
  /** Header name for the injected server key. Absent = pure pass-through. */
  outHeader?: string;
  /** Wrap the injected key as "Bearer <key>" */
  bearerOut?: true;
  /** Delete Authorization before passing through (SearXNG) */
  deleteAuth?: true;
  /** Headers to forward from the incoming request, with optional fallback defaults */
  passHeaders?: Array<{ name: string; default?: string }>;
}

// Order matters: openaicompatible must precede openai to avoid prefix collision.
const PROVIDERS: ProviderConfig[] = [
  // ── AI providers ────────────────────────────────────────────────────────────
  {
    path: "/api/ai/google",
    disabledKey: "google",
    disabledList: "ai",
    modelCheck: "gemini",
    sigHeader: "x-goog-api-key",
    serverKey: GOOGLE_GENERATIVE_AI_API_KEY,
    outHeader: "x-goog-api-key",
    passHeaders: [{ name: "x-goog-api-client", default: "genai-js/0.24.0" }],
  },
  {
    path: "/api/ai/openrouter",
    disabledKey: "openrouter",
    disabledList: "ai",
    modelCheck: "ai",
    sigHeader: "authorization",
    stripBearer: true,
    serverKey: OPENROUTER_API_KEY,
    outHeader: "Authorization",
    bearerOut: true,
  },
  {
    path: "/api/ai/openaicompatible",
    disabledKey: "openaicompatible",
    disabledList: "ai",
    modelCheck: "ai",
    sigHeader: "authorization",
    stripBearer: true,
    serverKey: OPENAI_COMPATIBLE_API_KEY,
    outHeader: "Authorization",
    bearerOut: true,
  },
  {
    path: "/api/ai/openai",
    disabledKey: "openai",
    disabledList: "ai",
    modelCheck: "ai",
    sigHeader: "authorization",
    stripBearer: true,
    serverKey: OPENAI_API_KEY,
    outHeader: "Authorization",
    bearerOut: true,
  },
  {
    path: "/api/ai/anthropic",
    disabledKey: "anthropic",
    disabledList: "ai",
    modelCheck: "ai",
    sigHeader: "x-api-key",
    serverKey: ANTHROPIC_API_KEY,
    outHeader: "x-api-key",
    passHeaders: [{ name: "anthropic-version", default: "2023-06-01" }],
  },
  {
    path: "/api/ai/deepseek",
    disabledKey: "deepseek",
    disabledList: "ai",
    modelCheck: "ai",
    sigHeader: "authorization",
    stripBearer: true,
    serverKey: DEEPSEEK_API_KEY,
    outHeader: "Authorization",
    bearerOut: true,
  },
  {
    path: "/api/ai/xai",
    disabledKey: "xai",
    disabledList: "ai",
    modelCheck: "ai",
    sigHeader: "authorization",
    stripBearer: true,
    serverKey: XAI_API_KEY,
    outHeader: "Authorization",
    bearerOut: true,
  },
  {
    path: "/api/ai/mistral",
    disabledKey: "mistral",
    disabledList: "ai",
    modelCheck: "ai",
    sigHeader: "authorization",
    stripBearer: true,
    serverKey: MISTRAL_API_KEY,
    outHeader: "Authorization",
    bearerOut: true,
  },
  {
    path: "/api/ai/azure",
    disabledKey: "azure",
    disabledList: "ai",
    modelCheck: "ai",
    sigHeader: "api-key",
    serverKey: AZURE_API_KEY,
    outHeader: "api-key",
  },
  {
    path: "/api/ai/google-vertex",
    disabledKey: "google-vertex",
    disabledList: "ai",
    modelCheck: "ai",
    sigHeader: "authorization",
    stripBearer: true,
    generateVertex: true,
    outHeader: "Authorization",
    bearerOut: true,
  },
  {
    // Pollinations is a free/open provider — no server key injection needed
    path: "/api/ai/pollinations",
    disabledKey: "pollinations",
    disabledList: "ai",
    modelCheck: "ai",
    sigHeader: "authorization",
    stripBearer: true,
  },
  {
    // Ollama is a local server — no server key injection needed
    path: "/api/ai/ollama",
    disabledKey: "ollama",
    disabledList: "ai",
    modelCheck: "ai",
    sigHeader: "authorization",
    stripBearer: true,
  },
  // ── Search providers ─────────────────────────────────────────────────────────
  {
    path: "/api/search/tavily",
    requirePost: true,
    disabledKey: "tavily",
    disabledList: "search",
    modelCheck: null,
    sigHeader: "authorization",
    stripBearer: true,
    serverKey: TAVILY_API_KEY,
    outHeader: "Authorization",
    bearerOut: true,
  },
  {
    path: "/api/search/firecrawl",
    requirePost: true,
    disabledKey: "firecrawl",
    disabledList: "search",
    modelCheck: null,
    sigHeader: "authorization",
    stripBearer: true,
    serverKey: FIRECRAWL_API_KEY,
    outHeader: "Authorization",
    bearerOut: true,
  },
  {
    path: "/api/search/exa",
    requirePost: true,
    disabledKey: "exa",
    disabledList: "search",
    modelCheck: null,
    sigHeader: "authorization",
    stripBearer: true,
    serverKey: EXA_API_KEY,
    outHeader: "Authorization",
    bearerOut: true,
  },
  {
    path: "/api/search/bocha",
    requirePost: true,
    disabledKey: "bocha",
    disabledList: "search",
    modelCheck: null,
    sigHeader: "authorization",
    stripBearer: true,
    serverKey: BOCHA_API_KEY,
    outHeader: "Authorization",
    bearerOut: true,
  },
  {
    // SearXNG is self-hosted — no server key; strip Authorization before proxying
    path: "/api/search/searxng",
    requirePost: true,
    disabledKey: "searxng",
    disabledList: "search",
    modelCheck: null,
    sigHeader: "authorization",
    stripBearer: true,
    deleteAuth: true,
  },
];

export async function middleware(request: NextRequest) {
  const disabledAIProviders =
    DISABLED_AI_PROVIDER.length > 0 ? DISABLED_AI_PROVIDER.split(",") : [];
  const disabledSearchProviders =
    DISABLED_SEARCH_PROVIDER.length > 0
      ? DISABLED_SEARCH_PROVIDER.split(",")
      : [];

  const hasDisabledGeminiModel = () => {
    if (request.method.toUpperCase() === "GET") return false;
    const { availableModelList, disabledModelList } = getCustomModelList(
      MODEL_LIST.length > 0 ? MODEL_LIST.split(",") : []
    );
    const isAvailableModel = availableModelList.some((m) =>
      request.nextUrl.pathname.includes(`models/${m}:`)
    );
    if (isAvailableModel) return false;
    if (disabledModelList.includes("all")) return true;
    return disabledModelList.some((m) =>
      request.nextUrl.pathname.includes(`models/${m}:`)
    );
  };

  const hasDisabledAIModel = async () => {
    if (request.method.toUpperCase() === "GET") return false;
    const { model = "" } = await request.json();
    const { availableModelList, disabledModelList } = getCustomModelList(
      MODEL_LIST.length > 0 ? MODEL_LIST.split(",") : []
    );
    const isAvailableModel = availableModelList.some((m) => m === model);
    if (isAvailableModel) return false;
    if (disabledModelList.includes("all")) return true;
    return disabledModelList.some((m) => m === model);
  };

  // ── Provider proxy routes ──────────────────────────────────────────────────
  for (const cfg of PROVIDERS) {
    if (!request.nextUrl.pathname.startsWith(cfg.path)) continue;

    if (cfg.requirePost && request.method.toUpperCase() !== "POST") {
      return NextResponse.json(
        { error: ERRORS.NO_PERMISSIONS },
        { status: 403 }
      );
    }

    const rawSig = request.headers.get(cfg.sigHeader) || "";
    const sig = cfg.stripBearer ? rawSig.substring(7) : rawSig;

    const isDisabled =
      cfg.disabledList === "ai"
        ? disabledAIProviders.includes(cfg.disabledKey)
        : disabledSearchProviders.includes(cfg.disabledKey);

    const isDisabledModel =
      cfg.modelCheck === "gemini"
        ? hasDisabledGeminiModel()
        : cfg.modelCheck === "ai"
          ? await hasDisabledAIModel()
          : false;

    if (
      !(await verifySignature(sig, accessPassword, Date.now())) ||
      isDisabled ||
      isDisabledModel
    ) {
      return NextResponse.json(
        { error: ERRORS.NO_PERMISSIONS },
        { status: 403 }
      );
    }

    const requestHeaders = new Headers();
    requestHeaders.set(
      "Content-Type",
      request.headers.get("Content-Type") || "application/json"
    );

    // Forward passthrough headers (with optional fallback defaults)
    for (const { name, default: def } of cfg.passHeaders ?? []) {
      const val = request.headers.get(name) || def;
      if (val) requestHeaders.set(name, val);
    }

    if (cfg.deleteAuth) {
      requestHeaders.delete("Authorization");
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    if (!cfg.outHeader) {
      // Pure pass-through: no server key to inject (Pollinations, Ollama)
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    // Resolve server-side key
    let apiKey: string | null = null;
    if (cfg.generateVertex) {
      apiKey = await generateAuthToken({
        clientEmail: GOOGLE_CLIENT_EMAIL,
        privateKey: GOOGLE_PRIVATE_KEY,
        privateKeyId: GOOGLE_PRIVATE_KEY_ID,
      });
    } else if (cfg.serverKey !== undefined) {
      apiKey = multiApiKeyPolling(cfg.serverKey) || null;
    }

    if (!apiKey) {
      return NextResponse.json({ error: ERRORS.NO_API_KEY }, { status: 500 });
    }

    requestHeaders.set(
      cfg.outHeader,
      cfg.bearerOut ? `Bearer ${apiKey}` : apiKey
    );
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── /api/crawler ───────────────────────────────────────────────────────────
  // Auth verified here; SSRF protection lives in the route handler itself.
  if (request.nextUrl.pathname.startsWith("/api/crawler")) {
    const authorization = request.headers.get("authorization") || "";
    if (
      request.method.toUpperCase() !== "POST" ||
      !(await verifySignature(
        authorization.substring(7),
        accessPassword,
        Date.now()
      ))
    ) {
      return NextResponse.json(
        { error: ERRORS.NO_PERMISSIONS },
        { status: 403 }
      );
    }
    const requestHeaders = new Headers();
    requestHeaders.set(
      "Content-Type",
      request.headers.get("Content-Type") || "application/json"
    );
    requestHeaders.delete("Authorization");
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── /api/sse ───────────────────────────────────────────────────────────────
  if (request.nextUrl.pathname.startsWith("/api/sse")) {
    let authorization = request.headers.get("authorization") || "";
    if (authorization !== "") {
      authorization = authorization.substring(7);
    } else if (request.method.toUpperCase() === "GET") {
      authorization = request.nextUrl.searchParams.get("password") || "";
    }
    if (authorization !== accessPassword) {
      return NextResponse.json(
        { error: ERRORS.NO_PERMISSIONS },
        { status: 403 }
      );
    }
    const requestHeaders = new Headers();
    requestHeaders.set(
      "Content-Type",
      request.headers.get("Content-Type") || "application/json"
    );
    requestHeaders.delete("Authorization");
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── /api/mcp ───────────────────────────────────────────────────────────────
  if (request.nextUrl.pathname.startsWith("/api/mcp")) {
    const authorization = request.headers.get("authorization") || "";
    if (authorization.substring(7) !== accessPassword) {
      const responseHeaders = new Headers();
      responseHeaders.set("WWW-Authenticate", ERRORS.NO_PERMISSIONS.message);
      return NextResponse.json(
        {
          error: 401,
          error_description: ERRORS.NO_PERMISSIONS.message,
          error_uri: request.nextUrl,
        },
        { headers: responseHeaders, status: 401 }
      );
    }
    const requestHeaders = new Headers();
    requestHeaders.set(
      "Content-Type",
      request.headers.get("Content-Type") || "application/json"
    );
    requestHeaders.delete("Authorization");
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
}
