import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Account, TimelineType } from "../../domain/types";
import { formatHandle } from "../utils/account";
import { getTimelineOptions } from "../utils/timeline";

export const AccountSelector = ({
  accounts,
  activeAccountId,
  setActiveAccount,
  activeTimeline,
  setActiveTimeline,
  removeAccount,
  variant = "panel"
}: {
  accounts: Account[];
  activeAccountId: string | null;
  setActiveAccount: (id: string) => void;
  activeTimeline?: TimelineType;
  setActiveTimeline?: (timeline: TimelineType) => void;
  removeAccount: (id: string) => void;
  variant?: "panel" | "inline";
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    if (!dropdownOpen) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      if (!dropdownRef.current || !(event.target instanceof Node)) {
        return;
      }
      if (!dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [dropdownOpen]);

  const activeAccount = useMemo(
    () => accounts.find((account) => account.id === activeAccountId) ?? null,
    [accounts, activeAccountId]
  );
  const showTimelineSelector = Boolean(setActiveTimeline);

  const wrapperClassName =
    variant === "panel" ? "panel account-selector-panel" : "account-selector-inline";
  const Wrapper = variant === "panel" ? "section" : "div";

  return (
    <Wrapper className={wrapperClassName}>
      <div className="account-selector-header">
        <details
          ref={dropdownRef}
          className="account-selector"
          open={dropdownOpen}
          onToggle={(event) => setDropdownOpen(event.currentTarget.open)}
        >
          <summary className="account-selector-summary">
            {activeAccount ? (
              <span className="account-label">
                <span className="account-avatar" aria-hidden="true">
                  {activeAccount.avatarUrl ? (
                    <img src={activeAccount.avatarUrl} alt="" loading="lazy" />
                  ) : (
                    <span className="account-avatar-fallback" />
                  )}
                </span>
                <span className="account-text">
                  <span>{activeAccount.displayName || activeAccount.name || activeAccount.instanceUrl}</span>
                  {activeAccount.handle ? (
                    <span className="account-handle">
                      @{formatHandle(activeAccount.handle, activeAccount.instanceUrl)}
                    </span>
                  ) : null}
                </span>
              </span>
            ) : (
              <span className="account-selector-placeholder">계정을 선택하세요.</span>
            )}
            <span className="account-selector-caret" aria-hidden="true">
              ▾
            </span>
          </summary>
          {dropdownOpen ? (
            <div
              className="overlay-backdrop"
              onClick={() => setDropdownOpen(false)}
              aria-hidden="true"
            />
          ) : null}
          <div className="account-selector-dropdown">
            <ul className="account-list">
              {accounts.map((account) => {
                const isActiveAccount = account.id === activeAccountId;
                const timelineOptions = getTimelineOptions(account.platform, false);
                return (
                  <li key={account.id} className={isActiveAccount ? "active" : ""}>
                    <div className="account-row">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveAccount(account.id);
                          setDropdownOpen(false);
                        }}
                      >
                        <span className="account-label">
                          <span className="account-avatar" aria-hidden="true">
                            {account.avatarUrl ? (
                              <img src={account.avatarUrl} alt="" loading="lazy" />
                            ) : (
                              <span className="account-avatar-fallback" />
                            )}
                          </span>
                          <span className="account-text">
                            <span>{account.displayName || account.name || account.instanceUrl}</span>
                            {account.handle ? (
                              <span className="account-handle">
                                @{formatHandle(account.handle, account.instanceUrl)}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                      <button type="button" onClick={() => removeAccount(account.id)} className="ghost">
                        삭제
                      </button>
                    </div>
                    {showTimelineSelector ? (
                      <div className="account-timeline-options" role="group" aria-label="타임라인 선택">
                        {timelineOptions.map((option) => {
                          const isSelected = isActiveAccount && activeTimeline === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              className={`account-timeline-option${isSelected ? " is-active" : ""}`}
                              aria-pressed={isSelected}
                              onClick={() => {
                                setActiveAccount(account.id);
                                setActiveTimeline?.(option.id);
                                setDropdownOpen(false);
                              }}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </li>
                );
              })}
              {accounts.length === 0 ? <li className="empty">등록된 계정이 없습니다.</li> : null}
            </ul>
          </div>
        </details>
      </div>
    </Wrapper>
  );
};
