import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const links = [
  ['Home', '#home'],
  ['About', '#about'],
  ['Community', '#community'],
  ['Experiences', '#experiences'],
  ['Collaborations', '#collaborations'],
  ['Journey', '#journey'],
  ['Connect', '#connect'],
];

export function EliteNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const closeMenu = () => setOpen(false);

  return (
    <header className={`elite-nav ${scrolled ? 'scrolled' : ''}`}>
      <div className="elite-shell flex h-[76px] items-center justify-between">
        <a href="#home" onClick={closeMenu} className="focus-ring flex items-center gap-3" data-testid="link-brand-home">
          <span className="grid size-9 place-items-center border border-[#d5b264]/60 bg-[#090908]">
            <span className="font-serif text-lg text-[#d5b264]">A</span>
          </span>
          <span className="hidden text-[.66rem] font-semibold uppercase tracking-[.22em] text-[#f1e9d4] sm:block">Abuja Elite</span>
        </a>

        <nav aria-label="Primary navigation" className="hidden items-center gap-7 lg:flex">
          {links.map(([label, href]) => (
            <a key={href} href={href} className="nav-link focus-ring" data-testid={`link-nav-${label.toLowerCase()}`}>
              {label}
            </a>
          ))}
        </nav>

        <a href="#connect" className="gold-button hidden min-h-[40px] px-4 lg:inline-flex" data-testid="button-nav-connect">
          Start a conversation
        </a>
        <button
          type="button"
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="focus-ring grid size-11 place-items-center border border-[#d5b264]/40 text-[#f1e9d4] lg:hidden"
          data-testid="button-mobile-menu"
        >
          {open ? <X size={18} strokeWidth={1.5} /> : <Menu size={18} strokeWidth={1.5} />}
        </button>
      </div>

      {open && (
        <nav aria-label="Mobile navigation" className="elite-shell border-t border-[#d5b264]/20 bg-[#171510] pb-5 pt-4 lg:hidden">
          <div className="grid gap-1">
            {links.map(([label, href]) => (
              <a key={href} href={href} onClick={closeMenu} className="focus-ring px-2 py-3 text-sm uppercase tracking-[.13em] text-[#b4ae9d]" data-testid={`link-mobile-${label.toLowerCase()}`}>
                {label}
              </a>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}