/**
 * Unit tests: containsXmlHtmlTags from @/utils/text
 *
 * This function is used to detect whether model output contains XML/HTML markup
 * so the app can decide how to render it.  It must not produce false negatives
 * on common tag forms, and should not false-positive on plain text.
 */

import { containsXmlHtmlTags } from "@/utils/text";

// ---------------------------------------------------------------------------
// containsXmlHtmlTags
// ---------------------------------------------------------------------------

describe("containsXmlHtmlTags", () => {
  // Happy paths — should return true

  it("detects a simple HTML opening tag", () => {
    expect(containsXmlHtmlTags("<p>hello</p>")).toBe(true);
  });

  it("detects a div tag", () => {
    expect(containsXmlHtmlTags("<div>content</div>")).toBe(true);
  });

  it("detects a tag with attributes", () => {
    expect(containsXmlHtmlTags('<a href="https://example.com">link</a>')).toBe(true);
  });

  it("detects a self-closing tag", () => {
    expect(containsXmlHtmlTags("<img />")).toBe(true);
  });

  it("detects a void element without slash", () => {
    expect(containsXmlHtmlTags("<br>")).toBe(true);
  });

  it("detects a closing tag", () => {
    expect(containsXmlHtmlTags("</p>")).toBe(true);
  });

  it("detects an HTML comment", () => {
    expect(containsXmlHtmlTags("<!-- this is a comment -->")).toBe(true);
  });

  it("detects a CDATA section", () => {
    expect(containsXmlHtmlTags("<![CDATA[data]]>")).toBe(true);
  });

  it("detects a DOCTYPE declaration", () => {
    expect(containsXmlHtmlTags("<!DOCTYPE html>")).toBe(true);
  });

  it("detects an XML processing instruction", () => {
    expect(containsXmlHtmlTags('<?xml version="1.0"?>')).toBe(true);
  });

  it("detects the <think> tag used by reasoning models", () => {
    expect(containsXmlHtmlTags("<think>some reasoning</think>")).toBe(true);
  });

  it("detects uppercase tags (case-insensitive)", () => {
    expect(containsXmlHtmlTags("<DIV>content</DIV>")).toBe(true);
  });

  // Negative cases — should return false

  it("returns false for plain text with no tags", () => {
    expect(containsXmlHtmlTags("Hello, world!")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(containsXmlHtmlTags("")).toBe(false);
  });

  it("returns false for a non-string input (number)", () => {
    // TypeScript won't allow it but runtime guard is present
    expect(containsXmlHtmlTags(42 as unknown as string)).toBe(false);
  });

  it("returns false for text containing only angle brackets with no tag structure", () => {
    // "<3" is not a valid tag (no letter following <)
    expect(containsXmlHtmlTags("I <3 you")).toBe(false);
  });

  it("returns false for comparison operators alone", () => {
    expect(containsXmlHtmlTags("1 < 2 > 0")).toBe(false);
  });

  it("detects partial tag embedded in text", () => {
    // Text contains a valid tag somewhere in the middle
    expect(containsXmlHtmlTags("Some text <b>bold</b> end")).toBe(true);
  });
});
