// Test script for HTML sanitization (Node.js compatible simulation)
const sanitizeHtml = (html) => {
  // Simple HTML sanitization for Node.js testing
  // In browser, DOMPurify will be used
  const allowedTags = new Set(['p', 'br', 'a', 'strong', 'em', 'u', 's', 'code', 'pre', 'span']);
  const allowedAttrs = new Set(['href', 'title', 'class']);
  
  return html.replace(/<(\w+)([^>]*)>/g, (match, tag, attrs) => {
    if (!allowedTags.has(tag.toLowerCase())) return '';
    
    if (tag.toLowerCase() === 'a') {
      // Keep only href and title attributes for a tags
      const hrefMatch = attrs.match(/href="([^"]*)"/);
      const titleMatch = attrs.match(/title="([^"]*)"/);
      let cleanAttrs = '';
      if (hrefMatch) cleanAttrs += ` href="${hrefMatch[1]}"`;
      if (titleMatch) cleanAttrs += ` title="${titleMatch[1]}"`;
      return `<${tag}${cleanAttrs}>`;
    }
    
    // Remove all attributes for other allowed tags
    return `<${tag}>`;
  }).replace(/<\/(\w+)>/g, (match, tag) => {
    if (allowedTags.has(tag.toLowerCase())) return match;
    return '';
  });
};

// Test cases
const testCases = [
  'Safe: <p>Visit <a href="https://example.com">Mastodon</a> today!</p>',
  'Formatting: <strong>Bold</strong> and <em>italic</em> text',
  'Unsafe: <p><script>alert("xss")</script>Bad content</p>',
  'Complex: <div class="post"><p><a href="https://mastodon.social" title="Mastodon">Check this</a><br><strong>Awesome!</strong></p></div>',
  'Mixed: <p>Safe <span class="highlight">content</span> with <code>code</code></p>',
];

console.log("=== Phase 3 HTML Sanitization Test ===\n");

testCases.forEach((testCase, i) => {
  console.log(`${i + 1}. Input: ${testCase}`);
  console.log(`   Output: ${sanitizeHtml(testCase)}\n`);
});