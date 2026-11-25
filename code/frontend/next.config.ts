import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  // pdf-parse (pdfjs-dist) resolves its worker script relative to its own
  // file location at runtime; bundling it into a Turbopack/webpack chunk
  // breaks that resolution ("Cannot find ... pdf.worker.mjs"). Keeping it
  // external lets Node's normal require() resolution find it.
  // @napi-rs/canvas is a native addon pdf-parse/worker uses to polyfill
  // DOMMatrix/Path2D/ImageData; it can't be bundled either.
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
};

export default nextConfig;
