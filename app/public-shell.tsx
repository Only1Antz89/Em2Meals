import Link from "next/link";

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="3" width="58" height="58" rx="3" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M19 13v14m6-14v14m-12-12v10c0 5 4 9 9 9s9-4 9-9V15M22 34l22 21" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M43 12c-7 0-13 7-13 15 0 5 3 9 7 11m6-26c7 0 13 7 13 15 0 5-3 9-7 11M43 12v25m0-25c-4 4-7 9-7 15 0 4 3 8 7 10m0-25c4 4 7 9 7 15 0 4-3 8-7 10M43 37 19 55" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="44" r="3.6" fill="var(--brand-gold, #d4b36e)" />
    </svg>
  );
}

export function Brand({
  inverse = false,
  admin = false,
}: {
  inverse?: boolean;
  admin?: boolean;
}) {
  return (
    <Link
      href={admin ? "/admin" : "/"}
      className={`brand${inverse ? " brand--inverse" : ""}${admin ? " brand--admin" : ""}`}
      aria-label={admin ? "Em2 Catering Platform dashboard" : "Fork Goodness Baked home"}
    >
      {!admin && <BrandMark className="brand__mark" />}
      <span className="brand__wordmark">
        <strong>{admin ? "Em2" : "Fork Goodness Baked"}</strong>
        <small>{admin ? "Catering Platform" : "Artisanal Goodness"}</small>
      </span>
    </Link>
  );
}

export function Header({
  variant = "light",
}: {
  variant?: "light" | "overlay";
  active?: "private" | "corporate";
}) {
  return (
    <header className={`site-header site-header--${variant}`}>
      <Brand inverse={variant === "overlay"} />
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer" id="footer">
      <div className="footer-lead">
        <Brand inverse />
        <h2>Food for the moments that bring people together.</h2>
        <p>Private dining · Corporate catering</p>
      </div>
      <div className="footer-directory">
        <nav aria-label="Footer pages">
          <span>Explore</span>
          <Link href="/">Home</Link>
          <Link href="/#story">Our story</Link>
          <Link href="/enquire">Make an enquiry</Link>
        </nav>
        <nav aria-label="Footer services">
          <span>Services</span>
          <Link href="/private-chef">Private dining</Link>
          <Link href="/corporate">Corporate catering</Link>
        </nav>
      </div>
      <div className="footer-meta">
        <span>© {new Date().getFullYear()} Fork Goodness Baked</span>
        <span className="footer-credit">
          Built by{" "}
          <a href="https://www.intaillium.com/" target="_blank" rel="noreferrer">
            IntAillium
          </a>
        </span>
        <div>
          <Link href="/privacy">Privacy</Link>
          <Link href="/admin">Owner dashboard</Link>
        </div>
      </div>
    </footer>
  );
}
