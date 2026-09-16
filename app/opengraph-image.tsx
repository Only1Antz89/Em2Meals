import { ImageResponse } from "next/og";

export const alt = "Fork Goodness Baked — Artisanal Goodness";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function Mark() {
  return (
    <svg width="220" height="220" viewBox="0 0 64 64">
      <rect x="3" y="3" width="58" height="58" rx="3" fill="none" stroke="#1f3039" strokeWidth="3" />
      <path d="M15 14v13c0 6 4 10 9 10s9-4 9-10V14M21 14v13m6-13v13M24 37l22 18" fill="none" stroke="#1f3039" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M45 13c-6 0-10 6-10 14 0 7 4 12 10 12s10-5 10-12c0-8-4-14-10-14Zm0 0c-3 4-5 9-5 14s2 9 5 12m0-26c3 4 5 9 5 14s-2 9-5 12m0-26v26M45 39 18 55" fill="none" stroke="#1f3039" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="47" r="3.7" fill="#d4b36e" />
    </svg>
  );
}

export default function Image() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", padding: "76px 84px", background: "#fbfaf7", color: "#1f3039", position: "relative" }}>
      <Mark />
      <div style={{ display: "flex", flexDirection: "column", marginLeft: "70px" }}>
        <div style={{ fontSize: 61, fontWeight: 700, letterSpacing: "2px", lineHeight: 1.02, maxWidth: "740px", textTransform: "uppercase" }}>Fork Goodness Baked</div>
        <div style={{ width: "100%", height: "3px", background: "#d4b36e", margin: "30px 0 22px" }} />
        <div style={{ fontSize: 26, letterSpacing: "8px", textTransform: "uppercase", color: "#405763" }}>Artisanal Goodness</div>
        <div style={{ fontSize: 19, marginTop: "30px", color: "#71848d" }}>Private dining · Celebrations · Corporate catering</div>
      </div>
    </div>,
    size,
  );
}
