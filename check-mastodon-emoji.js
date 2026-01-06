// Let's check what Mastodon actually sends for custom emojis in HTML

// From Mastodon documentation and examples, custom emojis in HTML content
// are NOT represented as :shortcode: but as <img> tags directly
const mastodonEmojiExample = `<p>Test content <img src="https://mastodon.example/emojis/custom_emoji.png" alt=":custom_emoji:" class="custom-emoji"> with emojis</p>`;

console.log('=== Mastodon Custom Emoji HTML Example ===');
console.log('Mastodon sends custom emojis as img tags, not as :shortcode: text');
console.log('Example:', mastodonEmojiExample);
console.log('');
console.log('Our current logic expects :shortcode: format in HTML, but Mastodon');
console.log('actually sends <img> tags directly in the HTML content.');
console.log('');
console.log('The issue might be:');
console.log('1. We are looking for :shortcode: that does not exist in HTML');
console.log('2. Or there is a mismatch in shortcode detection');
console.log('');
console.log('Debug suggestions:');
console.log('- Check actual HTML content from displayStatus.htmlContent');
console.log('- Check if customEmojis array matches what we expect');
console.log('- Check if showCustomEmojis is true');