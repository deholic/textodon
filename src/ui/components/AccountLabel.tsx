import React from "react";

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
  /** 아바타 크기 (기본값: 32px) */
  avatarSize?: number;
  /** 아리아 레이블 */
  ariaLabel?: string;
  /** 커스텀 이름 렌더링 (이모지 등 HTML 포함) */
  customNameNode?: React.ReactNode;
}

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
  avatarSize = 32,
  ariaLabel,
  customNameNode
}) => {
  const effectiveDisplayName = displayName || name || instanceUrl || "알 수 없음";
  const isInteractive = !!(onClick || accountUrl);

  const avatarElement = !hideAvatar ? (
    <span
      className="account-avatar"
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
        <span className="account-avatar-fallback" />
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
        data-interactive={isInteractive ? "true" : undefined}
      >
        {avatarElement}
      </span>
    );
  }

  const textContent = (
    <span className="account-text">
      <span>{customNameNode || effectiveDisplayName}</span>
      {handle ? <span className="account-handle">@{handle}</span> : null}
    </span>
  );

  return (
    <span
      className={`account-label ${className}`}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={ariaLabel}
      data-interactive={isInteractive ? "true" : undefined}
    >
      {avatarElement}
      {textContent}
    </span>
  );
};
