"use client";

import { useRef, useState, type ReactNode } from "react";
import { ArrowRight, EyeOff } from "lucide-react";

// A card that can be swiped: right to open, left to dismiss. Vertical drags
// still scroll the list, and the buttons inside keep working for mouse and
// keyboard users.
const THRESHOLD = 84;

export function SwipeCard({
  onOpen,
  onDismiss,
  openLabel = "Open",
  dismissLabel = "Hide today",
  className = "",
  onSwiped,
  children,
}: {
  onOpen?: () => void;
  onDismiss?: () => void;
  openLabel?: string;
  dismissLabel?: string;
  className?: string;
  onSwiped?: () => void;
  children: ReactNode;
}) {
  const start = useRef<{ x: number; y: number; t: number; lock: "x" | "y" | null } | null>(null);
  const moved = useRef(false);
  const passed = useRef(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);

  const limit = (value: number) => {
    // Resist in a direction that does nothing.
    if (value > 0 && !onOpen) return value * 0.2;
    if (value < 0 && !onDismiss) return value * 0.2;
    return value;
  };
  const finish = (dir: 1 | -1, width: number) => {
    setDx(dir * width);
    onSwiped?.();
    window.setTimeout(() => {
      if (dir > 0) {
        onOpen?.();
        setDx(0);
      } else onDismiss?.();
    }, 170);
  };

  return (
    <li
      className={`autosous-swipe ${className} ${dx > 0 ? "dir-open" : dx < 0 ? "dir-dismiss" : ""}`}
    >
      <div className="autosous-swipe-under" aria-hidden="true">
        <span style={{ opacity: dx > 0 ? Math.min(1, dx / THRESHOLD) : 0 }}>
          <ArrowRight size={14} /> {openLabel}
        </span>
        <span style={{ opacity: dx < 0 ? Math.min(1, -dx / THRESHOLD) : 0 }}>
          {dismissLabel} <EyeOff size={14} />
        </span>
      </div>
      <div
        className="autosous-swipe-face"
        style={{
          transform: dx ? `translateX(${dx}px)` : undefined,
          transition: dragging ? "none" : undefined,
        }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          start.current = { x: e.clientX, y: e.clientY, t: performance.now(), lock: null };
          moved.current = false;
          passed.current = false;
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const x = e.clientX - s.x;
          const y = e.clientY - s.y;
          if (!s.lock && (Math.abs(x) > 8 || Math.abs(y) > 8)) {
            s.lock = Math.abs(x) > Math.abs(y) ? "x" : "y";
            if (s.lock === "x") {
              e.currentTarget.setPointerCapture(e.pointerId);
              setDragging(true);
            }
          }
          if (s.lock !== "x") return;
          moved.current = true;
          const next = limit(x);
          const over = Math.abs(next) >= THRESHOLD;
          if (over !== passed.current) {
            passed.current = over;
            if (over) navigator.vibrate?.(8);
          }
          setDx(next);
        }}
        onPointerUp={(e) => {
          const s = start.current;
          start.current = null;
          setDragging(false);
          if (!s || s.lock !== "x") return;
          const speed = dx / Math.max(1, performance.now() - s.t);
          const width = e.currentTarget.offsetWidth + 24;
          if (onOpen && (dx >= THRESHOLD || (dx > 36 && speed > 0.6))) finish(1, width);
          else if (onDismiss && (dx <= -THRESHOLD || (dx < -36 && speed < -0.6))) finish(-1, width);
          else setDx(0);
        }}
        onPointerCancel={() => {
          start.current = null;
          setDragging(false);
          setDx(0);
        }}
        // A drag is not a click on the links inside.
        onClickCapture={(e) => {
          if (moved.current) {
            e.preventDefault();
            e.stopPropagation();
            moved.current = false;
          }
        }}
      >
        {children}
      </div>
    </li>
  );
}
