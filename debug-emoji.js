// Debug script for emoji shortcode regex
const buildEmojiMap = (customEmojis) => {
  const map = {};
  customEmojis.forEach(emoji => {
    map[emoji.shortcode] = emoji.url;
  });
  return map;
};

const testCustomEmojis = [
  { shortcode: 'custom_emoji', url: 'https://example.com/emoji1.png' },
  { shortcode: 'another-emoji', url: 'https://example.com/emoji2.png' },
  { shortcode: 'test.emoji', url: 'https://example.com/emoji3.png' }
];

const emojiMap = buildEmojiMap(testCustomEmojis);
const testHtml = '<p>Hello :custom_emoji: world :another-emoji: test :test.emoji:</p>';

console.log('Original HTML:', testHtml);
console.log('Emoji Map:', emojiMap);

let processedHtml = testHtml;

// Current implementation
Object.entries(emojiMap).forEach(([shortcode, url]) => {
  const escapedShortcode = shortcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`:${escapedShortcode}:`, 'g');
  console.log(`Processing shortcode: ${shortcode}`);
  console.log(`Escaped: ${escapedShortcode}`);
  console.log(`Regex: ${regex}`);
  const before = processedHtml;
  processedHtml = processedHtml.replace(regex, `<img src="${url}" alt=":${shortcode}:" class="custom-emoji" loading="lazy">`);
  console.log(`Before: ${before}`);
  console.log(`After: ${processedHtml}`);
  console.log('---');
});

console.log('Final HTML:', processedHtml);