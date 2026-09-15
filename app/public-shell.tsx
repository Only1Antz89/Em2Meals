import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link
      href="/"
      className={`brand${inverse ? " brand--inverse" : ""}`}
      aria-label="EM2 Meals home"
    >
      EM<sup>2</sup>
      <span>MEALS</span>
    </Link>
  );
}

export function Header({
  variant = "light",
  active,
}: {
  variant?: "light" | "overlay";
  active?: "private" | "corporate";
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
      </nav>
      <Link className="header-cta" href="/enquire">
        <span className="header-cta-long">Make an enquiry</span>
        <span className="header-cta-short">Enquire</span>
        <ArrowUpRight aria-hidden="true" size={17} />
      </Link>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer" id="footer">
      <div className="footer-lead">
        <div>
          <Brand inverse />
          <p>Black-owned. London-made.</p>
        </div>
        <h2>Food for the moments that bring people together.</h2>
      </div>
      <div className="footer-directory">
        <div>
          <span>Services</span>
          <Link href="/private-chef">Private dining</Link>
          <Link href="/corporate">Corporate catering</Link>
        </div>
        <div>
          <span>Based in</span>
          <p>London</p>
          <p>Private homes · Workplaces · Events</p>
        </div>
        <Link className="footer-enquiry" href="/enquire">
          Make an enquiry <ArrowUpRight aria-hidden="true" size={20} />
        </Link>
      </div>
      <div className="footer-meta">
        <span>© {new Date().getFullYear()} EM² Meals · London</span>
        <div>
          <Link href="/admin">Owner dashboard</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
      </div>
    </footer>
  );
}
