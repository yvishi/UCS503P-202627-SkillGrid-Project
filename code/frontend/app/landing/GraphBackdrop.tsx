"use client";

// Cursor-reactive graph paper, after React Bits' "Squares" background:
// the 24px square under the pointer tints faintly ultramarine and fades
// out as the pointer moves on. Sits on top of a `.bg-graph` parent, whose
// ruling starts at the same origin, so the tinted squares line up with
// the printed grid. Decorative only: aria-hidden, pointer-events-none,
// and not rendered at all under reduced motion or on touch-only devices.

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useReducedMotion } from "motion/react";

const CELL = 24;
const FADE_MS = 700;
const PEAK_ALPHA = 0.14;

const FINE_POINTER = "(pointer: fine)";

function subscribeFinePointer(onChange: () => void) {
  const mq = window.matchMedia(FINE_POINTER);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getFinePointer() {
  return window.matchMedia(FINE_POINTER).matches;
}

export function GraphBackdrop() {
  const reduce = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const finePointer = useSyncExternalStore(subscribeFinePointer, getFinePointer, () => false);

  const active = finePointer && !reduce;

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // key "col,row" -> timestamp the pointer last touched that square
    const touched = new Map<string, number>();
    let frame = 0;
    let color = "";

    function resize() {
      if (!canvas || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(now: number) {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = color;
      for (const [key, t] of touched) {
        const age = now - t;
        if (age >= FADE_MS) {
          touched.delete(key);
          continue;
        }
        const [c, r] = key.split(",").map(Number);
        ctx.globalAlpha = PEAK_ALPHA * (1 - age / FADE_MS);
        ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 1, CELL - 1);
      }
      ctx.globalAlpha = 1;
      frame = touched.size > 0 ? requestAnimationFrame(draw) : 0;
    }

    function onMove(e: PointerEvent) {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
      if (!frame) {
        // Re-read the token each time the loop wakes so theme switches apply.
        color = getComputedStyle(canvas).getPropertyValue("--trust").trim() || "currentColor";
      }
      touched.set(`${Math.floor(x / CELL)},${Math.floor(y / CELL)}`, performance.now());
      if (!frame) frame = requestAnimationFrame(draw);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [active]);

  if (!active) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
