import React from "react";
import type { ToastTone } from "../state/ToastContext";

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
  action?: {
    label: string;
    onClick: () => void;
    ariaLabel?: string;
  };
};

export const ToastHost = ({
  toasts,
  onDismiss
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) => {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.tone}`}
          role={toast.tone === "error" ? "alert" : "status"}
        >
          <span>{toast.message}</span>
          <div className="toast-actions">
            {toast.action ? (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  toast.action?.onClick();
                  onDismiss(toast.id);
                }}
                aria-label={toast.action.ariaLabel ?? toast.action.label}
              >
                {toast.action.label}
              </button>
            ) : null}
            <button
              type="button"
              className="toast-close"
              onClick={() => onDismiss(toast.id)}
              aria-label="토스트 닫기"
            >
              닫기
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
