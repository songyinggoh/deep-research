/**
 * @jest-environment node
 */

/**
 * Unit tests: file utility functions from @/utils/file
 *
 * Only pure functions are tested here.  downloadFile relies on file-saver and
 * browser File API, so it is excluded.
 *
 * formatSize and getTextByteSize are pure helpers used in the UI to display
 * human-readable file sizes and byte counts.
 */

import { formatSize, getTextByteSize } from "@/utils/file";

// ---------------------------------------------------------------------------
// formatSize
// ---------------------------------------------------------------------------

describe("formatSize", () => {
  it("returns '0' for undefined size", () => {
    // The function guards for undefined explicitly
    expect(formatSize(undefined as unknown as number)).toBe("0");
  });

  it("formats bytes below 1024 as 'Bytes'", () => {
    expect(formatSize(512)).toBe("512 Bytes");
  });

  it("formats exactly 1024 bytes as '1 KB'", () => {
    // 1024 / 1024 = 1.00 → ".00" is stripped → "1 KB"
    expect(formatSize(1024)).toBe("1 KB");
  });

  it("formats 1.5 KB correctly (trailing zero not stripped)", () => {
    // .replace(".00", "") only strips ".00"; ".50" is preserved as-is
    expect(formatSize(1536)).toBe("1.50 KB");
  });

  it("formats 1 MB (1024 * 1024 bytes)", () => {
    expect(formatSize(1024 * 1024)).toBe("1 MB");
  });

  it("formats 1 GB correctly", () => {
    expect(formatSize(1024 * 1024 * 1024)).toBe("1 GB");
  });

  it("respects custom pointLength argument", () => {
    // 1536 bytes with pointLength=3 → "1.500" but .replace(".00","") does not match → "1.500 KB"
    expect(formatSize(1536, 3)).toBe("1.500 KB");
  });

  it("accepts custom units array", () => {
    const result = formatSize(512, 2, ["B", "KiB", "MiB"]);
    expect(result).toBe("512 B");
  });

  it("formats 0 bytes as '0 Bytes'", () => {
    expect(formatSize(0)).toBe("0 Bytes");
  });

  it("handles sizes in TB range", () => {
    const tb = 1024 * 1024 * 1024 * 1024;
    expect(formatSize(tb)).toBe("1 TB");
  });
});

// ---------------------------------------------------------------------------
// getTextByteSize
// ---------------------------------------------------------------------------

describe("getTextByteSize", () => {
  it("returns 0 for an empty string", () => {
    expect(getTextByteSize("")).toBe(0);
  });

  it("returns the correct byte count for ASCII text (1 byte per char)", () => {
    expect(getTextByteSize("hello")).toBe(5);
  });

  it("returns the correct byte count for multi-byte UTF-8 characters", () => {
    // Chinese characters encode to 3 bytes each in UTF-8
    expect(getTextByteSize("你好")).toBe(6);
  });

  it("returns the correct byte count for emoji (4 bytes each in UTF-8)", () => {
    // Most emoji are 4 bytes in UTF-8
    expect(getTextByteSize("😀")).toBe(4);
  });

  it("counts mixed ASCII and multi-byte correctly", () => {
    // "A" (1) + "中" (3) = 4 bytes
    expect(getTextByteSize("A中")).toBe(4);
  });

  it("handles a newline character (1 byte)", () => {
    expect(getTextByteSize("\n")).toBe(1);
  });
});
