import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EM² Meals | Private chefs & corporate catering in London",
  description:
    "Emma’s square meals. Bespoke private dining and thoughtful corporate catering across London and the M25.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB">
      <body className="antialiased">{children}</body>
    </html>
  );
}
