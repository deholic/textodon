import { describe, expect, it } from "bun:test";
import { formatHandle, normalizeInstanceUrl, parseAccountLabel } from "./account";

describe("account utils", () => {
  it("normalizes instance URLs", () => {
    expect(normalizeInstanceUrl(" example.com/ ")).toBe("https://example.com");
    expect(normalizeInstanceUrl("https://example.com/")).toBe("https://example.com");
    expect(normalizeInstanceUrl("")).toBe("");
  });

  it("formats handles with instance hostnames", () => {
    expect(formatHandle("alice", "https://social.example")).toBe("alice@social.example");
    expect(formatHandle("bob@else", "https://social.example")).toBe("bob@else");
    expect(formatHandle("alice", "not-a-url")).toBe("alice");
  });

  it("parses account labels", () => {
    expect(parseAccountLabel("Alice @alice@example.com")).toBeNull();
    expect(parseAccountLabel("Alice \\s@alice@example.com")).toEqual({
      displayName: "Alice",
      handle: "alice@example.com"
    });
    expect(parseAccountLabel("Alice")).toBeNull();
  });
});
