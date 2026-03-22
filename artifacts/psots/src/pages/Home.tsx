import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, Store, Pin, Send, Bell, ShoppingBag, Shield, Users, Clock, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useListNotices, useListEvents, useListListings } from "@workspace/api-client-react";

const GALLERY = [
  { src: "images/aerial-day.jpg", label: "Aerial View", span: "md:col-span-2 md:row-span-2" },
  { src: "images/night-fireworks.jpg", label: "Celebrations", span: "" },
  { src: "images/aerial-night.jpg", label: "Night Lights", span: "" },
  { src: "images/pool-dusk.jpg", label: "Infinity Pool", span: "" },
  { src: "images/main-gate.jpg", label: "Main Entrance", span: "" },
  { src: "images/twilight-clubhouse.jpg", label: "Clubhouse", span: "" },
];

const TYPE_STYLES: Record<string, string> = {
  sell: "bg-blue-50 text-blue-700 border-blue-100",
  buy: "bg-violet-50 text-violet-700 border-violet-100",
  rent: "bg-orange-50 text-orange-700 border-orange-100",
  free: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

export function Home() {
  const { data: notices } = useListNotices();
  const { data: events } = useListEvents({ upcoming: true });
  const { data: listings } = useListListings({ status: "active" });

  const pinnedNotices = notices?.filter(n => n.isPinned && !n.archivedAt).slice(0, 3) || [];
  const upcomingEvents = events?.slice(0, 3) || [];
  const recentListings = listings?.slice(0, 4) || [];

  return (
    <div className="pb-28">
      {/* ─── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src={`${import.meta.env.BASE_URL}images/hero-bg.jpg`}
            alt="Prestige Song of the South"
            className="w-full h-full object-cover object-center"
          />
          {/* Premium dark overlay with slight warm gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a1628]/90 via-[#0a1628]/70 to-[#0a1628]/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a1628]/80 via-transparent to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 relative z-10 w-full pt-20 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-2xl"
          >
            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-7">
              <div className="h-px w-10 bg-accent/80" />
              <span className="text-accent/90 text-xs font-semibold uppercase tracking-[0.2em]">Community Portal</span>
            </div>

            <h1 className="text-6xl md:text-7xl lg:text-8xl font-display font-semibold text-white leading-[0.95] mb-6">
              Your home.<br />
              <em className="not-italic text-accent">Our community.</em>
            </h1>

            <p className="text-white/65 text-lg leading-relaxed max-w-md mb-10">
              Notices, events, the marketplace, and emergency contacts — everything for residents of Prestige Song of the South, in one place.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/notices"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-white text-foreground rounded-xl font-semibold text-sm hover:bg-white/90 transition-all shadow-xl hover:-translate-y-0.5"
              >
                Notice Board <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-white/10 backdrop-blur text-white border border-white/20 rounded-xl font-semibold text-sm hover:bg-white/20 transition-all"
              >
                Marketplace
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30"
        >
          <div className="w-px h-12 bg-gradient-to-b from-transparent to-white/30" />
        </motion.div>
      </section>

      {/* ─── Quick Stats ──────────────────────────────────────────────── */}
      <div className="bg-foreground text-white py-6">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
          <div className="flex flex-wrap gap-x-12 gap-y-4 justify-center md:justify-start">
            {[
              { value: "2,300+", label: "Families" },
              { value: "14", label: "Towers" },
              { value: "33", label: "Acres" },
              { value: "25+", label: "Amenities" },
              { value: "24 / 7", label: "Security" },
            ].map(s => (
              <div key={s.label} className="flex items-baseline gap-2.5">
                <span className="font-display text-2xl font-semibold text-accent">{s.value}</span>
                <span className="text-white/45 text-sm font-medium">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Notices + Events ─────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

          {/* Pinned Notices — takes 3 cols */}
          <div className="lg:col-span-3">
            <SectionHeader title="Pinned Notices" icon={<Pin className="w-4 h-4 fill-current text-red-500" />} href="/notices" cta="View All" />
            <div className="space-y-3 mt-6">
              {pinnedNotices.length > 0 ? pinnedNotices.map((notice, i) => (
                <motion.div
                  key={notice.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="bg-white rounded-2xl p-5 border border-border hover:border-primary/25 hover:shadow-md transition-all group cursor-default"
                >
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-primary bg-primary/8 px-2.5 py-1 rounded-md">{notice.category}</span>
                    <span className="text-[10px] text-muted-foreground font-medium">{notice.tower}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">{format(new Date(notice.createdAt), "MMM d")}</span>
                  </div>
                  <h3 className="font-display font-semibold text-xl text-foreground mb-1 group-hover:text-primary transition-colors leading-snug">{notice.title}</h3>
                  <p className="text-muted-foreground text-sm line-clamp-2 leading-relaxed">{notice.content}</p>
                </motion.div>
              )) : (
                <div className="bg-white rounded-2xl p-8 border border-dashed text-center text-muted-foreground text-sm">
                  No pinned notices right now.
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Events — takes 2 cols */}
          <div className="lg:col-span-2">
            <SectionHeader title="Upcoming Events" icon={<Calendar className="w-4 h-4 text-accent" />} href="/events" cta="All Events" />
            <div className="mt-6 space-y-3">
              {upcomingEvents.length > 0 ? upcomingEvents.map((event, i) => {
                const d = new Date(event.eventDate);
                return (
                  <Link key={event.id} href="/events">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="bg-white rounded-2xl p-4 border border-border hover:border-accent/30 hover:shadow-md transition-all flex gap-4 group"
                    >
                      <div className="w-12 h-12 shrink-0 flex flex-col items-center justify-center rounded-xl bg-accent/10 border border-accent/20 text-accent">
                        <span className="text-[9px] font-bold uppercase leading-none">{format(d, "MMM")}</span>
                        <span className="text-xl font-display font-bold leading-tight">{format(d, "d")}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors line-clamp-1">{event.title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{event.location}</p>
                        <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground font-medium">
                          <Users className="w-3 h-3" /> {event.rsvpCount} attending
                        </div>
                      </div>
                    </motion.div>
                  </Link>
                );
              }) : (
                <div className="bg-white rounded-2xl p-8 border border-dashed text-center text-muted-foreground text-sm">
                  No upcoming events.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Marketplace ──────────────────────────────────────────────── */}
      <div className="bg-secondary/40 py-20">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
          <SectionHeader title="Active Listings" icon={<Store className="w-4 h-4 text-primary" />} href="/marketplace" cta="Browse Market" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-8">
            {recentListings.map((item, i) => (
              <Link key={item.id} href="/marketplace">
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="bg-white rounded-2xl p-5 border border-border hover:shadow-xl hover:border-primary/20 transition-all group relative block h-full"
                >
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <span className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg uppercase tracking-wider border ${TYPE_STYLES[item.type] || "bg-gray-50 text-gray-600 border-gray-100"}`}>
                      {item.type}
                    </span>
                    {item.price && (
                      <span className="font-display font-semibold text-lg text-foreground">₹{Number(item.price).toLocaleString()}</span>
                    )}
                  </div>
                  <h4 className="font-semibold text-foreground mb-1.5 group-hover:text-primary transition-colors leading-snug pr-4">{item.title}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4 leading-relaxed">{item.description}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-medium border-t border-border pt-3">
                    <span>{item.tower}</span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Photo Gallery ────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 py-20">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px w-8 bg-accent" />
            <span className="text-accent text-xs font-semibold uppercase tracking-[0.2em]">Our Home</span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-semibold text-foreground">Life at PSOTS</h2>
          <p className="text-muted-foreground mt-2 text-base">Moments captured by residents</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {GALLERY.map((photo, i) => (
            <motion.div
              key={photo.src}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.1 }}
              className={`relative overflow-hidden rounded-2xl group shadow-sm ${photo.span}`}
              style={{ aspectRatio: i === 0 ? "16/10" : "4/3" }}
            >
              <img
                src={`${import.meta.env.BASE_URL}${photo.src}`}
                alt={photo.label}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="absolute bottom-4 left-4 text-white font-semibold text-sm tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0 drop-shadow">
                {photo.label}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ─── Telegram CTA ─────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 pb-8">
        <div className="relative overflow-hidden rounded-3xl bg-foreground text-white">
          <div className="absolute inset-0 opacity-[0.07]">
            <img src={`${import.meta.env.BASE_URL}images/aerial-night.jpg`} alt="" className="w-full h-full object-cover" />
          </div>
          {/* Gold accent bar */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent" />

          <div className="relative z-10 p-10 md:p-14">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-10">
              <div className="w-16 h-16 rounded-2xl bg-[#0088cc]/20 border border-[#0088cc]/30 flex items-center justify-center shrink-0">
                <Send className="w-7 h-7 text-[#0af]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px w-6 bg-accent/70" />
                  <span className="text-accent/80 text-xs font-semibold uppercase tracking-[0.18em]">Telegram Bot</span>
                </div>
                <h2 className="font-display text-3xl md:text-4xl font-semibold mb-3">Stay connected, without opening the app.</h2>
                <p className="text-white/55 text-base mb-8 max-w-lg">
                  Post notices, list marketplace items, and manage your ads directly from Telegram. The bot handles the rest.
                </p>
                <div className="flex flex-wrap gap-2.5 mb-8">
                  {[
                    { icon: Bell, label: "/notice" },
                    { icon: ShoppingBag, label: "/sell · /buy · /free" },
                    { icon: Calendar, label: "/event" },
                    { icon: Shield, label: "Auto moderation" },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-2 text-xs font-medium text-white/70 bg-white/8 border border-white/10 px-3.5 py-2 rounded-lg">
                      <Icon className="w-3.5 h-3.5 text-accent" /> {label}
                    </div>
                  ))}
                </div>
                <a
                  href="https://t.me/psots_telegram_bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-7 py-3.5 bg-[#0088cc] text-white rounded-xl font-semibold text-sm hover:bg-[#007ab8] transition-all shadow-lg hover:-translate-y-0.5"
                >
                  <Send className="w-4 h-4" /> Open @psots_telegram_bot
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, icon, href, cta }: { title: string, icon: React.ReactNode, href: string, cta: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        {icon}
        <h2 className="font-display text-2xl font-semibold text-foreground">{title}</h2>
      </div>
      <Link href={href} className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors group">
        {cta} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  );
}
