const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeAttr = (text: string): string => escapeHtml(text).replace(/\(/g, "%28").replace(/\)/g, "%29");

const isSafeUrl = (url: string): boolean => {
  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return false;
  }
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
  return !hasScheme || /^https?:/i.test(trimmed);
};

const renderImageTag = (alt: string, url: string): string => {
  if (!isSafeUrl(url)) {
    return escapeHtml(`![${alt}](${url})`);
  }
  const safeAlt = escapeHtml(alt);
  const safeUrl = escapeAttr(url.trim());
  return `<img src="${safeUrl}" alt="${safeAlt}" loading="lazy" />`;
};

const renderEmojiTag = (shortcode: string, url: string): string => {
  if (!isSafeUrl(url)) {
    return escapeHtml(`:${shortcode}:`);
  }
  const safeUrl = escapeAttr(url.trim());
  const safeAlt = escapeHtml(`:${shortcode}:`);
  return `<img src="${safeUrl}" alt="${safeAlt}" class="custom-emoji" loading="lazy" />`;
};

const formatInline = (text: string, emojiMap?: Map<string, string>): string => {
  const codeSpans: string[] = [];
  let tokenized = text.replace(/`([^`]+)`/g, (_match, code) => {
    const safeCode = escapeHtml(code);
    codeSpans.push(`<code>${safeCode}</code>`);
    return `\u0001${codeSpans.length - 1}\u0001`;
  });
  const images: string[] = [];
  tokenized = tokenized.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, url) => {
    const imageTag = renderImageTag(alt, url);
    images.push(imageTag);
    return `\u0000${images.length - 1}\u0000`;
  });
  const emojis: string[] = [];
  if (emojiMap && emojiMap.size > 0) {
    tokenized = tokenized.replace(/:([a-zA-Z0-9_]+):/g, (_match, shortcode) => {
      const url = emojiMap.get(shortcode);
      if (!url) {
        return `:${shortcode}:`;
      }
      const emojiTag = renderEmojiTag(shortcode, url);
      emojis.push(emojiTag);
      return `\u0002${emojis.length - 1}\u0002`;
    });
  }
  let out = escapeHtml(tokenized);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label, url) => {
    const safeUrl = escapeAttr(url);
    return `<a href=\"${safeUrl}\" target=\"_blank\" rel=\"noreferrer\">${label}</a>`;
  });
  out = out.replace(/\u0000(\d+)\u0000/g, (_match, index) => images[Number(index)] ?? "");
  out = out.replace(/\u0002(\d+)\u0002/g, (_match, index) => emojis[Number(index)] ?? "");
  out = out.replace(/\u0001(\d+)\u0001/g, (_match, index) => codeSpans[Number(index)] ?? "");
  return out;
};

export const renderMarkdown = (markdown: string, emojiMap?: Map<string, string>): string => {
  const lines = markdown.split(/\r?\n/);
  const blocks: string[] = [];
  let inCode = false;
  let codeBuffer: string[] = [];
  let listBuffer: string[] = [];
  let paragraphBuffer: string[] = [];
  const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    const content = paragraphBuffer.map((line) => formatInline(line, emojiMap)).join("<br />");
    blocks.push(`<p>${content}</p>`);
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const items = listBuffer.map((item) => `<li>${formatInline(item, emojiMap)}</li>`).join("");
    blocks.push(`<ul>${items}</ul>`);
    listBuffer = [];
  };

  const flushCode = () => {
    if (!inCode) return;
    const code = escapeHtml(codeBuffer.join("\n"));
    blocks.push(`<pre><code>${code}</code></pre>`);
    codeBuffer = [];
    inCode = false;
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        flushCode();
      } else {
        flushParagraph();
        flushList();
        inCode = true;
        codeBuffer = [];
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    const trimmedLine = line.trim();
    if (trimmedLine.match(/^(!\[[^\]]*\]\([^)]+\)\s*)+$/)) {
      flushParagraph();
      flushList();
      const images: string[] = [];
      for (const match of trimmedLine.matchAll(imagePattern)) {
        images.push(renderImageTag(match[1], match[2]));
      }
      if (images.length > 0) {
        blocks.push(`<div class="readme-image-row">${images.join("")}</div>`);
        continue;
      }
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${formatInline(headingMatch[2], emojiMap)}</h${level}>`);
      continue;
    }

    const listMatch = line.match(/^-\s+(.*)$/);
    if (listMatch) {
      flushParagraph();
      listBuffer.push(listMatch[1]);
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  flushList();
  flushCode();

  return blocks.join("");
};
