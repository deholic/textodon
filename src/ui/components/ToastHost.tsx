import React from "react";
import type { ToastTone } from "../state/ToastContext";

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
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
          <button
            type="button"
            className="toast-close"
            onClick={() => onDismiss(toast.id)}
            aria-label="알림 닫기"
          >
            닫기
          </button>
        </div>
      ))}
    </div>
  );
};
