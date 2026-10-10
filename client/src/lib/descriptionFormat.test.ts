import { describe, expect, it } from "vitest";
import { applyFormat } from "./descriptionFormat";

describe("applyFormat bold", () => {
  it("wraps the selection", () => {
    expect(applyFormat("Soft cotton tee", 5, 11, "bold")).toEqual({ text: "Soft **cotton** tee", selectionStart: 7, selectionEnd: 13 });
  });

  it("inserts a placeholder when nothing is selected and selects it", () => {
    const result = applyFormat("Hello ", 6, 6, "bold");
    expect(result.text).toBe("Hello **important detail**");
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe("important detail");
  });
});

describe("applyFormat bullet", () => {
  it("bullets a single line, even when only part of it is selected", () => {
    expect(applyFormat("Pre-shrunk fabric", 4, 9, "bullet").text).toBe("- Pre-shrunk fabric");
  });

  it("bullets every selected line and leaves the others alone", () => {
    const text = "Intro\nLine one\nLine two\nOutro";
    const result = applyFormat(text, text.indexOf("Line one"), text.indexOf("Line two") + 4, "bullet");
    expect(result.text).toBe("Intro\n- Line one\n- Line two\nOutro");
  });

  it("does not double-bullet lines that already have one, and skips blank lines", () => {
    const text = "- Already\nPlain\n\nLast";
    expect(applyFormat(text, 0, text.length, "bullet").text).toBe("- Already\n- Plain\n\n- Last");
  });

  it("adds a placeholder bullet on an empty description", () => {
    expect(applyFormat("", 0, 0, "bullet").text).toBe("- bullet point");
  });
});
