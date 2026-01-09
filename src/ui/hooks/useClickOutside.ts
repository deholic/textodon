import { useEffect, type RefObject } from "react";

/**
 * 외부 클릭 및 ESC 키 입력 시 콜백을 실행하는 커스텀 훅
 *
 * @param ref - 대상 요소의 ref (이 요소 외부 클릭 시 콜백 실행)
 * @param isOpen - 활성화 여부 (true일 때만 이벤트 리스너 등록)
 * @param onClose - 외부 클릭 또는 ESC 키 입력 시 실행할 콜백
 * @param ignoreRefs - 클릭을 무시할 추가 요소들의 ref 배열 (예: 버튼)
 */
export const useClickOutside = (
  ref: RefObject<HTMLElement>,
  isOpen: boolean,
  onClose: () => void,
  ignoreRefs?: RefObject<HTMLElement>[]
) => {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      if (!ref.current || !(event.target instanceof Node)) {
        return;
      }

      // 대상 요소 내부 클릭인지 확인
      if (ref.current.contains(event.target)) {
        return;
      }

      // 무시할 요소들 확인
      if (ignoreRefs) {
        for (const ignoreRef of ignoreRefs) {
          if (ignoreRef.current?.contains(event.target)) {
            return;
          }
        }
      }

      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    // mousedown은 클릭이 시작될 때 발생 (click보다 먼저)
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, ref, ignoreRefs]);
};
