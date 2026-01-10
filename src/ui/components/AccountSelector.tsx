import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Account } from "../../domain/types";
import { formatHandle } from "../utils/account";
import { useClickOutside } from "../hooks/useClickOutside";
import { AccountLabel } from "./AccountLabel";

export const AccountSelector = ({
  accounts,
  activeAccountId,
  setActiveAccount,
  removeAccount,
  variant = "panel"
}: {
  accounts: Account[];
  activeAccountId: string | null;
  setActiveAccount: (id: string) => void;
  removeAccount: (id: string) => void;
  variant?: "panel" | "inline";
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDetailsElement | null>(null);

  useClickOutside(dropdownRef, dropdownOpen, () => setDropdownOpen(false));

  const activeAccount = useMemo(
    () => accounts.find((account) => account.id === activeAccountId) ?? null,
    [accounts, activeAccountId]
  );

  const wrapperClassName =
    variant === "panel" ? "panel account-selector-panel" : "account-selector-inline";
  const Wrapper = variant === "panel" ? "section" : "div";

  return (
    <Wrapper className={wrapperClassName}>
      <div className="account-selector-header">
        <details
          className="account-selector"
          open={dropdownOpen}
          onToggle={(event) => setDropdownOpen(event.currentTarget.open)}
        >
          <summary className="account-selector-summary">
            {activeAccount ? (
              <AccountLabel
                avatarUrl={activeAccount.avatarUrl}
                displayName={activeAccount.displayName}
                name={activeAccount.name}
                handle={activeAccount.handle ? formatHandle(activeAccount.handle, activeAccount.instanceUrl) : undefined}
                instanceUrl={activeAccount.instanceUrl}
              />
            ) : (
              <span className="account-selector-placeholder">계정을 선택하세요.</span>
            )}
            <span className="account-selector-caret" aria-hidden="true">
              ▾
            </span>
          </summary>
          {dropdownOpen ? <div className="overlay-backdrop" aria-hidden="true" /> : null}
          <div ref={dropdownRef} className="account-selector-dropdown">
            <ul className="account-list">
              {accounts.map((account) => {
                const isActiveAccount = account.id === activeAccountId;
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
                        <AccountLabel
                          avatarUrl={account.avatarUrl}
                          displayName={account.displayName}
                          name={account.name}
                          handle={account.handle ? formatHandle(account.handle, account.instanceUrl) : undefined}
                          instanceUrl={account.instanceUrl}
                        />
                      </button>
                      <button type="button" onClick={() => removeAccount(account.id)} className="ghost">
                        삭제
                      </button>
                    </div>
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
