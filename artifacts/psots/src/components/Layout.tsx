import { Link, useLocation } from "wouter";
import { Menu, X, Send, Phone, Calendar, ShoppingBag, Megaphone, ChevronRight, BookOpen, LogIn, LogOut, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/notices", label: "Notices" },
  { href: "/events", label: "Events" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/contacts", label: "Contacts" },
  { href: "/guide", label: "Guide" },
];

const ROLE_LABELS: Record<string, string> = {
  resident: "Resident",
  committee: "Committee",
  admin: "Admin",
};

// ─── Login Modal ──────────────────────────────────────────────────────────────

function LoginModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function reset() {
    setEmail("");
    setFlatNumber("");
    setStatus("idle");
    setErrorMsg("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !flatNumber) return;
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), flatNumber: flatNumber.trim() }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setStatus("sent");
      } else {
        setStatus("error");
        setErrorMsg(typeof data.error === "string" ? data.error : "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Could not connect to server. Please try again.");
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-sm rounded-3xl shadow-2xl border overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-display font-bold">Log in to PSOTS</h2>
          <button onClick={handleClose} className="p-2 hover:bg-secondary rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {status === "sent" ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">📬</div>
              <h3 className="font-display text-lg font-semibold mb-1">Check your inbox</h3>
              <p className="text-sm text-muted-foreground">
                If your email and flat number match our records, a login link has been sent. It expires in 15 minutes.
              </p>
              <button
                onClick={handleClose}
                className="mt-5 w-full py-2.5 bg-secondary text-foreground rounded-xl font-medium text-sm hover:bg-secondary/80 transition-colors"
              >
                Got it
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter your registered email and flat number — we'll send a one-click login link.
              </p>

              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address"
                  required
                  className="w-full px-4 py-3 bg-secondary/50 rounded-xl outline-none transition-all focus:bg-card text-sm"
                />
              </div>

              <div>
                <input
                  type="text"
                  value={flatNumber}
                  onChange={(e) => setFlatNumber(e.target.value)}
                  placeholder="Flat number (e.g. 1203)"
                  required
                  className="w-full px-4 py-3 bg-secondary/50 rounded-xl outline-none transition-all focus:bg-card text-sm"
                />
              </div>

              {status === "error" && (
                <p className="text-sm text-destructive px-1">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors flex justify-center items-center gap-2"
              >
                {status === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send login link"}
              </button>

              <p className="text-[11px] text-muted-foreground text-center">
                Only registered residents can log in. Contact the Society Office to get registered.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const { user, isLoggedIn, logout } = useAuth();

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

            {isLoggedIn && user ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/8 border border-primary/15 rounded-lg">
                  <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col leading-none">
                    <span className="text-xs font-semibold text-foreground">{user.name}</span>
                    <span className="text-[10px] text-muted-foreground capitalize">{ROLE_LABELS[user.role]}</span>
                  </div>
                </div>
                <button
                  onClick={logout}
                  title="Log out"
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setLoginOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                Log in
              </button>
            )}
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

              {isLoggedIn && user ? (
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-primary/8 border border-primary/15">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{user.name}</div>
                      <div className="text-[10px] text-muted-foreground capitalize">{ROLE_LABELS[user.role]}</div>
                    </div>
                  </div>
                  <button onClick={() => { logout(); setMobileMenuOpen(false); }} className="text-xs text-muted-foreground font-medium flex items-center gap-1 hover:text-foreground">
                    <LogOut className="w-3.5 h-3.5" /> Log out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setLoginOpen(true); setMobileMenuOpen(false); }}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors"
                >
                  <LogIn className="w-4 h-4" /> Log in
                </button>
              )}
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

      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
