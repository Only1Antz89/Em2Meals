import { ImageResponse } from "next/og";

export const alt = "Fork Goodness Baked — Artisanal Goodness";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function Mark() {
  return (
    <svg width="220" height="220" viewBox="0 0 64 64">
      <rect x="3" y="3" width="58" height="58" rx="3" fill="none" stroke="#1f3039" strokeWidth="3" />
      <path d="M19 13v14m6-14v14m-12-12v10c0 5 4 9 9 9s9-4 9-9V15M22 34l22 21" fill="none" stroke="#1f3039" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M43 12c-7 0-13 7-13 15 0 5 3 9 7 11m6-26c7 0 13 7 13 15 0 5-3 9-7 11M43 12v25m0-25c-4 4-7 9-7 15 0 4 3 8 7 10m0-25c4 4 7 9 7 15 0 4-3 8-7 10M43 37 19 55" fill="none" stroke="#1f3039" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="44" r="3.6" fill="#d4b36e" />
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
