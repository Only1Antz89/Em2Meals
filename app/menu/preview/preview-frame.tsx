"use client";
import { useEffect, useState } from "react";
import { Footer, Header } from "../../public-shell";
import { MenuDocument } from "@/components/menu/menu-document";
import type { PublicMenu } from "@/lib/menu-theme";

export type PreviewMessage =
  | { type: "em2-menu-preview"; menu: PublicMenu; view: "desktop" | "mobile" | "a4" }
  | { type: "em2-menu-print" };

export function MenuPreviewFrame() {
  const [message, setMessage] = useState<Extract<
    PreviewMessage,
    { type: "em2-menu-preview" }
  > | null>(null);
  useEffect(() => {
    const receive = (event: MessageEvent<PreviewMessage>) => {
      if (event.origin !== window.location.origin || event.source !== window.parent)
        return;
      if (event.data?.type === "em2-menu-preview") setMessage(event.data);
      if (event.data?.type === "em2-menu-print") window.print();
    };
    window.addEventListener("message", receive);
    window.parent.postMessage({ type: "em2-menu-preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", receive);
  }, []);
  if (!message)
    return <p className="menu-preview-waiting">Loading preview…</p>;
  if (message.view === "a4")
    return (
      <main className="menu-a4-sheet">
        <MenuDocument menu={message.menu} />
      </main>
    );
  return (
    <>
      <Header active="menu" />
      <main className="menu-page">
        <MenuDocument menu={message.menu} />
      </main>
      <Footer />
    </>
  );
}
