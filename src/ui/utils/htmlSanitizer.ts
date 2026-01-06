import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to safely render in the DOM
 * Allows basic formatting tags for rich content display
 */
export const sanitizeHtml = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'a', 'strong', 'em', 'u', 's', 'code', 'pre',
      'blockquote', 'ul', 'ol', 'li', 'span'
    ],
    ALLOWED_ATTR: ['href', 'title', 'class'],
    FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover'],
    ALLOW_DATA_ATTR: false,
  });
};