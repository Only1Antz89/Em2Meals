import type { Metadata } from "next";
import { MenuPreviewFrame } from "./preview-frame";

// Renders a draft menu posted by the owner's Menu studio (same origin only).
// It holds no data of its own, so it is safe to serve without authentication.
export const metadata: Metadata = {
  title: "Menu preview",
  robots: { index: false, follow: false },
};

export default function MenuPreviewPage() {
  return <MenuPreviewFrame />;
}
