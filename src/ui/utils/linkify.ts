import React from "react";

export type MentionLink = {
  id?: string | null;
  handle: string;
  url: string | null;
  displayName?: string;
};

export type LinkifyOptions = {
  mentionResolver?: (handle: string) => MentionLink | null;
  onMentionClick?: (mention: MentionLink) => void;
};

const mentionPattern =
  /@[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?=[^\w@]|$)/g;
const urlPattern =
  /(https?:\/\/[^\s)\]]+|www\.[^\s)\]]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s)\]]*)?)(?=[^\w@]|$)/g;
const linkPattern = new RegExp(`${mentionPattern.source}|${urlPattern.source}`, "g");

const normalizeUrl = (url: string): string => (url.match(/^https?:\/\//) ? url : `https://${url}`);
const normalizeMentionHandle = (handle: string): string => handle.replace(/^@/, "").trim().toLowerCase();
const buildMentionUrl = (handle: string): string | null => {
  const normalized = normalizeMentionHandle(handle);
  if (!normalized.includes("@")) {
    return null;
  }
  const [username, ...rest] = normalized.split("@");
  const host = rest.join("@");
  if (!username || !host) {
    return null;
  }
  return `https://${host}/@${username}`;
};

export const isPlainUrl = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("@")) {
    return false;
  }
  return /^(https?:\/\/[^\s)\]]+|www\.[^\s)\]]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s)\]]*)?)$/.test(
    trimmed
  );
};

export const renderTextWithLinks = (
  text: string,
  keyPrefix: string,
  options?: LinkifyOptions
): React.ReactNode[] => {
  linkPattern.lastIndex = 0;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const matched = match[0];
    if (matched.startsWith("@") && matched.includes("@")) {
      const normalizedHandle = normalizeMentionHandle(matched);
      const mention = options?.mentionResolver?.(normalizedHandle) ?? null;
      const mentionUrl = mention?.url ?? buildMentionUrl(matched);
      if (mention && options?.onMentionClick) {
        parts.push(
          React.createElement(
            "button",
            {
              key: `${keyPrefix}-mention-${key}`,
              type: "button",
              className: "text-link",
              onClick: () => options.onMentionClick?.(mention),
              "aria-label": `${mention.displayName ?? mention.handle} 프로필 보기`
            },
            matched
          )
        );
      } else if (mentionUrl) {
        parts.push(
          React.createElement(
            "a",
            { key: `${keyPrefix}-mention-${key}`, href: mentionUrl, target: "_blank", rel: "noreferrer" },
            matched
          )
        );
      } else {
        parts.push(matched);
      }
    } else {
      const looksLikeUrlWithAt =
        matched.includes("@") &&
        (matched.startsWith("http://") ||
          matched.startsWith("https://") ||
          matched.startsWith("www.") ||
          matched.includes("/"));
      if (matched.includes("@") && !looksLikeUrlWithAt) {
        parts.push(matched);
      } else {
        const normalizedUrl = normalizeUrl(matched);
        parts.push(
          React.createElement(
            "a",
            { key: `${keyPrefix}-link-${key}`, href: normalizedUrl, target: "_blank", rel: "noreferrer" },
            matched
          )
        );
      }
    }
    key += 1;
    lastIndex = match.index + matched.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
};

export const renderTextWithLinksAndLineBreaks = (
  text: string,
  keyPrefix: string,
  options?: LinkifyOptions
): React.ReactNode[] => {
  const lines = text.split(/\r?\n/);
  const nodes: React.ReactNode[] = [];
  lines.forEach((line, index) => {
    if (index > 0) {
      nodes.push(React.createElement("br", { key: `${keyPrefix}-br-${index}` }));
    }
    nodes.push(...renderTextWithLinks(line, `${keyPrefix}-line-${index}`, options));
  });
  return nodes;
};
