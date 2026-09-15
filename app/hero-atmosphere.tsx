"use client";

import { useEffect, useRef } from "react";

type VantaEffect = { destroy: () => void; resize: () => void };

export function HeroAtmosphere() {
  const target = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!target.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(max-width: 760px)").matches) return;

    const probe = document.createElement("canvas");
    try {
      if (!probe.getContext("webgl2") && !probe.getContext("webgl")) return;
    } catch {
      return;
    }

    let effect: VantaEffect | undefined;
    let cancelled = false;

    async function mount() {
      try {
        const [{ default: FOG }, THREE] = await Promise.all([
          import("vanta/dist/vanta.fog.min"),
          import("three"),
        ]);
        if (cancelled || !target.current) return;
        effect = FOG({
          el: target.current,
          THREE,
          mouseControls: true,
          touchControls: false,
          gyroControls: false,
          minHeight: 300,
          minWidth: 300,
          highlightColor: 0x6f8792,
          midtoneColor: 0x304853,
          lowlightColor: 0x111b20,
          baseColor: 0x0c1215,
          blurFactor: 0.42,
          speed: 0.55,
          zoom: 1.15,
        }) as VantaEffect;
      } catch {
        // The hero photograph is the deliberate no-WebGL fallback.
      }
    }

    void mount();
    return () => {
      cancelled = true;
      effect?.destroy();
    };
  }, []);

  return <div ref={target} className="hero-atmosphere" aria-hidden="true" />;
}
