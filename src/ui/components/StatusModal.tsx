import React from "react";
import type { Account, Status } from "../../domain/types";
import { TimelineItem } from "./TimelineItem";
import boostIconUrl from "../assets/boost-icon.svg";

export const StatusModal = ({
  status,
  account,
  onClose,
  onReply,
  onToggleFavourite,
  onToggleReblog,
  onDelete,
  activeHandle,
  activeAccountHandle,
  activeAccountUrl,
  showProfileImage,
  showCustomEmojis,
  showReactions
}: {
  status: Status;
  account: Account | null;
  onClose: () => void;
  onReply: (status: Status) => void;
  onToggleFavourite: (status: Status) => void;
  onToggleReblog: (status: Status) => void;
  onDelete?: (status: Status) => void;
  activeHandle: string;
  activeAccountHandle: string;
  activeAccountUrl: string | null;
  showProfileImage: boolean;
  showCustomEmojis: boolean;
  showReactions: boolean;
}) => {
  const displayStatus = status.reblog ?? status;
  const boostedBy = status.reblog ? status.boostedBy : null;

  return (
    <div
      className="status-modal"
      role="dialog"
      aria-modal="true"
      aria-label="글 보기"
    >
      <div className="status-modal-backdrop" onClick={onClose} />
      <div className="status-modal-content">
        <div className="status-modal-header">
          <h3 className="status-modal-title">게시글</h3>
          <button
            type="button"
            className="status-modal-close"
            onClick={onClose}
            aria-label="닫기"
          >
            닫기
          </button>
        </div>
        
        <div className="status-modal-body">
          {boostedBy ? (
            <div className="boosted-by">
              <img src={boostIconUrl} alt="" aria-hidden="true" />
              <span>{boostedBy.name || boostedBy.handle} 님이 부스트함</span>
            </div>
          ) : null}
          
          <TimelineItem
            status={status}
            onReply={onReply}
            onToggleFavourite={onToggleFavourite}
            onToggleReblog={onToggleReblog}
            onDelete={onDelete || (() => {})}
            activeHandle={activeHandle}
            activeAccountHandle={activeAccountHandle}
            activeAccountUrl={activeAccountUrl}
            showProfileImage={showProfileImage}
            showCustomEmojis={showCustomEmojis}
            showReactions={showReactions}
            disableActions={!account}
          />
        </div>
      </div>
    </div>
  );
};