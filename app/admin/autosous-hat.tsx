"use client";

import { useEffect, useRef, useState } from "react";
import { AutoSousIcon } from "./autosous-icon";
import type { Mascot, MascotMood } from "./autosous-mascot";

// The animated AutoSous hat for use inside a page. It follows the pointer,
// waves when tapped, and works faster while AutoSous is answering. Without
// WebGL it shows the flat AutoSous mark instead.
export function AutoSousHat({
  size = 96,
  busy = false,
  mood = "calm",
  className = "",
}: {
  size?: number;
  busy?: boolean;
  mood?: MascotMood;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const mascot = useRef<Mascot | null>(null);
  const [webgl, setWebgl] = useState(() => {
    try {
      const probe = document.createElement("canvas");
      return !!(probe.getContext("webgl2") || probe.getContext("webgl"));
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const el = canvas.current;
    if (!el || !webgl) return;
    let cancelled = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    void Promise.all([import("three"), import("./autosous-mascot")])
      .then(([THREE, { createMascot }]) => {
        if (cancelled) return;
        mascot.current = createMascot(el, THREE, { reducedMotion });
        mascot.current.wave();
      })
      .catch(() => setWebgl(false));
    const move = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      mascot.current?.pointer(
        (e.clientX - (rect.left + rect.width / 2)) / (window.innerWidth / 2),
        (e.clientY - (rect.top + rect.height / 2)) / (window.innerHeight / 2),
      );
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      cancelled = true;
      window.removeEventListener("pointermove", move);
      mascot.current?.destroy();
      mascot.current = null;
    };
  }, [webgl]);
  useEffect(() => mascot.current?.setBusy(busy), [busy]);
  useEffect(() => mascot.current?.setMood(mood), [mood]);
  return (
    <span
      className={`autosous-hat ${busy ? "is-busy" : ""} ${className}`}
      style={{ width: size, height: size }}
      onClick={() => mascot.current?.wave()}
      aria-hidden="true"
    >
      {webgl ? <canvas ref={canvas} style={{ width: size, height: size }} /> : <AutoSousIcon size={size * 0.5} />}
    </span>
  );
}
