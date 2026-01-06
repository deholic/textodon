// Debug to check what data is being passed to buildEmojiMap

// This simulates what happens in the actual TimelineItem component

// Mock the data structure that might be coming from Mastodon
const displayStatus = {
  hasRichContent: true,
  htmlContent: '<p>Test content with emojis</p>',
  customEmojis: [
    { shortcode: 'custom_emoji', url: 'https://example.com/emoji1.png' },
    { shortcode: 'another_emoji', url: 'https://example.com/emoji2.png' }
  ],
  content: 'Test content with emojis'
};

console.log('=== Status Data Debug ===');
console.log('hasRichContent:', displayStatus.hasRichContent);
console.log('htmlContent:', displayStatus.htmlContent);
console.log('customEmojis:', displayStatus.customEmojis);
console.log('customEmojis.length:', displayStatus.customEmojis.length);
console.log('customEmojis array:', Array.isArray(displayStatus.customEmojis));
console.log('');

// Test buildEmojiMap function
const buildEmojiMap = (emojis) => {
  console.log('buildEmojiMap received:', emojis);
  console.log('Array.isArray:', Array.isArray(emojis));
  console.log('emojis.length:', emojis?.length);
  
  const result = new Map(emojis.map((emoji) => [emoji.shortcode, emoji.url]));
  console.log('buildEmojiMap result size:', result.size);
  console.log('buildEmojiMap result entries:', Array.from(result.entries()));
  return result;
};

const emojiMap = buildEmojiMap(displayStatus.customEmojis);
console.log('');
console.log('Final emojiMap:', emojiMap);