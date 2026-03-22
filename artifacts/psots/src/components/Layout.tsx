import { Link, useLocation } from "wouter";
import { Menu, X, Send, Phone, Calendar, ShoppingBag, Megaphone, ChevronRight, BookOpen, Sun } from "lucide-react";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/notices", label: "Notices" },
  { href: "/events", label: "Events" },
  { href: "/chhath", label: "🪔 Chhath" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/contacts", label: "Contacts" },
  { href: "/guide", label: "Guide" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Navbar */}
      <header className={cn(
        "sticky top-0 z-40 w-full transition-all duration-300",
        scrolled
          ? "bg-white/95 backdrop-blur-xl border-b border-border/60 shadow-sm"
          : "bg-transparent"
      )}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 h-18 flex items-center justify-between py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3.5 group">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md group-hover:shadow-primary/30 transition-shadow">
                <span className="font-display font-bold text-white text-sm tracking-widest">PS</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-display font-semibold text-lg leading-none text-foreground tracking-wide">PSOTS</span>
              <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-medium mt-0.5">Prestige Song of the South</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative px-4 py-2 text-sm font-medium transition-colors rounded-lg",
                  location === link.href
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
                {location === link.href && (
                  <motion.span
                    layoutId="nav-indicator"
                    className="absolute inset-0 bg-primary/8 rounded-lg border border-primary/15"
                    transition={{ type: "spring", bounce: 0.25, duration: 0.4 }}
                  />
                )}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <a
              href="https://t.me/psots_telegram_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0088cc] text-white text-sm font-medium hover:bg-[#0077b3] transition-colors shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              Telegram Bot
            </a>
          </div>

          {/* Mobile Toggle */}
          <button
            className="md:hidden p-2 rounded-lg text-foreground hover:bg-secondary transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-b bg-white shadow-lg overflow-hidden sticky top-[72px] z-30"
          >
            <nav className="flex flex-col p-4 space-y-1">
              {NAV_LINKS.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                    location === link.href
                      ? "bg-primary/8 text-primary"
                      : "text-foreground hover:bg-secondary"
                  )}
                >
                  {link.label}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </Link>
              ))}
              <a
                href="https://t.me/psots_telegram_bot"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-3 mt-2 rounded-xl bg-[#0088cc] text-white text-sm font-medium"
              >
                <Send className="w-4 h-4" /> Open Telegram Bot
              </a>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-foreground text-white pt-14 pb-8 mt-auto">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 mb-12">
            {/* Brand */}
            <div className="md:col-span-5">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/15">
                  <span className="font-display font-bold text-white text-sm tracking-widest">PS</span>
                </div>
                <div>
                  <div className="font-display font-semibold text-lg text-white leading-none">PSOTS</div>
                  <div className="text-[9px] uppercase tracking-[0.18em] text-white/50 mt-0.5">Prestige Song of the South</div>
                </div>
              </div>
              <p className="text-white/55 text-sm leading-relaxed max-w-xs mb-6">
                A self-managed community portal for the 2,300 families across 14 towers. Built by residents, for residents.
              </p>
              <a
                href="https://t.me/psots_telegram_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 bg-[#0088cc]/90 text-white rounded-lg hover:bg-[#0088cc] transition-colors"
              >
                <Send className="w-4 h-4" /> @psots_telegram_bot
              </a>
            </div>

            {/* Quick Links */}
            <div className="md:col-span-3">
              <h3 className="font-sans font-semibold text-xs uppercase tracking-[0.15em] text-white/40 mb-5">Portal</h3>
              <ul className="space-y-3">
                {[
                  { href: "/notices", icon: Megaphone, label: "Notice Board" },
                  { href: "/events", icon: Calendar, label: "Events" },
                  { href: "/marketplace", icon: ShoppingBag, label: "Marketplace" },
                  { href: "/contacts", icon: Phone, label: "Emergency Contacts" },
                  { href: "/guide", icon: BookOpen, label: "Community Guide" },
                  { href: "/chhath", icon: Sun, label: "Chhath Puja" },
                ].map(({ href, icon: Icon, label }) => (
                  <li key={href}>
                    <Link href={href} className="flex items-center gap-2.5 text-sm text-white/60 hover:text-white transition-colors">
                      <Icon className="w-3.5 h-3.5" /> {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Bot Commands */}
            <div className="md:col-span-4">
              <h3 className="font-sans font-semibold text-xs uppercase tracking-[0.15em] text-white/40 mb-5">Telegram Commands</h3>
              <ul className="grid grid-cols-2 gap-2">
                {["/notice", "/event", "/sell", "/buy", "/free", "/rules", "/mylistings", "/sold"].map(cmd => (
                  <li key={cmd}>
                    <span className="text-[#0af] text-sm font-mono font-medium">{cmd}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-white/30">
            <span>© 2026 PSOTS Community Portal · psots.in</span>
            <span>Self-managed · No ads · No spam</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
