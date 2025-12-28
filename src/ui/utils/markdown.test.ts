import { describe, expect, it } from "bun:test";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("renders headings and paragraphs with inline formatting", () => {
    const input = "# Hello\n\nLine *em*\nNext";
    const output = renderMarkdown(input);

    expect(output).toBe("<h1>Hello</h1><p>Line <em>em</em><br />Next</p>");
  });

  it("renders unordered lists", () => {
    const input = "- one\n- two";
    const output = renderMarkdown(input);

    expect(output).toBe("<ul><li>one</li><li>two</li></ul>");
  });

  it("escapes code blocks", () => {
    const input = "```\nconst a = 1 & 2\n```";
    const output = renderMarkdown(input);

    expect(output).toBe("<pre><code>const a = 1 &amp; 2</code></pre>");
  });

  it("escapes link URLs", () => {
    const input = "[go](https://example.com/a(b))";
    const output = renderMarkdown(input);

    expect(output).toBe(
      '<p><a href="https://example.com/a%28b" target="_blank" rel="noreferrer">go</a>)</p>'
    );
  });
});
