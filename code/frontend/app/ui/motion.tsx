"use client";

// Small motion kit adapted from React Bits patterns (BlurText, CountUp,
// SpotlightCard, AnimatedContent), rebuilt on `motion` so the app carries
// one animation dependency. Every piece honours prefers-reduced-motion by
// rendering its final state immediately.

import { useEffect, useRef } from "react";
import { animate, motion, useInView, useReducedMotion } from "motion/react";

export function Reveal({
  children,
  delay = 0,
  y = 14,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// Word-by-word blur-in for headlines. Pass plain text; use `\n` for a
// forced line break.
export function BlurText({
  text,
  className = "",
  delay = 0,
  stagger = 0.07,
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const reduce = useReducedMotion();
  const lines = text.split("\n");
  let wordIndex = 0;

  return (
    <span className={className}>
      {lines.map((line, li) => (
        <span key={li} className="block">
          {line.split(" ").map((word, wi) => {
            const i = wordIndex++;
            return (
              <motion.span
                key={wi}
                className="inline-block whitespace-pre"
                initial={reduce ? false : { opacity: 0, filter: "blur(10px)", y: 10 }}
                animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                transition={{ duration: 0.6, delay: delay + i * stagger, ease: [0.22, 1, 0.36, 1] }}
              >
                {word + (wi < line.split(" ").length - 1 ? " " : "")}
              </motion.span>
            );
          })}
        </span>
      ))}
    </span>
  );
}

export function CountUp({
  to,
  duration = 1.1,
  suffix = "",
  className = "",
}: {
  to: number;
  duration?: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node || !inView) return;
    if (reduce) {
      node.textContent = `${to}${suffix}`;
      return;
    }
    const controls = animate(0, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        node.textContent = `${Math.round(v)}${suffix}`;
      },
    });
    return () => controls.stop();
  }, [inView, to, duration, suffix, reduce]);

  return (
    <span ref={ref} className={className}>
      {`${to}${suffix}`}
    </span>
  );
}

// Cursor-following radial highlight. Purely decorative: the glow layer is
// aria-hidden and pointer-events-none, so it never changes semantics of
// whatever is passed in as children.
export function SpotlightCard({
  children,
  className = "",
  color = "color-mix(in srgb, var(--trust) 14%, transparent)",
}: {
  children: React.ReactNode;
  className?: string;
  color?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
  }

  return (
    <div ref={ref} onMouseMove={onMove} className={`group/spot relative overflow-hidden ${className}`}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{
          background: `radial-gradient(320px circle at var(--spot-x, 50%) var(--spot-y, 50%), ${color}, transparent 70%)`,
        }}
      />
      <div className="relative h-full">{children}</div>
    </div>
  );
}
