import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to safely render in the DOM
 * Allows basic formatting tags for rich content display
 */
export const sanitizeHtml = (html: string): string => {
  const processedHtml = (() => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      doc.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
        const href = anchor.getAttribute("href");
        if (!href) {
          return;
        }
        if (href.startsWith("http://") || href.startsWith("https://")) {
          if (!anchor.hasAttribute("target")) {
            anchor.setAttribute("target", "_blank");
          }
          if (!anchor.hasAttribute("rel")) {
            anchor.setAttribute("rel", "noreferrer");
          }
        }
      });
      return doc.body.innerHTML;
    } catch {
      return html;
    }
  })();

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
