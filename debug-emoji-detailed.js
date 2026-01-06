// More detailed debug for emoji processing

// Simulate the actual buildEmojiMap function from TimelineItem.tsx
const buildEmojiMap = (emojis) => {
  return new Map(emojis.map((emoji) => [emoji.shortcode, emoji.url]));
};

// Simulate actual HTML content from Mastodon
const mastodonHtml = `<p>Test content :custom_emoji: with :another_emoji: emojis</p>`;
const customEmojis = [
  { shortcode: 'custom_emoji', url: 'https://example.com/emoji1.png' },
  { shortcode: 'another_emoji', url: 'https://example.com/emoji2.png' }
];

console.log('=== HTML Content Processing Debug ===');
console.log('Original HTML:', mastodonHtml);
console.log('Custom emojis:', customEmojis);

// Step 1: Build emoji map
const emojiMap = buildEmojiMap(customEmojis);
console.log('Emoji map:', emojiMap);

// Step 2: Process HTML
let processedHtml = mastodonHtml;

// Step 3: Check what the regex does for each emoji
Object.entries(emojiMap).forEach(([shortcode, url]) => {
  const escapedShortcode = shortcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`:${escapedShortcode}:`, 'g');
  
  console.log(`\\nProcessing: ${shortcode}`);
  console.log(`Escaped: ${escapedShortcode}`);
  console.log(`Regex: ${regex}`);
  console.log(`Before: ${processedHtml}`);
  
  const before = processedHtml;
  processedHtml = processedHtml.replace(regex, `<img src="${url}" alt=":${shortcode}:" class="custom-emoji" loading="lazy">`);
  
  console.log(`After: ${processedHtml}`);
  console.log(`Changed: ${before !== processedHtml}`);
});

console.log('\\nFinal processed HTML:', processedHtml);

// Test if our regex actually matches
const testRegex1 = /:custom_emoji:/g;
const testRegex2 = /:another_emoji:/g;

console.log('\\n=== Regex Test ===');
console.log('HTML matches :custom_emoji:?', testRegex1.test(mastodonHtml));
console.log('HTML matches :another_emoji:?', testRegex2.test(mastodonHtml));
console.log('Regex1 matches:', mastodonHtml.match(testRegex1));
console.log('Regex2 matches:', mastodonHtml.match(testRegex2));