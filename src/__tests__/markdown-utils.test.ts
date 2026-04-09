/**
 * Unit tests: markdown utilities from @/utils/markdown
 *
 * markdownToDoc converts a markdown string to a Word-compatible HTML document
 * wrapper.  This is used when users export the final research report as a .doc
 * file.  The output must be a well-formed HTML string with the correct wrapper
 * so Word can open it.
 */

import { markdownToDoc } from "@/utils/markdown";

describe("markdownToDoc", () => {
  it("wraps the output in a DOCTYPE HTML shell", () => {
    const result = markdownToDoc("# Hello");
    expect(result).toContain("<!DOCTYPE html>");
    expect(result).toContain("<html>");
    expect(result).toContain("</html>");
  });

  it("includes a UTF-8 meta charset tag", () => {
    const result = markdownToDoc("some text");
    expect(result).toContain('charset="utf-8"');
  });

  it("wraps body content inside <body> tags", () => {
    const result = markdownToDoc("paragraph text");
    expect(result).toContain("<body>");
    expect(result).toContain("</body>");
  });

  it("converts a markdown heading to an HTML heading", () => {
    const result = markdownToDoc("# My Title");
    expect(result).toContain("<h1");
    expect(result).toContain("My Title");
  });

  it("converts markdown bold to <strong>", () => {
    const result = markdownToDoc("**bold text**");
    expect(result).toContain("<strong>");
  });

  it("converts a markdown link to an <a> tag", () => {
    const result = markdownToDoc("[click here](https://example.com)");
    expect(result).toContain("<a");
    expect(result).toContain("https://example.com");
  });

  it("converts markdown code fences to <code> blocks", () => {
    const result = markdownToDoc("```\nconst x = 1;\n```");
    expect(result).toContain("<code>");
  });

  it("handles empty markdown string without throwing", () => {
    expect(() => markdownToDoc("")).not.toThrow();
  });

  it("returns a string for empty input", () => {
    const result = markdownToDoc("");
    expect(typeof result).toBe("string");
  });

  it("preserves plain text content inside the body", () => {
    const result = markdownToDoc("Hello, world!");
    expect(result).toContain("Hello, world!");
  });

  it("converts an unordered markdown list to <ul>/<li>", () => {
    const result = markdownToDoc("- item one\n- item two");
    expect(result).toContain("<ul>");
    expect(result).toContain("<li>");
  });
});
