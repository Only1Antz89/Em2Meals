"use client";
import { useId, useRef, type RefObject } from "react";

type Props = {
  target: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  // Menu editing adds layout helpers the recipe method does not need.
  extended?: boolean;
};

export function MarkdownToolbar({
  target,
  value,
  onChange,
  label = "Text formatting",
  extended = false,
}: Props) {
  function restore(start: number, end: number) {
    requestAnimationFrame(() => {
      const field = target.current;
      if (!field) return;
      field.focus();
      field.setSelectionRange(start, end);
    });
  }
  function wrap(before: string, after = before) {
    const field = target.current;
    if (!field) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const selected = value.slice(start, end) || "text";
    onChange(
      `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`,
    );
    restore(start + before.length, start + before.length + selected.length);
  }
  // Toggle a prefix on every line touched by the selection.
  function prefixLines(prefix: string | ((index: number) => string)) {
    const field = target.current;
    if (!field) return;
    const start = value.lastIndexOf("\n", field.selectionStart - 1) + 1;
    const endBreak = value.indexOf("\n", field.selectionEnd);
    const end = endBreak === -1 ? value.length : endBreak;
    const lines = value.slice(start, end).split("\n");
    const pattern = /^(#{1,3} |\^ |[-*] |\d+\. )/;
    const next = lines
      .map((line, index) => {
        const text = line.replace(pattern, "");
        const wanted = typeof prefix === "string" ? prefix : prefix(index);
        return line.startsWith(wanted) ? text : wanted + text;
      })
      .join("\n");
    onChange(value.slice(0, start) + next + value.slice(end));
    restore(start, start + next.length);
  }
  function insertBlock(block: string) {
    const field = target.current;
    const at = field ? field.selectionEnd : value.length;
    const before = value.slice(0, at);
    const glue = before && !before.endsWith("\n") ? "\n" : "";
    onChange(`${before}${glue}${block}\n${value.slice(at)}`);
    restore(at + glue.length + block.length + 1, at + glue.length + block.length + 1);
  }
  const pick =
    (make: (v: string) => void) =>
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      if (event.target.value) make(event.target.value);
      event.target.value = "";
    };
  return (
    <div className="markdown-toolbar" role="toolbar" aria-label={label}>
      {extended ? (
        <select
          aria-label="Heading"
          defaultValue=""
          onChange={pick((v) => prefixLines(v === "p" ? "" : `${v} `))}
        >
          <option value="" disabled>
            Style
          </option>
          <option value="#">Heading</option>
          <option value="##">Subheading</option>
          <option value="###">Small heading</option>
        </select>
      ) : (
        <button type="button" onClick={() => prefixLines("## ")}>
          H2
        </button>
      )}
      <button type="button" title="Bold" onClick={() => wrap("**")}>
        B
      </button>
      <button type="button" title="Italic" onClick={() => wrap("*")}>
        <em>I</em>
      </button>
      <button type="button" title="Underline" onClick={() => wrap("__")}>
        <u>U</u>
      </button>
      <button type="button" onClick={() => wrap("==")}>
        Highlight
      </button>
      <select
        aria-label="Text size"
        defaultValue=""
        onChange={pick((v) => wrap(`{${v}}`, "{/}"))}
      >
        <option value="" disabled>
          Text size
        </option>
        <option value="small">Small</option>
        <option value="large">Large</option>
      </select>
      <select
        aria-label="Text colour"
        defaultValue=""
        onChange={pick((v) => wrap(`{${v}}`, "{/}"))}
      >
        <option value="" disabled>
          Colour
        </option>
        <option value="navy">Navy</option>
        <option value="gold">Gold</option>
        <option value="green">Green</option>
        <option value="red">Red</option>
      </select>
      {extended && (
        <>
          <button type="button" title="Centre line" onClick={() => prefixLines("^ ")}>
            Centre
          </button>
          <button type="button" title="Bulleted list" onClick={() => prefixLines("- ")}>
            • List
          </button>
          <button
            type="button"
            title="Numbered list"
            onClick={() => prefixLines((index) => `${index + 1}. `)}
          >
            1. List
          </button>
          <button type="button" title="Divider" onClick={() => insertBlock("---")}>
            Divider
          </button>
        </>
      )}
    </div>
  );
}

export function MarkdownField({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  return (
    <div className="markdown-field">
      <label htmlFor={id}>{label}</label>
      <MarkdownToolbar
        target={ref}
        value={value}
        onChange={onChange}
        label={`${label} formatting`}
        extended
      />
      <textarea
        id={id}
        ref={ref}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
