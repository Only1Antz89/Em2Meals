import { ArrowUpRight } from "lucide-react";
export function Brand() {
  return (
    <a href="/" className="brand" aria-label="EM2 Meals home">
      EM<sup>2</sup>
      <span>MEALS</span>
    </a>
  );
}
export function Header() {
  return (
    <header className="site-header">
      <Brand />
      <nav aria-label="Main navigation">
        <a href="/private-chef">Private chef & events</a>
        <a href="/corporate">Corporate catering</a>
      </nav>
      <a className="header-cta" href="/enquire">
        Let’s talk food <ArrowUpRight size={17} />
      </a>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <Brand />
      <p>Thoughtfully cooked. Beautifully shared.</p>
      <div>
        <a href="/enquire">Make an enquiry</a>
        <a href="/admin">Owner dashboard</a>
        <a href="/privacy">Privacy</a>
      </div>
      <small>© {new Date().getFullYear()} EM² Meals · London & the M25</small>
    </footer>
  );
}
