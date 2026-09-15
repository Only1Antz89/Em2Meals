import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { authMode } from "@/lib/auth-mode";
import "./globals.css";

export const metadata: Metadata = {
  title: "EM² Meals | Private dining & corporate catering in London",
  description:
    "Private dining for meaningful occasions and thoughtful corporate catering for productive days in London.",
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
  const content =
    authMode() === "clerk" ? (
      <ClerkProvider>{children}</ClerkProvider>
    ) : (
      children
    );
  return (
    <html lang="en-GB">
      <body className="antialiased">{content}</body>
    </html>
  );
}
