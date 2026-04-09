/**
 * Unit tests: model utility functions from @/utils/model
 *
 * All functions here are pure — they take a string (or array of strings) and
 * return a boolean or a tuple of arrays.  No network calls, no side effects.
 *
 * The classification helpers (isThinkingModel, isNetworkingModel, etc.) drive
 * which AI SDK options get enabled at runtime, so correctness matters.
 */

import {
  isThinkingModel,
  isNetworkingModel,
  isOpenRouterFreeModel,
  filterThinkingModelList,
  filterNetworkingModelList,
  filterOpenRouterModelList,
  filterDeepSeekModelList,
  filterOpenAIModelList,
  filterPollinationsModelList,
  filterMistralModelList,
  getCustomModelList,
} from "@/utils/model";

// ---------------------------------------------------------------------------
// isThinkingModel
// ---------------------------------------------------------------------------

describe("isThinkingModel", () => {
  it("returns true for a model whose name contains 'thinking'", () => {
    expect(isThinkingModel("claude-3-thinking")).toBe(true);
    expect(isThinkingModel("deepseek-thinking-v2")).toBe(true);
  });

  it("returns true for gemini-2.5-pro variants", () => {
    expect(isThinkingModel("gemini-2.5-pro")).toBe(true);
    expect(isThinkingModel("gemini-2.5-pro-preview-05-06")).toBe(true);
  });

  it("returns true for gemini-2.5-flash variants", () => {
    expect(isThinkingModel("gemini-2.5-flash")).toBe(true);
    expect(isThinkingModel("gemini-2.5-flash-001")).toBe(true);
  });

  it("returns false for standard GPT-4o", () => {
    expect(isThinkingModel("gpt-4o")).toBe(false);
  });

  it("returns false for gemini-2.0-flash (not 2.5)", () => {
    expect(isThinkingModel("gemini-2.0-flash")).toBe(false);
  });

  it("returns false for claude-3-opus (no 'thinking' in name)", () => {
    expect(isThinkingModel("claude-3-opus")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isThinkingModel("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isNetworkingModel
// ---------------------------------------------------------------------------

describe("isNetworkingModel", () => {
  it("returns true for plain gemini-2.0-flash", () => {
    expect(isNetworkingModel("gemini-2.0-flash")).toBe(true);
  });

  it("returns false for gemini-2.0-flash-lite (contains 'lite')", () => {
    expect(isNetworkingModel("gemini-2.0-flash-lite")).toBe(false);
  });

  it("returns false for gemini-2.0-flash-thinking (contains 'thinking')", () => {
    expect(isNetworkingModel("gemini-2.0-flash-thinking")).toBe(false);
  });

  it("returns false for gemini-2.0-flash-image (contains 'image')", () => {
    expect(isNetworkingModel("gemini-2.0-flash-image")).toBe(false);
  });

  it("returns true for gemini-2.5-pro", () => {
    expect(isNetworkingModel("gemini-2.5-pro")).toBe(true);
  });

  it("returns true for gemini-2.5-flash", () => {
    expect(isNetworkingModel("gemini-2.5-flash")).toBe(true);
  });

  it("returns false for gpt-4o", () => {
    expect(isNetworkingModel("gpt-4o")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isNetworkingModel("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isOpenRouterFreeModel
// ---------------------------------------------------------------------------

describe("isOpenRouterFreeModel", () => {
  it("returns true for a model ending with ':free'", () => {
    expect(isOpenRouterFreeModel("meta-llama/llama-3-8b-instruct:free")).toBe(true);
  });

  it("returns false for a paid model without ':free'", () => {
    expect(isOpenRouterFreeModel("openai/gpt-4o")).toBe(false);
  });

  it("returns false when ':free' appears in the middle but not at the end", () => {
    expect(isOpenRouterFreeModel("some:free-model")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isOpenRouterFreeModel("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// filterThinkingModelList
// ---------------------------------------------------------------------------

describe("filterThinkingModelList", () => {
  it("separates thinking models from non-thinking models", () => {
    const input = [
      "gemini-2.5-pro",
      "gpt-4o",
      "deepseek-thinking",
      "claude-3-opus",
    ];
    const [thinking, nonThinking] = filterThinkingModelList(input);
    expect(thinking).toContain("gemini-2.5-pro");
    expect(thinking).toContain("deepseek-thinking");
    expect(nonThinking).toContain("gpt-4o");
    expect(nonThinking).toContain("claude-3-opus");
  });

  it("returns two empty arrays for empty input", () => {
    const [thinking, nonThinking] = filterThinkingModelList([]);
    expect(thinking).toEqual([]);
    expect(nonThinking).toEqual([]);
  });

  it("puts all models in nonThinking when none qualify", () => {
    const [thinking, nonThinking] = filterThinkingModelList(["gpt-4o", "claude-3-opus"]);
    expect(thinking).toEqual([]);
    expect(nonThinking.length).toBe(2);
  });

  it("puts all models in thinking when all qualify", () => {
    const [thinking, nonThinking] = filterThinkingModelList(["gemini-2.5-pro", "gemini-2.5-flash"]);
    expect(thinking.length).toBe(2);
    expect(nonThinking).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// filterNetworkingModelList
// ---------------------------------------------------------------------------

describe("filterNetworkingModelList", () => {
  it("separates networking models from non-networking models", () => {
    const input = ["gemini-2.0-flash", "gpt-4o", "gemini-2.5-pro", "claude-3-opus"];
    const [networking, nonNetworking] = filterNetworkingModelList(input);
    expect(networking).toContain("gemini-2.0-flash");
    expect(networking).toContain("gemini-2.5-pro");
    expect(nonNetworking).toContain("gpt-4o");
    expect(nonNetworking).toContain("claude-3-opus");
  });

  it("excludes gemini-2.0-flash-lite from networking list", () => {
    const [networking] = filterNetworkingModelList(["gemini-2.0-flash-lite"]);
    expect(networking).toEqual([]);
  });

  it("returns two empty arrays for empty input", () => {
    const [networking, nonNetworking] = filterNetworkingModelList([]);
    expect(networking).toEqual([]);
    expect(nonNetworking).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// filterOpenRouterModelList
// ---------------------------------------------------------------------------

describe("filterOpenRouterModelList", () => {
  it("separates free models from paid models", () => {
    const input = [
      "meta-llama/llama-3-8b-instruct:free",
      "openai/gpt-4o",
      "mistral/mistral-7b:free",
    ];
    const [free, paid] = filterOpenRouterModelList(input);
    expect(free).toContain("meta-llama/llama-3-8b-instruct:free");
    expect(free).toContain("mistral/mistral-7b:free");
    expect(paid).toContain("openai/gpt-4o");
  });

  it("returns two empty arrays for empty input", () => {
    const [free, paid] = filterOpenRouterModelList([]);
    expect(free).toEqual([]);
    expect(paid).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// filterDeepSeekModelList
// ---------------------------------------------------------------------------

describe("filterDeepSeekModelList", () => {
  it("puts 'reasoner' models in the thinking list", () => {
    const input = ["deepseek-reasoner", "deepseek-chat", "deepseek-coder"];
    const [thinking, nonThinking] = filterDeepSeekModelList(input);
    expect(thinking).toContain("deepseek-reasoner");
    expect(nonThinking).toContain("deepseek-chat");
    expect(nonThinking).toContain("deepseek-coder");
  });

  it("returns two empty arrays for empty input", () => {
    const [thinking, nonThinking] = filterDeepSeekModelList([]);
    expect(thinking).toEqual([]);
    expect(nonThinking).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// filterOpenAIModelList
// ---------------------------------------------------------------------------

describe("filterOpenAIModelList", () => {
  it("includes gpt-4o models in the networking list", () => {
    const [networking] = filterOpenAIModelList(["gpt-4o", "gpt-4o-mini"]);
    expect(networking).toContain("gpt-4o");
    expect(networking).toContain("gpt-4o-mini");
  });

  it("includes gpt-4.1 models in the networking list", () => {
    const [networking] = filterOpenAIModelList(["gpt-4.1", "gpt-4.1-mini"]);
    expect(networking).toContain("gpt-4.1");
  });

  it("includes gpt-5 models in the networking list", () => {
    const [networking] = filterOpenAIModelList(["gpt-5"]);
    expect(networking).toContain("gpt-5");
  });

  it("returns two empty arrays for empty input", () => {
    const [networking, nonNetworking] = filterOpenAIModelList([]);
    expect(networking).toEqual([]);
    expect(nonNetworking).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// filterPollinationsModelList
// ---------------------------------------------------------------------------

describe("filterPollinationsModelList", () => {
  it("puts openai-prefixed models in the recommend list", () => {
    const [recommend] = filterPollinationsModelList(["openai-large", "openai-fast"]);
    expect(recommend).toContain("openai-large");
    expect(recommend).toContain("openai-fast");
  });

  it("puts deepseek-prefixed models in the recommend list", () => {
    const [recommend] = filterPollinationsModelList(["deepseek-chat"]);
    expect(recommend).toContain("deepseek-chat");
  });

  it("puts searchgpt-prefixed models in the recommend list", () => {
    const [recommend] = filterPollinationsModelList(["searchgpt"]);
    expect(recommend).toContain("searchgpt");
  });

  it("puts other models in the normal list", () => {
    const [recommend, normal] = filterPollinationsModelList(["mistral-large", "llama-3-8b"]);
    expect(recommend).toEqual([]);
    expect(normal).toContain("mistral-large");
    expect(normal).toContain("llama-3-8b");
  });

  it("returns two empty arrays for empty input", () => {
    const [recommend, normal] = filterPollinationsModelList([]);
    expect(recommend).toEqual([]);
    expect(normal).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// filterMistralModelList
// ---------------------------------------------------------------------------

describe("filterMistralModelList", () => {
  it("puts large-latest models in the recommend list", () => {
    const [recommend] = filterMistralModelList(["mistral-large-latest"]);
    expect(recommend).toContain("mistral-large-latest");
  });

  it("puts medium-latest models in the recommend list", () => {
    const [recommend] = filterMistralModelList(["mistral-medium-latest"]);
    expect(recommend).toContain("mistral-medium-latest");
  });

  it("puts other models in the normal list", () => {
    const [recommend, normal] = filterMistralModelList(["open-mistral-7b", "mistral-small"]);
    expect(recommend).toEqual([]);
    expect(normal).toContain("open-mistral-7b");
    expect(normal).toContain("mistral-small");
  });

  it("returns two empty arrays for empty input", () => {
    const [recommend, normal] = filterMistralModelList([]);
    expect(recommend).toEqual([]);
    expect(normal).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getCustomModelList
// ---------------------------------------------------------------------------

describe("getCustomModelList", () => {
  it("includes models prefixed with '+' in the available list (stripping the prefix)", () => {
    const { availableModelList, disabledModelList } = getCustomModelList(["+my-model"]);
    expect(availableModelList).toContain("my-model");
    expect(disabledModelList).toEqual([]);
  });

  it("includes models prefixed with '-' in the disabled list (stripping the prefix)", () => {
    const { availableModelList, disabledModelList } = getCustomModelList(["-bad-model"]);
    expect(disabledModelList).toContain("bad-model");
    expect(availableModelList).toEqual([]);
  });

  it("includes models without prefix in the available list unchanged", () => {
    const { availableModelList, disabledModelList } = getCustomModelList(["plain-model"]);
    expect(availableModelList).toContain("plain-model");
    expect(disabledModelList).toEqual([]);
  });

  it("handles a mixed list correctly", () => {
    const input = ["+enabled", "-disabled", "raw"];
    const { availableModelList, disabledModelList } = getCustomModelList(input);
    expect(availableModelList).toEqual(["enabled", "raw"]);
    expect(disabledModelList).toEqual(["disabled"]);
  });

  it("returns empty lists for empty input", () => {
    const { availableModelList, disabledModelList } = getCustomModelList([]);
    expect(availableModelList).toEqual([]);
    expect(disabledModelList).toEqual([]);
  });
});
