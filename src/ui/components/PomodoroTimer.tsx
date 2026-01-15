import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SessionType = "focus" | "break" | "longBreak";

type PomodoroTimerProps = {
  focusMinutes?: number;
  breakMinutes?: number;
  longBreakMinutes?: number;
  onSessionTypeChange?: (type: SessionType) => void;
  onRunningChange?: (isRunning: boolean) => void;
};

const TOTAL_SESSIONS = 8;

const getSessionLabel = (type: SessionType): string => {
  switch (type) {
    case "focus":
      return "집중";
    case "break":
      return "휴식";
    case "longBreak":
      return "긴 휴식";
  }
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export const PomodoroTimer = ({
  focusMinutes = 25,
  breakMinutes = 5,
  longBreakMinutes = 30,
  onSessionTypeChange,
  onRunningChange,
}: PomodoroTimerProps) => {
  const focusDuration = focusMinutes * 60;
  const breakDuration = breakMinutes * 60;
  const longBreakDuration = longBreakMinutes * 60;

  const getSessionInfo = useCallback(
    (sess: number): { type: SessionType; duration: number } => {
      if (sess === 8) {
        return { type: "longBreak", duration: longBreakDuration };
      }
      if (sess % 2 === 0) {
        return { type: "break", duration: breakDuration };
      }
      return { type: "focus", duration: focusDuration };
    },
    [focusDuration, breakDuration, longBreakDuration]
  );

  const [session, setSession] = useState(1);
  const [timeLeft, setTimeLeft] = useState(focusDuration);
  const [isRunning, setIsRunning] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const sessionInfo = useMemo(() => getSessionInfo(session), [session, getSessionInfo]);

  // 세션 타입 변경 시 부모 컴포넌트에 알림
  useEffect(() => {
    onSessionTypeChange?.(sessionInfo.type);
  }, [sessionInfo.type, onSessionTypeChange]);

  // 실행 상태 변경 시 부모 컴포넌트에 알림
  useEffect(() => {
    onRunningChange?.(isRunning);
  }, [isRunning, onRunningChange]);

  const playNotificationSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = 800;
      oscillator.type = "sine";
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
    } catch {
      // AudioContext가 지원되지 않는 환경에서는 무시
    }
  }, []);

  const handleSessionToggle = useCallback(() => {
    const nextSession = session >= TOTAL_SESSIONS ? 1 : session + 1;
    const nextInfo = getSessionInfo(nextSession);
    setSession(nextSession);
    setTimeLeft(nextInfo.duration);
    setIsRunning(false);
    setIsBlinking(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [session, getSessionInfo]);

  const handleStart = useCallback(() => {
    setIsBlinking(false);
    setIsRunning((prev) => !prev);
  }, []);

  const handleReset = useCallback(() => {
    setIsBlinking(false);
    setSession(1);
    setTimeLeft(focusDuration);
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [focusDuration]);

  // 설정이 변경되면 현재 세션 시간 업데이트
  useEffect(() => {
    const info = getSessionInfo(session);
    setTimeLeft(info.duration);
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [focusDuration, breakDuration, longBreakDuration]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            playNotificationSound();
            setIsBlinking(true);
            const nextSession = session >= TOTAL_SESSIONS ? 1 : session + 1;
            const nextInfo = getSessionInfo(nextSession);
            setSession(nextSession);
            setIsRunning(false);
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            return nextInfo.duration;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, session, playNotificationSound]);

  const focusCount = Math.ceil(session / 2);

  const handlePanelClick = useCallback(() => {
    if (isBlinking) {
      setIsBlinking(false);
    }
  }, [isBlinking]);

  return (
    <section
      className={`panel pomodoro-panel${isBlinking ? " blinking" : ""}`}
      onClick={handlePanelClick}
    >
      <div className="pomodoro-row">
        <button
          type="button"
          className={`pomodoro-mode-toggle${sessionInfo.type === "break" ? " break" : ""}${sessionInfo.type === "longBreak" ? " long-break" : ""}`}
          onClick={handleSessionToggle}
          aria-label="다음 세션으로 전환"
        >
          {getSessionLabel(sessionInfo.type)} {sessionInfo.type === "focus" ? focusCount : ""}
        </button>
        <span className="pomodoro-time" aria-live="polite" aria-atomic="true">
          {formatTime(timeLeft)}
        </span>
        <div className="pomodoro-controls">
          <button
            type="button"
            className="pomodoro-button pomodoro-start"
            onClick={handleStart}
          >
            {isRunning ? "정지" : "시작"}
          </button>
          <button
            type="button"
            className="pomodoro-button pomodoro-reset"
            onClick={handleReset}
          >
            리셋
          </button>
        </div>
      </div>
    </section>
  );
};
