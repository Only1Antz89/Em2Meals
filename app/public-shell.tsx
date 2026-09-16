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
      <path d="M15 14v13c0 6 4 10 9 10s9-4 9-10V14M21 14v13m6-13v13M24 37l22 18" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M45 13c-6 0-10 6-10 14 0 7 4 12 10 12s10-5 10-12c0-8-4-14-10-14Zm0 0c-3 4-5 9-5 14s2 9 5 12m0-26c3 4 5 9 5 14s-2 9-5 12m0-26v26M45 39 18 55" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="47" r="3.7" fill="var(--brand-gold, #d4b36e)" />
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
