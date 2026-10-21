import type { ReactNode } from "react";

// A deliberately small Markdown subset shared by recipe instructions and
// website menus. Only these constructs render; everything else stays text.
//   # / ## / ###   headings        **bold**  *italic*  __underline__  ==highlight==
//   {navy}…{/}     brand colours   {small}…{/} {large}…{/}
//   1. step        numbered line   - item     bullet line
//   ^ text         centred line    ---        divider
const tokens =
  /(\*\*[^*]+\*\*|__[^_]+__|==[^=]+==|\*[^*]+\*|\{(?:red|navy|gold|green)\}[^{}]+\{\/\}|\{(?:small|large)\}[^{}]+\{\/\})/g;

function renderInline(text: string): ReactNode[] {
  return text
    .split(tokens)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith("**"))
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("__")) return <u key={index}>{part.slice(2, -2)}</u>;
      if (part.startsWith("=="))
        return <mark key={index}>{part.slice(2, -2)}</mark>;
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2)
        return <em key={index}>{part.slice(1, -1)}</em>;
      const style = part.match(
        /^\{(red|navy|gold|green|small|large)\}(.+)\{\/\}$/,
      );
      return style ? (
        <span key={index} className={`markdown-${style[1]}`}>
          {style[2]}
        </span>
      ) : (
        part
      );
    });
}

export function RestrictedMarkdown({
  source,
  className = "",
}: {
  source: string;
  className?: string;
}) {
  const rows = source.split("\n").filter((line) => line.trim());
  return (
    <div className={`restricted-markdown ${className}`.trim()}>
      {rows.map((line, index) => {
        if (/^\s*-{3,}\s*$/.test(line)) return <hr key={index} />;
        if (line.startsWith("### "))
          return <h5 key={index}>{renderInline(line.slice(4))}</h5>;
        if (line.startsWith("## "))
          return <h4 key={index}>{renderInline(line.slice(3))}</h4>;
        if (line.startsWith("# "))
          return <h3 key={index}>{renderInline(line.slice(2))}</h3>;
        if (line.startsWith("^ "))
          return (
            <p className="markdown-centre" key={index}>
              {renderInline(line.slice(2))}
            </p>
          );
        const ordered = line.match(/^(\d+)\.\s+(.+)/);
        if (ordered)
          return (
            <p className="markdown-step" key={index}>
              <span>{ordered[1]}.</span>
              {renderInline(ordered[2])}
            </p>
          );
        const bullet = line.match(/^[-*]\s+(.+)/);
        if (bullet)
          return (
            <p className="markdown-bullet" key={index}>
              {renderInline(bullet[1])}
            </p>
          );
        return <p key={index}>{renderInline(line)}</p>;
      })}
    </div>
  );
}
