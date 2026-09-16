import { ImageResponse } from "next/og";

export const alt = "Fork Goodness Baked — private chef, corporate lunches and event catering";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function Mark() {
  return (
    <svg width="220" height="220" viewBox="0 0 64 64">
      <path d="M25 12C13 15 7 24 7 34s6 19 18 22M40 12c11 4 17 12 17 22s-6 18-17 22" fill="none" stroke="#344b57" strokeWidth="3" strokeLinecap="round" />
      <path d="M22 19c-7 4-11 9-11 15s4 11 11 15M43 19c7 4 10 9 10 15s-4 11-11 15" fill="none" stroke="#8096a2" strokeWidth="2" strokeLinecap="round" />
      <path d="M27 8v17c0 5 3 8 6 9v19c0 2 1 4 2 4s2-2 2-4V34c3-1 6-4 6-9V8M32 8v17m6-17v17" fill="none" stroke="#344b57" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Image() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", padding: "76px 84px", background: "#fbfaf7", color: "#1f3039", position: "relative" }}>
      <Mark />
      <div style={{ display: "flex", flexDirection: "column", marginLeft: "70px" }}>
        <div style={{ fontSize: 66, fontFamily: "serif", fontWeight: 400, letterSpacing: "3px", lineHeight: 1.02, maxWidth: "740px", textTransform: "uppercase" }}>Fork Goodness</div>
        <div style={{ width: "100%", height: "2px", background: "#8096a2", margin: "28px 0 20px" }} />
        <div style={{ fontSize: 28, letterSpacing: "18px", textTransform: "uppercase", color: "#8096a2" }}>Baked</div>
        <div style={{ fontSize: 19, marginTop: "30px", color: "#71848d" }}>Private dining · Celebrations · Corporate catering</div>
      </div>
    </div>,
    size,
  );
}
