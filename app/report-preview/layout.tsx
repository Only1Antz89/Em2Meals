import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sample catering report | Fork Goodness Baked",
  robots: { index: false, follow: false },
};

export default function ReportPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
