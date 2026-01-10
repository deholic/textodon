import React from "react";

const urlPattern =
  /(https?:\/\/[^\s)\]]+|www\.[^\s)\]]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s)\]]*)?)(?=[^\w@]|$)/g;

const normalizeUrl = (url: string): string => (url.match(/^https?:\/\//) ? url : `https://${url}`);

export const isPlainUrl = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("@")) {
    return false;
  }
  return /^(https?:\/\/[^\s)\]]+|www\.[^\s)\]]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s)\]]*)?)$/.test(
    trimmed
  );
};

export const renderTextWithLinks = (text: string, keyPrefix: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = urlPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const url = match[0];
    if (url.includes("@")) {
      parts.push(url);
    } else {
      const normalizedUrl = normalizeUrl(url);
      parts.push(
        React.createElement(
          "a",
          { key: `${keyPrefix}-link-${key}`, href: normalizedUrl, target: "_blank", rel: "noreferrer" },
          url
        )
      );
    }
    key += 1;
    lastIndex = match.index + url.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
};

export const renderTextWithLinksAndLineBreaks = (
  text: string,
  keyPrefix: string
): React.ReactNode[] => {
  const lines = text.split(/\r?\n/);
  const nodes: React.ReactNode[] = [];
  lines.forEach((line, index) => {
    if (index > 0) {
      nodes.push(React.createElement("br", { key: `${keyPrefix}-br-${index}` }));
    }
    nodes.push(...renderTextWithLinks(line, `${keyPrefix}-line-${index}`));
  });
  return nodes;
};
