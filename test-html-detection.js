// Test script for HTML tag detection
const hasHtmlTags = (content) => content ? /<[^>]+>/g.test(content) : false;

// Test cases based on Mastodon status examples
const testCases = [
  // Real HTML content from Mastodon example
  {
    name: "HTML with paragraphs and links",
    content: `<p>&quot;I lost my inheritance with one wrong digit on my sort code&quot;</p><p><a href="https://www.theguardian.com/money/2019/dec/07/i-lost-my-193000-inheritance-with-one-wrong-digit-on-my-sort-code" rel="nofollow noopener noreferrer" target="_blank"><span class="invisible">https://www.</span><span class="ellipsis">theguardian.com/money/2019/dec</span><span class="invisible">/07/i-lost-my-193000-inheritance-with-one-wrong-digit-on-my-sort-code</span></a></p>`,
    expected: true
  },
  // Plain text content from Misskey
  {
    name: "Plain text no tags",
    content: "This is just plain text with no HTML tags at all.",
    expected: false
  },
  // Edge cases
  {
    name: "Text with angle brackets but not HTML",
    content: "This has <brackets> but not real HTML tags.",
    expected: true // Should detect as HTML due to brackets
  },
  {
    name: "Text with entities only",
    content: "This text has &quot;quotes&quot; and &amp; ampersands.",
    expected: false
  },
  {
    name: "Simple HTML",
    content: "<p>Simple paragraph</p>",
    expected: true
  },
  {
    name: "HTML with line breaks",
    content: "Line 1<br>Line 2",
    expected: true
  },
  {
    name: "Empty content",
    content: "",
    expected: false
  },
  {
    name: "Null content",
    content: null,
    expected: false
  },
  {
    name: "Mixed content",
    content: "Visit <a href='https://example.com'>example.com</a> today!",
    expected: true
  }
];

console.log("=== HTML Tag Detection Test ===\n");

testCases.forEach((testCase, i) => {
  const result = hasHtmlTags(testCase.content);
  const status = result === testCase.expected ? "✅" : "❌";
  console.log(`${i + 1}. ${testCase.name}`);
  const contentPreview = testCase.content ? `"${testCase.content.substring(0, 80)}${testCase.content.length > 80 ? '...' : ''}"` : "null";
  console.log(`   Content: ${contentPreview}`);
  console.log(`   Expected: ${testCase.expected}, Got: ${result} ${status}\n`);
});