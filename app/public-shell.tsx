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
        <p>Private dining · Corporate catering · London</p>
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
