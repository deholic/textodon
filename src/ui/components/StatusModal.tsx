import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Account, CustomEmoji, Status, ThreadContext } from "../../domain/types";
import type { MastodonApi } from "../../services/MastodonApi";
import { TimelineItem } from "./TimelineItem";
import BoostIcon from "../assets/boost-icon.svg?react";
import { useToast } from "../state/ToastContext";

export const StatusModal = ({
  status,
  account,
  threadAccount,
  api,
  zIndex,
  onClose,
  onReply,
  onToggleFavourite,
  onToggleReblog,
  onToggleBookmark,
  onDelete,
  onProfileClick,
  activeHandle,
  activeAccountHandle,
  activeAccountUrl,
  showProfileImage,
  showCustomEmojis,
  showReactions
}: {
  status: Status;
  account: Account | null;
  threadAccount: Account | null;
  api: MastodonApi;
  zIndex?: number;
  onClose: () => void;
  onReply: (status: Status) => void;
  onToggleFavourite: (status: Status) => void;
  onToggleReblog: (status: Status) => void;
  onToggleBookmark: (status: Status) => void;
  onDelete?: (status: Status) => void;
  onProfileClick?: (status: Status, account: Account | null) => void;
  activeHandle: string;
  activeAccountHandle: string;
  activeAccountUrl: string | null;
  showProfileImage: boolean;
  showCustomEmojis: boolean;
  showReactions: boolean;
}) => {
  const displayStatus = status.reblog ?? status;
  const boostedBy = status.reblog ? status.boostedBy : null;
  const renderEmojiText = useCallback(
    (text: string, customEmojis: CustomEmoji[]): React.ReactNode => {
      if (!showCustomEmojis || customEmojis.length === 0) {
        return text;
      }
      const emojiMap = new Map(customEmojis.map((emoji) => [emoji.shortcode, emoji.url]));
      const regex = /:([a-zA-Z0-9_]+):/g;
      const nodes: React.ReactNode[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      let segmentIndex = 0;
      while ((match = regex.exec(text)) !== null) {
        const shortcode = match[1];
        const url = emojiMap.get(shortcode);
        if (match.index > lastIndex) {
          nodes.push(
            <React.Fragment key={`label-text-${segmentIndex}`}>
              {text.slice(lastIndex, match.index)}
            </React.Fragment>
          );
          segmentIndex += 1;
        }
        if (url) {
          nodes.push(
            <img
              key={`label-emoji-${shortcode}-${segmentIndex}`}
              src={url}
              alt={`:${shortcode}:`}
              className="custom-emoji"
              loading="lazy"
            />
          );
        } else {
          nodes.push(
            <React.Fragment key={`label-raw-${segmentIndex}`}>
              {match[0]}
            </React.Fragment>
          );
        }
        segmentIndex += 1;
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < text.length) {
        nodes.push(
          <React.Fragment key={`label-text-${segmentIndex}`}>{text.slice(lastIndex)}</React.Fragment>
        );
      }
      return nodes;
    },
    [showCustomEmojis]
  );
  const boostedLabel = useMemo(() => {
    if (!boostedBy) {
      return null;
    }
    const label = boostedBy.name || boostedBy.handle;
    const labelNode = renderEmojiText(label, status.accountEmojis);
    return (
      <>
        {labelNode} 님이 부스트함
      </>
    );
  }, [boostedBy, renderEmojiText, status.accountEmojis]);
  const handleProfileClick = useCallback(
    (target: Status) => {
      if (!onProfileClick) {
        return;
      }
      onProfileClick(target, threadAccount ?? account ?? null);
    },
    [account, onProfileClick, threadAccount]
  );
  
  // 스레드 컨텍스트 상태
  const [threadContext, setThreadContext] = useState<ThreadContext | null>(null);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const { showToast } = useToast();

  // 스레드 컨텍스트 가져오기
  useEffect(() => {
    if (!account || !api) return;
    
    const fetchThreadContext = async () => {
      setIsLoadingThread(true);
      setThreadError(null);
      
      try {
        // 스레드를 가져올 때는 해당 게시글이 속한 컬럼의 계정 사용
        const targetAccount = threadAccount || account;
        const context = await api.fetchThreadContext(targetAccount, displayStatus.id);
        setThreadContext(context);
      } catch (error) {
        console.error("스레드 컨텍스트 로딩 실패:", error);
        setThreadError("스레드를 불러오지 못했습니다.");
      } finally {
        setIsLoadingThread(false);
      }
    };

    fetchThreadContext();
  }, [account, api, displayStatus.id]);

  useEffect(() => {
    if (!threadError) {
      return;
    }
    showToast(threadError, { tone: "error" });
    setThreadError(null);
  }, [showToast, threadError]);

  return (
    <div
      className="status-modal"
      role="dialog"
      aria-modal="true"
      aria-label="글 보기"
      style={zIndex ? { zIndex } : undefined}
    >
      <div className="status-modal-backdrop" onClick={onClose} />
      <div className="status-modal-content">
        <div className="status-modal-header">
          <h3 className="status-modal-title">게시글</h3>
          <div className="status-modal-header-actions">
            {isLoadingThread && (
              <div className="thread-loading-header">
                <div className="thread-loading-spinner" />
                <span className="thread-loading-text">스레드 불러오는 중</span>
              </div>
            )}
            <button
              type="button"
              className="icon-button"
              onClick={onClose}
              aria-label="닫기"
            >
              <svg viewBox="0 0 24 24">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="status-modal-body">
          {/* 스레드 컨텍스트 렌더링 */}
          {threadContext && threadContext.ancestors.length > 0 && (
            <div className="thread-context thread-ancestors">
              {threadContext.ancestors.map((ancestorStatus) => (
                <div key={ancestorStatus.id} className="thread-item thread-ancestor">
                   <TimelineItem
                     status={ancestorStatus}
                     onReply={onReply}
                     onToggleFavourite={onToggleFavourite}
                     onToggleReblog={onToggleReblog}
                     onToggleBookmark={onToggleBookmark}
                     onDelete={onDelete || (() => {})}
                    onProfileClick={handleProfileClick}
                    activeHandle={activeHandle}
                    activeAccountHandle={activeAccountHandle}
                    activeAccountUrl={activeAccountUrl}
                    account={account}
                    api={api}
                    showProfileImage={showProfileImage}
                    showCustomEmojis={showCustomEmojis}
                    showReactions={showReactions}
                    disableActions={!account}
                    enableReactionActions={false}
                  />
                </div>
              ))}
            </div>
          )}

          {boostedLabel ? (
            <div className="boosted-by">
              <BoostIcon aria-hidden="true" focusable="false" />
              <span>{boostedLabel}</span>
            </div>
          ) : null}
          
          <TimelineItem
            status={status}
            onReply={onReply}
            onToggleFavourite={onToggleFavourite}
            onToggleReblog={onToggleReblog}
            onToggleBookmark={onToggleBookmark}
            onDelete={onDelete || (() => {})}
            onProfileClick={handleProfileClick}
            activeHandle={activeHandle}
            activeAccountHandle={activeAccountHandle}
            activeAccountUrl={activeAccountUrl}
            account={account}
            api={api}
            showProfileImage={showProfileImage}
            showCustomEmojis={showCustomEmojis}
            showReactions={showReactions}
            disableActions={!account}
            enableReactionActions={false}
          />
          
          {/* 스레드 컨텍스트 - 후손 게시물들 */}
          {threadContext && threadContext.descendants.length > 0 && (
            <div className="thread-context thread-descendants">
              {/* 현재 게시물 이후에 연결선 */}
              <div className="thread-connector-to-descendants" />
              
              {/* 후손 게시물들 */}
              {threadContext.descendants.map((descendantStatus) => (
                <div key={descendantStatus.id} className="thread-item thread-descendant">
                  <div className="thread-line" />
                  <TimelineItem
                    status={descendantStatus}
                    onReply={onReply}
                    onToggleFavourite={onToggleFavourite}
                    onToggleReblog={onToggleReblog}
                    onToggleBookmark={onToggleBookmark}
                    onDelete={onDelete || (() => {})}
                    onProfileClick={handleProfileClick}
                    activeHandle={activeHandle}
                    activeAccountHandle={activeAccountHandle}
                    activeAccountUrl={activeAccountUrl}
                    account={account}
                    api={api}
                    showProfileImage={showProfileImage}
                    showCustomEmojis={showCustomEmojis}
                    showReactions={showReactions}
                    disableActions={!account}
                    enableReactionActions={false}
                  />
                </div>
              ))}
            </div>
          )}
          
          {/* 로딩 상태는 헤더에서 처리 */}
          
        </div>
      </div>
    </div>
  );
};
