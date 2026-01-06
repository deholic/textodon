import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to safely render in the DOM
 * Allows basic formatting tags for rich content display
 */
export const sanitizeHtml = (html: string): string => {
  // Pre-process HTML to add target="_blank" to all external links
  const processedHtml = html.replace(/<a\s+([^>]*)href="([^"]*)"([^>]*)>/gi, (match, attrs, href, rest) => {
    // Check if it's an external link (starts with http)
    if (href.startsWith('http://') || href.startsWith('https://')) {
      // Add target="_blank" and rel="noreferrer" if not already present
      const hasTarget = /target\s*=\s*["'][^"']*["']/.test(attrs + rest);
      const hasRel = /rel\s*=\s*["'][^"']*["']/.test(attrs + rest);
      
      let newAttrs = attrs + rest;
      if (!hasTarget) {
        newAttrs += ' target="_blank"';
      }
      if (!hasRel) {
        newAttrs += ' rel="noreferrer"';
      }
      return `<a ${newAttrs}href="${href}">`;
    }
    return match;
  });

  return DOMPurify.sanitize(processedHtml, {
    ALLOWED_TAGS: [
      'p', 'br', 'a', 'strong', 'em', 'u', 's', 'code', 'pre',
      'blockquote', 'ul', 'ol', 'li', 'span', 'img'
    ],
    ALLOWED_ATTR: ['href', 'title', 'class', 'src', 'alt', 'loading', 'target', 'rel'],
    FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover'],
    ALLOW_DATA_ATTR: false,
  });
};