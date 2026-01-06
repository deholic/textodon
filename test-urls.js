// Test script for URL regex
const URL_REGEX = /(https?:\/\/[^\s)\]]+|www\.[^\s)\]]+|(?![\w.-]+@)[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s)\]]*)?)(?![\w@.-])/g;

function normalizeUrl(url) {
  return url.match(/^https?:\/\//) ? url : `https://${url}`;
}

function renderTextWithLinks(text) {
  const parts = [];
  let lastIndex = 0;
  let match;
  let key = 0;
  
  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const url = match[0];
    const normalizedUrl = normalizeUrl(url);
    parts.push(`[${url}](${normalizedUrl})`);
    key += 1;
    lastIndex = match.index + url.length;
  }
  
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts.join('');
}

// Test cases
const testCases = [
  "Visit https://example.com for more info",
  "Check out www.google.com",
  "Go to github.com/user",
  "Multiple: mastodon.social and test@example.com",
  "Edge case: test.co.uk/path",
  "Mixed: https://secure.com and plain-site.org",
  "Not a link: just text",
  "Trailing punctuation: visit example.com!",
  "With port: localhost:3000",
];

console.log("=== Phase 1 URL Detection Test ===\n");

testCases.forEach((testCase, i) => {
  console.log(`${i + 1}. Input: ${testCase}`);
  console.log(`   Output: ${renderTextWithLinks(testCase)}\n`);
});