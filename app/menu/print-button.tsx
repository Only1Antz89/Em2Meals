"use client";
import { Download } from "lucide-react";

export function PrintMenuButton() {
  return (
    <button type="button" className="menu-print-button" onClick={() => window.print()}>
      <Download size={16} aria-hidden="true" /> Download PDF
    </button>
  );
}
