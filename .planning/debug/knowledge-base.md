# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## ollama-e2e-test-failures — Ollama integration tests fail/error when server is not running
- **Date:** 2026-04-10
- **Error patterns:** Ollama server is not running, TransformStream is not defined, beforeAll, itLive, instanceof Error, jest-environment-jsdom, cross-realm, ollama-ai-provider
- **Root cause:** (1) beforeAll threw Error when OLLAMA_TEST_ENABLED=true but server was unreachable — live tests received the error and failed instead of skipping; (2) instanceof Error guard failed cross-realm in jsdom (Node TypeError vs jsdom realm), leaving error capture as null
- **Fix:** Replace throw in beforeAll with reachability flags (ollamaReachable, testModelAvailable); replace single itLive wrapper with itLive + itLiveWithModel that skip gracefully; add @jest-environment node docblock; remove instanceof guards on error capture
- **Files changed:** src/__tests__/ollama-integration.test.ts, tsconfig.test.json
---
