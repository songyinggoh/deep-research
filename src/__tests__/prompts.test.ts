/**
 * Unit tests: prompt construction and override system
 *
 * Prompts are the primary interface between the app and the LLM.  For Ollama
 * local models this is especially important because:
 * - Context windows are smaller — prompts must not be accidentally inflated
 * - JSON schema output prompts must be syntactically valid for the model to
 *   comply (local models are less instruction-following than cloud models)
 * - Overrides allow users to tune prompts for specific local models
 *
 * These tests are pure logic tests — no network calls, no mocks needed.
 */

import {
  parseDeepResearchPromptOverrides,
  resolveDeepResearchPromptTemplates,
  defaultDeepResearchPromptTemplates,
  deepResearchPromptTemplateKeys,
  systemInstruction,
  serpQuerySchemaPrompt,
  guidelinesPrompt,
  reportPlanPrompt,
  reviewPrompt,
  serpQueriesPrompt,
} from "@/constants/prompts";

import {
  getSystemPrompt,
  getOutputGuidelinesPrompt,
  generateQuestionsPrompt,
  writeReportPlanPrompt,
  generateSerpQueriesPrompt,
  processResultPrompt,
  getSERPQuerySchema,
  getSERPQueryOutputSchema,
} from "@/utils/deep-research/prompts";

// ---------------------------------------------------------------------------
// parseDeepResearchPromptOverrides
// ---------------------------------------------------------------------------

describe("parseDeepResearchPromptOverrides", () => {
  it("returns empty object for empty string", () => {
    expect(parseDeepResearchPromptOverrides("")).toEqual({});
  });

  it("returns empty object for whitespace-only string", () => {
    expect(parseDeepResearchPromptOverrides("   ")).toEqual({});
  });

  it("returns empty object for null/undefined", () => {
    expect(parseDeepResearchPromptOverrides(null)).toEqual({});
    expect(parseDeepResearchPromptOverrides(undefined)).toEqual({});
  });

  it("parses a valid JSON string with known keys", () => {
    const input = JSON.stringify({ systemInstruction: "Custom system prompt" });
    const result = parseDeepResearchPromptOverrides(input);
    expect(result.systemInstruction).toBe("Custom system prompt");
  });

  it("ignores unknown keys in the JSON", () => {
    const input = JSON.stringify({ unknownKey: "value", systemInstruction: "valid" });
    const result = parseDeepResearchPromptOverrides(input);
    expect(result).not.toHaveProperty("unknownKey");
    expect(result.systemInstruction).toBe("valid");
  });

  it("ignores numeric values for known keys", () => {
    const input = JSON.stringify({ systemInstruction: 42 });
    const result = parseDeepResearchPromptOverrides(input);
    expect(result).not.toHaveProperty("systemInstruction");
  });

  it("throws for invalid JSON string", () => {
    expect(() => parseDeepResearchPromptOverrides("{not json}")).toThrow(
      "Prompt overrides must be a valid JSON object."
    );
  });

  it("throws for JSON array", () => {
    expect(() => parseDeepResearchPromptOverrides('["a","b"]')).toThrow(
      "Prompt overrides must be a valid JSON object."
    );
  });

  it("accepts a pre-parsed object directly", () => {
    const obj = { finalReportPrompt: "Custom final report" };
    const result = parseDeepResearchPromptOverrides(obj);
    expect(result.finalReportPrompt).toBe("Custom final report");
  });

  it("parses all known template keys", () => {
    const input: Record<string, string> = {};
    deepResearchPromptTemplateKeys.forEach((key) => {
      input[key] = `Custom ${key}`;
    });
    const result = parseDeepResearchPromptOverrides(JSON.stringify(input));
    deepResearchPromptTemplateKeys.forEach((key) => {
      expect(result[key]).toBe(`Custom ${key}`);
    });
  });
});

// ---------------------------------------------------------------------------
// resolveDeepResearchPromptTemplates
// ---------------------------------------------------------------------------

describe("resolveDeepResearchPromptTemplates", () => {
  it("returns defaults when no overrides supplied", () => {
    const result = resolveDeepResearchPromptTemplates();
    expect(result).toEqual(defaultDeepResearchPromptTemplates);
  });

  it("applies a single override", () => {
    const customSystem = "You are a local-model researcher.";
    const result = resolveDeepResearchPromptTemplates({ systemInstruction: customSystem });
    expect(result.systemInstruction).toBe(customSystem);
    // Other keys remain default
    expect(result.finalReportPrompt).toBe(defaultDeepResearchPromptTemplates.finalReportPrompt);
  });

  it("propagates guidelinesPrompt override into reportPlanPrompt automatically", () => {
    const customGuidelines = "Custom integration guidelines";
    const result = resolveDeepResearchPromptTemplates({ guidelinesPrompt: customGuidelines });
    // reportPlanPrompt should now embed the custom guidelines (replacing the original)
    expect(result.reportPlanPrompt).toContain(customGuidelines);
    expect(result.reportPlanPrompt).not.toContain(guidelinesPrompt);
  });

  it("does NOT auto-update reportPlanPrompt when reportPlanPrompt is also overridden", () => {
    const customGuidelines = "Custom guidelines";
    const customPlan = "Fully custom plan prompt";
    const result = resolveDeepResearchPromptTemplates({
      guidelinesPrompt: customGuidelines,
      reportPlanPrompt: customPlan,
    });
    // Explicit override wins
    expect(result.reportPlanPrompt).toBe(customPlan);
  });

  it("propagates serpQuerySchemaPrompt override into serpQueriesPrompt", () => {
    const customSchema = "Custom schema prompt";
    const result = resolveDeepResearchPromptTemplates({ serpQuerySchemaPrompt: customSchema });
    expect(result.serpQueriesPrompt).toContain(customSchema);
    expect(result.serpQueriesPrompt).not.toContain(serpQuerySchemaPrompt);
  });

  it("propagates serpQuerySchemaPrompt override into reviewPrompt", () => {
    const customSchema = "Custom schema prompt";
    const result = resolveDeepResearchPromptTemplates({ serpQuerySchemaPrompt: customSchema });
    expect(result.reviewPrompt).toContain(customSchema);
    expect(result.reviewPrompt).not.toContain(serpQuerySchemaPrompt);
  });
});

// ---------------------------------------------------------------------------
// getSystemPrompt
// ---------------------------------------------------------------------------

describe("getSystemPrompt", () => {
  it("injects the current date into the system prompt", () => {
    const result = getSystemPrompt();
    // Should not contain the literal placeholder
    expect(result).not.toContain("{now}");
    // Should contain a recognizable ISO date string
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("uses the custom systemInstruction when override is provided", () => {
    const custom = "Custom instruction {now}";
    const result = getSystemPrompt({ systemInstruction: custom });
    expect(result).not.toContain("{now}");
    expect(result).toContain("Custom instruction");
  });
});

// ---------------------------------------------------------------------------
// generateQuestionsPrompt
// ---------------------------------------------------------------------------

describe("generateQuestionsPrompt", () => {
  it("injects the query into the prompt", () => {
    const result = generateQuestionsPrompt("What is Ollama?");
    expect(result).toContain("What is Ollama?");
    expect(result).not.toContain("{query}");
  });

  it("handles special characters in the query", () => {
    const query = 'How does "LLM" streaming work with <think> tags?';
    const result = generateQuestionsPrompt(query);
    expect(result).toContain(query);
  });
});

// ---------------------------------------------------------------------------
// writeReportPlanPrompt
// ---------------------------------------------------------------------------

describe("writeReportPlanPrompt", () => {
  it("injects the query", () => {
    const result = writeReportPlanPrompt("Ollama performance benchmarks");
    expect(result).toContain("Ollama performance benchmarks");
    expect(result).not.toContain("{query}");
  });
});

// ---------------------------------------------------------------------------
// generateSerpQueriesPrompt
// ---------------------------------------------------------------------------

describe("generateSerpQueriesPrompt", () => {
  it("injects the plan and the JSON schema", () => {
    const plan = "1. Introduction\n2. Analysis\n3. Conclusion";
    const result = generateSerpQueriesPrompt(plan);
    expect(result).toContain(plan);
    expect(result).not.toContain("{plan}");
    // Should embed a JSON schema
    expect(result).toContain("{");
    expect(result).toContain("query");
    expect(result).toContain("researchGoal");
  });
});

// ---------------------------------------------------------------------------
// processResultPrompt
// ---------------------------------------------------------------------------

describe("processResultPrompt", () => {
  it("injects query and researchGoal", () => {
    const result = processResultPrompt(
      "Ollama context window limits",
      "Understand how Ollama handles long prompts"
    );
    expect(result).toContain("Ollama context window limits");
    expect(result).toContain("Understand how Ollama handles long prompts");
    expect(result).not.toContain("{query}");
    expect(result).not.toContain("{researchGoal}");
  });
});

// ---------------------------------------------------------------------------
// getSERPQuerySchema — JSON schema validation
// ---------------------------------------------------------------------------

describe("getSERPQuerySchema", () => {
  const schema = getSERPQuerySchema();

  it("validates a well-formed array of search tasks", () => {
    const valid = [
      { query: "Ollama API docs", researchGoal: "Understand the REST API" },
      { query: "Ollama GPU support", researchGoal: "Check NVIDIA/AMD compatibility" },
    ];
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it("rejects an object (expects array)", () => {
    const invalid = { query: "test", researchGoal: "goal" };
    expect(schema.safeParse(invalid).success).toBe(false);
  });

  it("rejects an item missing the query field", () => {
    const invalid = [{ researchGoal: "goal only" }];
    expect(schema.safeParse(invalid).success).toBe(false);
  });

  it("rejects an item missing the researchGoal field", () => {
    const invalid = [{ query: "query only" }];
    expect(schema.safeParse(invalid).success).toBe(false);
  });

  it("validates an empty array (no queries needed)", () => {
    // Valid — means the model decided no further research is required
    expect(schema.safeParse([]).success).toBe(true);
  });

  it("validates partial JSON produced by a streaming Ollama response", () => {
    // Partial JSON that passes the schema (repaired parse scenario)
    const partial = [{ query: "partial", researchGoal: "partial goal" }];
    expect(schema.safeParse(partial).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getSERPQueryOutputSchema — JSON schema string for embedding in prompts
// ---------------------------------------------------------------------------

describe("getSERPQueryOutputSchema", () => {
  it("returns a non-empty JSON string", () => {
    const result = getSERPQueryOutputSchema();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("is valid JSON", () => {
    const result = getSERPQueryOutputSchema();
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it("describes an array type", () => {
    const result = getSERPQueryOutputSchema();
    const parsed = JSON.parse(result);
    expect(parsed.type).toBe("array");
  });

  it("references query and researchGoal properties", () => {
    const result = getSERPQueryOutputSchema();
    expect(result).toContain("query");
    expect(result).toContain("researchGoal");
  });
});

// ---------------------------------------------------------------------------
// Context-length awareness: prompt size estimates
// ---------------------------------------------------------------------------

describe("Prompt size — context length awareness for local models", () => {
  /**
   * Local Ollama models commonly have context windows of 2k–8k tokens.
   * These tests assert that the base prompts are reasonable in size and
   * do not exceed a conservative 4000-character limit per prompt fragment
   * (roughly ~1000 tokens at 4 chars/token), leaving room for the actual
   * research content.
   */
  const CONSERVATIVE_CHAR_LIMIT = 4000;

  it("system prompt is under the character limit", () => {
    expect(getSystemPrompt().length).toBeLessThan(CONSERVATIVE_CHAR_LIMIT);
  });

  it("question generation prompt is under the limit for a short query", () => {
    const prompt = generateQuestionsPrompt("Ollama");
    expect(prompt.length).toBeLessThan(CONSERVATIVE_CHAR_LIMIT);
  });

  it("report plan prompt is under the limit for a short query", () => {
    const prompt = writeReportPlanPrompt("Ollama benchmarks");
    expect(prompt.length).toBeLessThan(CONSERVATIVE_CHAR_LIMIT);
  });

  it("getOutputGuidelinesPrompt is under the character limit", () => {
    const prompt = getOutputGuidelinesPrompt();
    expect(prompt.length).toBeLessThan(CONSERVATIVE_CHAR_LIMIT);
  });
});
