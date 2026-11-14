// Verifies the theme's colour pairs against WCAG contrast minimums.
// Run: npx tsx scripts/check-contrast.ts   (values mirror app/globals.css)

const shared = { bg: "#1c4531", nav: "#12301f", surface: "#f1e7d3", surfaceAlt: "#e6dabf", accent: "#7a22ff", onAccent: "#ffffff" };
const ground = { ink: "#f4ecdb", inkMuted: "#b7c8b4", trust: "#d6e4c6", danger: "#ffa69b", cell0: "#2a5a42", cell4: "#f1e7d3" };
const surface = { ink: "#173224", inkMuted: "#536458", trust: "#1f4d36", danger: "#b3261e", cell0: "#ddd0b2", cell4: "#1f4d36" };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const pairs: [string, string, string, number][] = [
  ["ground ink / bg", ground.ink, shared.bg, 4.5],
  ["ground ink-muted / bg", ground.inkMuted, shared.bg, 4.5],
  ["ground ink / nav", ground.ink, shared.nav, 4.5],
  ["ground trust / bg", ground.trust, shared.bg, 4.5],
  ["ground danger / bg", ground.danger, shared.bg, 4.5],
  ["ground cell-4 / cell-0", ground.cell4, ground.cell0, 3],
  ["surface ink / surface", surface.ink, shared.surface, 4.5],
  ["surface ink-muted / surface", surface.inkMuted, shared.surface, 4.5],
  ["surface ink-muted / surface-alt", surface.inkMuted, shared.surfaceAlt, 4.5],
  ["surface trust / surface", surface.trust, shared.surface, 4.5],
  ["surface danger / surface", surface.danger, shared.surface, 4.5],
  ["surface cell-4 / cell-0", surface.cell4, surface.cell0, 3],
  ["on-accent / accent", shared.onAccent, shared.accent, 4.5],
  ["accent / surface", shared.accent, shared.surface, 4.5],
];

let failed = false;
for (const [name, a, b, min] of pairs) {
  const ratio = contrast(a, b);
  const ok = ratio >= min;
  if (!ok) failed = true;
  console.log(`${ok ? "ok  " : "FAIL"} ${ratio.toFixed(2).padStart(5)} (min ${min})  ${name}`);
}
process.exit(failed ? 1 : 0);
