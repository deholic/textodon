import React from "react";
import type { CustomEmoji } from "../../domain/types";

export interface AccountLabelProps {
  /** 아바타 이미지 URL */
  avatarUrl?: string | null;
  /** 표시 이름 (우선순위 1) */
  displayName?: string | null;
  /** 계정 이름 (우선순위 2, displayName이 없을 때) */
  name?: string | null;
  /** 핸들 (@username 형식) */
  handle?: string | null;
  /** 인스턴스 URL (우선순위 3, displayName과 name이 모두 없을 때) */
  instanceUrl?: string;
  /** 계정 프로필 URL (링크 처리용) */
  accountUrl?: string | null;
  /** 클릭 핸들러 */
  onClick?: () => void;
  /** 키보드 이벤트 핸들러 */
  onKeyDown?: (event: React.KeyboardEvent) => void;
  /** 아바타만 표시할지 여부 */
  avatarOnly?: boolean;
  /** 아바타를 숨길지 여부 */
  hideAvatar?: boolean;
  /** 커스텀 클래스 이름 */
  className?: string;
  /** 아바타 컨테이너 클래스 이름 (기본값: "account-avatar") */
  avatarClassName?: string;
  /** 아바타 폴백 클래스 이름 (기본값: "account-avatar-fallback") */
  avatarFallbackClassName?: string;
  /** 텍스트 컨테이너 클래스 이름 (기본값: "account-text") */
  textContainerClassName?: string;
  /** 핸들 클래스 이름 (기본값: "account-handle") */
  handleClassName?: string;
  /** 아바타 크기 (기본값: 32px) */
  avatarSize?: number;
  /** 아리아 레이블 */
  ariaLabel?: string;
  /** 커스텀 이름 렌더링 (이모지 등 HTML 포함) */
  customNameNode?: React.ReactNode;
  /** 커스텀 이모지 목록 */
  customEmojis?: CustomEmoji[];
  /** 텍스트를 별도 div로 렌더링 (기본값: false, span 사용) */
  textAsDiv?: boolean;
  /** 이름을 굵게 표시할지 여부 (기본값: false) */
  boldName?: boolean;
}

const buildEmojiMap = (emojis: CustomEmoji[]): Map<string, string> =>
  new Map(emojis.map((emoji) => [emoji.shortcode, emoji.url]));

const tokenizeWithEmojis = (
  text: string,
  emojiMap: Map<string, string>
): Array<{ type: "text"; value: string } | { type: "emoji"; name: string; url: string }> => {
  const regex = /:([a-zA-Z0-9_]+):/g;
  const tokens: Array<{ type: "text"; value: string } | { type: "emoji"; name: string; url: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const shortcode = match[1];
    const url = emojiMap.get(shortcode);
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    if (url) {
      tokens.push({ type: "emoji", name: shortcode, url });
    } else {
      tokens.push({ type: "text", value: match[0] });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.slice(lastIndex) });
  }
  return tokens;
};

const renderNameWithEmojis = (value: string, customEmojis?: CustomEmoji[]): React.ReactNode => {
  if (!customEmojis || customEmojis.length === 0) {
    return value;
  }
  const emojiMap = buildEmojiMap(customEmojis);
  const tokens = tokenizeWithEmojis(value, emojiMap);
  return tokens.map((token, index) => {
    if (token.type === "emoji") {
      return (
        <img
          key={`emoji-${token.name}-${index}`}
          src={token.url}
          alt={`:${token.name}:`}
          className="custom-emoji"
          loading="lazy"
        />
      );
    }
    return <React.Fragment key={`text-${index}`}>{token.value}</React.Fragment>;
  });
};

/**
 * 계정 정보를 표시하는 재사용 가능한 컴포넌트
 * 아바타 + 표시명 + 핸들 패턴을 통합
 */
export const AccountLabel: React.FC<AccountLabelProps> = ({
  avatarUrl,
  displayName,
  name,
  handle,
  instanceUrl,
  accountUrl,
  onClick,
  onKeyDown,
  avatarOnly = false,
  hideAvatar = false,
  className = "",
  avatarClassName = "account-avatar",
  avatarFallbackClassName = "account-avatar-fallback",
  textContainerClassName = "account-text",
  handleClassName = "account-handle",
  avatarSize = 32,
  ariaLabel,
  customNameNode,
  customEmojis,
  textAsDiv = false,
  boldName = false
}) => {
  const effectiveDisplayName = displayName || name || instanceUrl || "알 수 없음";
  const isInteractive = !!(onClick || accountUrl);
  
  // 툴팁에 표시할 전체 텍스트 계산
  const fullText = handle ? `${effectiveDisplayName} (@${handle})` : effectiveDisplayName;

  const avatarElement = !hideAvatar ? (
    <span
      className={avatarClassName}
      aria-hidden="true"
      style={
        avatarSize !== 32
          ? {
              width: `${avatarSize}px`,
              height: `${avatarSize}px`
            }
          : undefined
      }
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" loading="lazy" />
      ) : (
        <span className={avatarFallbackClassName} />
      )}
    </span>
  ) : null;

  if (avatarOnly) {
    return (
      <span
        className={`account-label-avatar-only ${className}`}
        onClick={onClick}
        onKeyDown={onKeyDown}
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        aria-label={ariaLabel}
        title={ariaLabel || fullText}
        data-interactive={isInteractive ? "true" : undefined}
      >
        {avatarElement}
      </span>
    );
  }

  const TextContainer = textAsDiv ? "div" : "span";
  const nameContent = customNameNode ?? renderNameWithEmojis(effectiveDisplayName, customEmojis);
  const textContent = (
    <TextContainer className={textContainerClassName}>
      {boldName ? <strong>{nameContent}</strong> : <span>{nameContent}</span>}
      {handle ? <span className={handleClassName}>@{handle}</span> : null}
    </TextContainer>
  );

  return (
    <span
      className={`account-label ${className}`}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={ariaLabel}
      title={ariaLabel || fullText}
      data-interactive={isInteractive ? "true" : undefined}
    >
      {avatarElement}
      {textContent}
    </span>
  );
};
