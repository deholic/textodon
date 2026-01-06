// Test script for HTML to text conversion (Node.js compatible)
const htmlToText = (html) => {
  // Preserve links as "text (url)" format before DOM parsing
  const withLinkPreservation = html.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)');
  
  const withBreaks = withLinkPreservation
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n");
    
  // Simple HTML tag removal for Node.js environment
  const text = withBreaks.replace(/<[^>]*>/g, '');
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
};

// Test cases
const testCases = [
  'Simple: <a href="https://example.com">Link text</a>',
  'Mixed: <p>Visit <a href="https://mastodon.social">Mastodon</a> today!</p>',
  'Complex: <div>Check out <a href="https://github.com/user/repo">this repo</a><br>It\'s awesome.</div>',
  'Multiple: <a href="https://one.com">One</a> and <a href="https://two.com">Two</a>',
  'No links: <p>Just plain text</p>',
  'Styled: <a href="https://example.com" class="link">Styled link</a>',
];

console.log("=== Phase 2 HTML to Text Conversion Test ===\n");

testCases.forEach((testCase, i) => {
  console.log(`${i + 1}. HTML: ${testCase}`);
  console.log(`   Text: ${htmlToText(testCase)}\n`);
});