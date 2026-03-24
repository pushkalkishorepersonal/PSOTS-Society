import { Link, useLocation } from "wouter";
import { Menu, X, Send, Phone, Calendar, ShoppingBag, Megaphone, ChevronRight, BookOpen, LogIn, LogOut } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  not_registered: "Your account is not registered. Contact the Society Office.",
  cancelled: "Login was cancelled.",
  google_failed: "Google sign-in failed. Please try again.",
  server_error: "Server error. Please try again.",
  invalid_state: "Login session expired. Please try again.",
  no_email: "Could not retrieve your email from Google.",
};

function LoginModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { login } = useAuth();
  const [tgStatus, setTgStatus] = useState<"idle" | "loading" | "error">("idle");
  const [tgError, setTgError] = useState("");
  const tgContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Expose global callback for Telegram widget
    (window as any).onTelegramAuth = async (user: Record<string, string>) => {
      setTgStatus("loading");
      setTgError("");
      try {
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
        });
        const data = (await res.json()) as { token?: string; message?: string; error?: string };
        if (data.token) {
          login(data.token);
          onClose();
        } else {
          setTgStatus("error");
          setTgError(data.message ?? data.error ?? "Login failed. Please try again.");
        }
      } catch {
        setTgStatus("error");
        setTgError("Could not connect to server. Please try again.");
      }
    };

    // Load Telegram Login Widget script
    const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? "psots_telegram_bot";
    const existing = document.getElementById("tg-login-script");
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.id = "tg-login-script";
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    script.async = true;
    tgContainerRef.current?.appendChild(script);

    return () => {
      delete (window as any).onTelegramAuth;
    };
  }, [isOpen, login, onClose]);

  function handleClose() {
    setTgStatus("idle");
    setTgError("");
    onClose();
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

        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Sign in with your registered account.
          </p>

          {/* Google OAuth */}
          <a
            href="/api/auth/google"
            className="flex items-center justify-center gap-3 w-full py-3 border border-border rounded-xl font-medium text-sm hover:bg-secondary transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </a>

          <div className="relative flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Telegram Login Widget */}
          <div className="flex flex-col items-center gap-2">
            {tgStatus === "loading" && (
              <p className="text-sm text-muted-foreground">Verifying with Telegram…</p>
            )}
            {tgStatus === "error" && (
              <p className="text-sm text-destructive text-center px-1">{tgError}</p>
            )}
            <div ref={tgContainerRef} className="flex justify-center" />
          </div>

          <p className="text-[11px] text-muted-foreground text-center pt-1">
            Only registered residents can log in. Contact the Society Office to get registered.
          </p>
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
  const { toast } = useToast();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Show error toast if Google OAuth redirected back with an error
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    if (!authError) return;
    toast({
      variant: "destructive",
      title: "Login failed",
      description: AUTH_ERROR_MESSAGES[authError] ?? "Something went wrong. Please try again.",
    });
    // Clean up the URL
    const url = new URL(window.location.href);
    url.searchParams.delete("auth_error");
    window.history.replaceState({}, "", url.toString());
  }, [toast]);

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
