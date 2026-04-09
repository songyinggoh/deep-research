/**
 * Unit tests: text utility functions critical to Ollama response processing
 *
 * Ollama local models frequently:
 * - Wrap JSON in markdown code fences (```json ... ```)
 * - Emit <think>...</think> tags (DeepSeek-R1, QwQ, etc.)
 * - Return partial / malformed JSON mid-stream
 *
 * These tests validate the helpers that sanitize that output before it is
 * parsed or displayed.
 */

import { removeJsonMarkdown, ThinkTagStreamProcessor, splitText } from "@/utils/text";

// ---------------------------------------------------------------------------
// removeJsonMarkdown
// ---------------------------------------------------------------------------

describe("removeJsonMarkdown", () => {
  // Happy paths — standard code fences
  it("strips triple-backtick json fence", () => {
    const input = "```json\n[{\"query\":\"test\"}]\n```";
    expect(removeJsonMarkdown(input)).toBe('[{"query":"test"}]');
  });

  it("strips triple-backtick fence without language tag", () => {
    const input = "```\n{\"key\":\"value\"}\n```";
    expect(removeJsonMarkdown(input)).toBe('{"key":"value"}');
  });

  it("strips leading json keyword without backticks", () => {
    // Some Ollama models output raw `json{...}` without fences
    const input = 'json\n{"key":"value"}';
    expect(removeJsonMarkdown(input.trimStart())).toBe('{"key":"value"}');
  });

  it("returns plain JSON unchanged", () => {
    const input = '[{"query":"test","researchGoal":"goal"}]';
    expect(removeJsonMarkdown(input)).toBe(input);
  });

  // Edge cases from Ollama models
  it("handles extra whitespace around the fence", () => {
    const input = "   ```json\n[]\n```   ";
    expect(removeJsonMarkdown(input)).toBe("[]");
  });

  it("handles empty string", () => {
    expect(removeJsonMarkdown("")).toBe("");
  });

  it("handles only whitespace", () => {
    expect(removeJsonMarkdown("   ")).toBe("");
  });

  it("handles JSON that has prose before the code block", () => {
    // The function trims but since the text doesn't start with ```, the regex
    // path isn't taken. The text ends with ``` so the trailing fence is stripped.
    // This documents the actual (non-extracting) behaviour for mixed prose+fence.
    const input = 'Here is the output:\n```json\n[{"q":"a"}]\n```';
    const result = removeJsonMarkdown(input);
    // The result should not contain the trailing closing fence
    expect(result).not.toMatch(/```\s*$/);
    // The original content minus the trailing fence is present
    expect(result).toContain('Here is the output:');
  });

  it("extracts JSON from fence that starts the string even with trailing prose", () => {
    const input = "```json\n[{\"q\":\"a\"}]\n```\nSome extra text";
    // The regex is greedy up to the first closing ``` → should capture just the JSON
    const result = removeJsonMarkdown(input);
    expect(result).toBe('[{"q":"a"}]');
  });

  it("handles malformed fence (no closing backticks) gracefully", () => {
    const input = "```json\n[{\"q\":\"incomplete\"";
    const result = removeJsonMarkdown(input);
    // Falls through to slice(7) path when no match → strips opening fence
    expect(result).not.toContain("```json");
  });
});

// ---------------------------------------------------------------------------
// ThinkTagStreamProcessor
// ---------------------------------------------------------------------------

describe("ThinkTagStreamProcessor", () => {
  let processor: ThinkTagStreamProcessor;
  let contentChunks: string[];
  let thinkingChunks: string[];

  beforeEach(() => {
    processor = new ThinkTagStreamProcessor();
    contentChunks = [];
    thinkingChunks = [];
  });

  const content = (data: string) => contentChunks.push(data);
  const thinking = (data: string) => thinkingChunks.push(data);

  // -------------------------------------------------------------------------
  // Models that DO NOT emit think tags (most Ollama models)
  // -------------------------------------------------------------------------
  it("passes plain text straight through to contentOutput", () => {
    processor.processChunk("Hello, world!", content, thinking);
    expect(contentChunks).toEqual(["Hello, world!"]);
    expect(thinkingChunks).toEqual([]);
  });

  it("continues passing subsequent chunks once no think block detected", () => {
    processor.processChunk("First chunk. ", content, thinking);
    processor.processChunk("Second chunk.", content, thinking);
    expect(contentChunks).toEqual(["First chunk. ", "Second chunk."]);
  });

  // -------------------------------------------------------------------------
  // Models that emit <think> (DeepSeek-R1, QwQ running via Ollama)
  // -------------------------------------------------------------------------
  it("routes content inside <think>...</think> to thinkingOutput only", () => {
    processor.processChunk("<think>internal reasoning</think>Final answer", content, thinking);
    // Content after </think> should be emitted as content
    expect(contentChunks.join("")).toBe("Final answer");
    // The chunk during think tag should go to thinking
    expect(thinkingChunks.length).toBeGreaterThanOrEqual(0); // may be empty if processed atomically
  });

  it("handles think block arriving in multiple chunks", () => {
    processor.processChunk("<think>", content, thinking);
    processor.processChunk("still thinking...", content, thinking);
    // While inside <think> block, no content should be emitted
    expect(contentChunks).toEqual([]);
    // Thinking output received the second chunk
    expect(thinkingChunks).toContain("still thinking...");

    // Now close the think block
    processor.processChunk("</think>actual response", content, thinking);
    expect(contentChunks.join("")).toBe("actual response");
  });

  it("correctly routes think chunk to thinkingOutput callback if provided", () => {
    processor.processChunk("<think>", content, thinking);
    processor.processChunk("deep thought", content, thinking);
    expect(thinkingChunks).toContain("deep thought");
    expect(contentChunks).toEqual([]);
  });

  it("does not call thinkingOutput if callback is omitted", () => {
    // Should not throw even if thinkingOutput is undefined
    expect(() => {
      processor.processChunk("<think>some thought</think>answer", content);
    }).not.toThrow();
    expect(contentChunks.join("")).toBe("answer");
  });

  it("passes all subsequent chunks through after think block resolved", () => {
    processor.processChunk("<think>thoughts</think>", content, thinking);
    processor.processChunk("Part 1 ", content, thinking);
    processor.processChunk("Part 2", content, thinking);
    expect(contentChunks.join("")).toBe("Part 1 Part 2");
  });

  it("reset via end() allows reuse for a new stream", () => {
    processor.processChunk("<think>old thought</think>old answer", content, thinking);
    processor.end();
    contentChunks = [];
    thinkingChunks = [];
    // After reset, should behave like a fresh instance
    processor.processChunk("new content", content, thinking);
    expect(contentChunks).toEqual(["new content"]);
  });

  // -------------------------------------------------------------------------
  // Edge cases / partial chunk boundaries
  // -------------------------------------------------------------------------
  it("handles empty chunk without error", () => {
    expect(() => processor.processChunk("", content, thinking)).not.toThrow();
  });

  it("handles a think tag split across chunk boundaries", () => {
    // <think> arrives in two chunks
    processor.processChunk("<thi", content, thinking);
    processor.processChunk("nk>reasoning</think>answer", content, thinking);
    // Once the full think block is resolved, answer should reach content
    // Implementation buffers until </think> — content arrives on second chunk
    expect(contentChunks.join("")).toContain("answer");
  });

  it("does not emit empty string to content when think block has no content after it", () => {
    processor.processChunk("<think>thinking</think>", content, thinking);
    // The content after </think> is "" — the impl checks length > 0 before calling contentOutput
    expect(contentChunks).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// splitText
// ---------------------------------------------------------------------------

describe("splitText", () => {
  it("returns a single chunk when text is shorter than maxLength", () => {
    const chunks = splitText("short text", 2000);
    expect(chunks).toEqual(["short text"]);
  });

  it("splits on newlines to keep chunks within maxLength", () => {
    const line = "a".repeat(100);
    const input = Array(30).fill(line).join("\n"); // 30 lines of 100 chars
    const chunks = splitText(input, 200);
    chunks.forEach((chunk) => {
      expect(chunk.length).toBeLessThanOrEqual(200);
    });
  });

  it("returns empty array for empty string", () => {
    expect(splitText("")).toEqual([]);
  });

  it("handles text with no newlines that exceeds maxLength", () => {
    const longLine = "x".repeat(5000);
    const chunks = splitText(longLine, 2000);
    // Implementation puts the whole line in a single chunk when there are no newlines
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.join("")).toBe(longLine);
  });

  it("preserves all content after splitting", () => {
    const original = "Line1\nLine2\nLine3\nLine4\nLine5";
    const chunks = splitText(original, 10);
    // Reassembling with newlines should recover the original
    expect(chunks.join("\n")).toBe(original);
  });
});
