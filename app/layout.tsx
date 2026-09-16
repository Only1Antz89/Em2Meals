import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { authMode } from "@/lib/auth-mode";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://em2-meals.vercel.app",
  ),
  title: "Fork Goodness Baked | Private dining & corporate catering",
  description:
    "Artisanal goodness for meaningful occasions and productive days, through private dining and thoughtful corporate catering.",
  applicationName: "Fork Goodness Baked",
  openGraph: {
    title: "Fork Goodness Baked",
    description:
      "Artisanal goodness for private dining, celebrations and corporate catering.",
    siteName: "Fork Goodness Baked",
    type: "website",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fork Goodness Baked",
    description:
      "Artisanal goodness for private dining, celebrations and corporate catering.",
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/apple-icon.png",
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
