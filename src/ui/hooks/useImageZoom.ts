import { useCallback, useEffect, useRef, useState } from "react";

export type ImageZoomState = {
  zoom: number;
  offset: { x: number; y: number };
  baseSize: { width: number; height: number } | null;
  isDragging: boolean;
};

/**
 * 이미지 확대/축소 및 드래그 이동을 관리하는 커스텀 훅
 *
 * @param imageContainerRef - 이미지 컨테이너 요소의 ref
 * @param imageRef - 이미지 요소의 ref
 * @returns 이미지 줌 상태 및 이벤트 핸들러들
 */
export const useImageZoom = (
  imageContainerRef: React.RefObject<HTMLDivElement>,
  imageRef: React.RefObject<HTMLImageElement>
) => {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [baseSize, setBaseSize] = useState<{ width: number; height: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  // offset을 이미지 경계 내로 제한
  const clampOffset = useCallback(
    (next: { x: number; y: number }, currentZoom: number) => {
      if (!baseSize || !imageContainerRef.current) {
        return next;
      }
      const container = imageContainerRef.current.getBoundingClientRect();
      const maxX = Math.max(0, (baseSize.width * currentZoom - container.width) / 2);
      const maxY = Math.max(0, (baseSize.height * currentZoom - container.height) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, next.x)),
        y: Math.min(maxY, Math.max(-maxY, next.y))
      };
    },
    [baseSize, imageContainerRef]
  );

  // zoom 변경 시 offset 조정
  useEffect(() => {
    setOffset((current) => clampOffset(current, zoom));
  }, [zoom, clampOffset]);

  // 드래그 중 포인터 이동 처리
  useEffect(() => {
    if (!isDragging) {
      return;
    }
    const handleMove = (event: PointerEvent) => {
      if (!dragStateRef.current) {
        return;
      }
      const dx = event.clientX - dragStateRef.current.startX;
      const dy = event.clientY - dragStateRef.current.startY;
      const next = {
        x: dragStateRef.current.originX + dx,
        y: dragStateRef.current.originY + dy
      };
      setOffset(clampOffset(next, zoom));
    };
    const handleUp = () => {
      setIsDragging(false);
      dragStateRef.current = null;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [clampOffset, zoom, isDragging]);

  // 휠 이벤트 핸들러 (줌 조정)
  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    setZoom((current) => Math.min(3, Math.max(0.6, current + delta)));
  }, []);

  // 이미지 로드 완료 시 base 크기 설정
  const handleImageLoad = useCallback(() => {
    if (!imageRef.current) {
      return;
    }
    requestAnimationFrame(() => {
      if (!imageRef.current) {
        return;
      }
      const rect = imageRef.current.getBoundingClientRect();
      setBaseSize({ width: rect.width, height: rect.height });
    });
  }, [imageRef]);

  // 포인터 다운 시 드래그 시작
  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      dragStateRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: offset.x,
        originY: offset.y
      };
      setIsDragging(true);
    },
    [offset]
  );

  // 줌/오프셋 초기화
  const reset = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setBaseSize(null);
    setIsDragging(false);
    dragStateRef.current = null;
  }, []);

  return {
    // 상태
    zoom,
    offset,
    baseSize,
    isDragging,

    // 핸들러
    handleWheel,
    handleImageLoad,
    handlePointerDown,

    // 유틸리티
    reset,
    setZoom
  };
};
