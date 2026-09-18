import Link from "next/link";

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M25 12C13 15 7 24 7 34s6 19 18 22M40 12c11 4 17 12 17 22s-6 18-17 22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M22 19c-7 4-11 9-11 15s4 11 11 15M43 19c7 4 10 9 10 15s-4 11-11 15" fill="none" stroke="var(--brand-accent, #8096a2)" strokeWidth="2" strokeLinecap="round" opacity=".92" />
      <path d="M27 8v17c0 5 3 8 6 9v19c0 2 1 4 2 4s2-2 2-4V34c3-1 6-4 6-9V8M32 8v17m6-17v17" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
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
        <strong
          style={admin ? undefined : { fontFamily: '"Iowan Old Style", Baskerville, Georgia, serif', fontSize: "1rem", fontWeight: 500, letterSpacing: "0.06em" }}
        >
          {admin ? "Em2" : "Fork Goodness"}
        </strong>
        <small style={admin ? undefined : { letterSpacing: "0.5em" }}>
          {admin ? "Catering Platform" : "Baked"}
        </small>
      </span>
    </Link>
  );
}

export function Header({
  variant = "light",
  active,
}: {
  variant?: "light" | "overlay";
  active?: "private" | "corporate" | "about";
}) {
  return (
    <header className={`site-header site-header--${variant}`}>
      <Brand inverse={variant === "overlay"} />
      <nav aria-label="Main navigation">
        <Link
          href="/private-chef"
          aria-current={active === "private" ? "page" : undefined}
        >
          Private dining
        </Link>
        <Link
          href="/corporate"
          aria-current={active === "corporate" ? "page" : undefined}
        >
          Corporate catering
        </Link>
        <Link
          href="/about"
          aria-current={active === "about" ? "page" : undefined}
        >
          About us
        </Link>
      </nav>
      <Link href="/enquire" className="header-cta">
        Enquire
      </Link>
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
          <Link href="/about">About us</Link>
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
