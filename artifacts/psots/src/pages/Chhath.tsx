import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Sun, Droplets, Flame, Sunrise, Calendar, MapPin, Users,
  ChevronRight, ArrowRight, Star, Heart, Music, Camera,
} from "lucide-react";
import { useListEvents, useRsvpEvent, getListEventsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

// ─── Chhath 2026 schedule ────────────────────────────────────────────────────
const CHHATH_YEAR = 2026;
const SCHEDULE = [
  {
    day: 1,
    name: "Nahay Khay",
    nameHindi: "नहाय खाय",
    date: new Date(2026, 10, 3), // Nov 3, 2026
    icon: Droplets,
    color: "from-sky-500 to-cyan-400",
    bg: "bg-sky-50",
    border: "border-sky-200",
    textColor: "text-sky-700",
    description:
      "Devotees take a holy dip in the river or pool, cook and eat gourd (lauki) rice as the first meal. The home is cleaned and preparations begin.",
  },
  {
    day: 2,
    name: "Kharna",
    nameHindi: "खरना",
    date: new Date(2026, 10, 4), // Nov 4, 2026
    icon: Flame,
    color: "from-orange-500 to-amber-400",
    bg: "bg-orange-50",
    border: "border-orange-200",
    textColor: "text-orange-700",
    description:
      "After a full-day fast, devotees prepare kheer (rice pudding with jaggery) and rotis as prasad. The fast is broken at night and distributed to family.",
  },
  {
    day: 3,
    name: "Sanjha Arghya",
    nameHindi: "संध्या अर्घ्य",
    date: new Date(2026, 10, 5, 17, 30), // Nov 5 at 5:30 PM
    icon: Sun,
    color: "from-amber-500 to-yellow-400",
    bg: "bg-amber-50",
    border: "border-amber-200",
    textColor: "text-amber-700",
    description:
      "The most vibrant evening. Devotees in colourful new clothes carry bamboo baskets (daura) filled with prasad to the ghat, offering arghya to the setting sun.",
  },
  {
    day: 4,
    name: "Subahe Arghya",
    nameHindi: "सुबह अर्घ्य",
    date: new Date(2026, 10, 6, 6, 10), // Nov 6 at 6:10 AM
    icon: Sunrise,
    color: "from-rose-500 to-pink-400",
    bg: "bg-rose-50",
    border: "border-rose-200",
    textColor: "text-rose-700",
    description:
      "Before sunrise devotees return to the ghat and offer the final arghya to the rising sun. The fast is broken and prasad distributed. The puja concludes.",
  },
];

const HIGHLIGHT_CARDS = [
  { icon: Users,  label: "2,300+ Families", sub: "across 14 towers" },
  { icon: Heart,  label: "Community Celebration", sub: "organised by residents" },
  { icon: MapPin, label: "Tower 8 Garden + Pool Deck", sub: "main ghat venue" },
  { icon: Music,  label: "Folk Songs & Festivity", sub: "Chhath geet all evening" },
];

// ─── Countdown hook ───────────────────────────────────────────────────────────
function useCountdown(target: Date) {
  const [diff, setDiff] = useState(target.getTime() - Date.now());
  useEffect(() => {
    const t = setInterval(() => setDiff(target.getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  if (diff <= 0) return null;
  const days    = Math.floor(diff / 86400000);
  const hours   = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000)  / 60000);
  const seconds = Math.floor((diff % 60000)    / 1000);
  return { days, hours, minutes, seconds };
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function Chhath() {
  // First arghya is the headline event
  const sanjhaArghya = SCHEDULE[2].date;
  const countdown = useCountdown(sanjhaArghya);

  const { data: allEvents } = useListEvents();
  const chhathEvents = allEvents?.filter(e =>
    e.title.toLowerCase().includes("chhath") ||
    e.description?.toLowerCase().includes("chhath")
  ) ?? [];

  return (
    <div className="pb-24">
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[88vh] flex items-center overflow-hidden bg-[#1a0a00]">
        {/* Warm gradient sky */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#2d0d00] via-[#7c2d12] to-[#c2410c] opacity-90" />
          {/* Sun glow */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-t-full bg-gradient-radial from-amber-300/40 via-orange-500/20 to-transparent blur-3xl" />
          <div className="absolute bottom-[-40px] left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-amber-300/30 blur-2xl" />
          {/* Reflections */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-amber-900/60 to-transparent" />
          {/* Ripple lines (decorative) */}
          <svg className="absolute bottom-0 left-0 right-0 w-full opacity-20" viewBox="0 0 1440 80" fill="none">
            <path d="M0 40 Q360 10 720 40 Q1080 70 1440 40" stroke="#FCD34D" strokeWidth="2" />
            <path d="M0 55 Q360 25 720 55 Q1080 85 1440 55" stroke="#FCD34D" strokeWidth="1.5" />
            <path d="M0 65 Q360 35 720 65 Q1080 95 1440 65" stroke="#FCD34D" strokeWidth="1" />
          </svg>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 w-full pt-24 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-2xl"
          >
            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-7">
              <div className="h-px w-10 bg-amber-300/80" />
              <span className="text-amber-300/90 text-xs font-semibold uppercase tracking-[0.2em]">
                Annual Celebration · Prestige Song of the South
              </span>
            </div>

            <h1 className="text-6xl md:text-7xl lg:text-8xl font-display font-bold text-white leading-[0.92] mb-5">
              Chhath<br />
              <em className="not-italic text-amber-300">Puja {CHHATH_YEAR}</em>
            </h1>

            <p className="text-white/65 text-lg leading-relaxed max-w-md mb-10">
              Celebrating the ancient Vedic festival of the Sun God at PSOTS —
              with the entire community, at the ghat, together.
            </p>

            <div className="flex flex-wrap gap-3">
              <a
                href="#schedule"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-amber-400 text-amber-900 rounded-xl font-semibold text-sm hover:bg-amber-300 transition-all shadow-xl hover:-translate-y-0.5"
              >
                View Schedule <ChevronRight className="w-4 h-4" />
              </a>
              <Link
                href="/events"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-white/10 backdrop-blur text-white border border-white/20 rounded-xl font-semibold text-sm hover:bg-white/20 transition-all"
              >
                All Events
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 w-px h-12 bg-gradient-to-b from-amber-300/40 to-transparent"
        />
      </section>

      {/* ─── Countdown ───────────────────────────────────────────────────── */}
      {countdown && (
        <div className="bg-amber-950 text-white py-8">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 text-center">
            <p className="text-amber-300/70 text-xs font-semibold uppercase tracking-[0.2em] mb-4">
              Countdown to Sanjha Arghya — {format(sanjhaArghya, "EEEE, MMMM d")}
            </p>
            <div className="flex items-center justify-center gap-3 sm:gap-6">
              {[
                { value: countdown.days,    label: "Days" },
                { value: countdown.hours,   label: "Hours" },
                { value: countdown.minutes, label: "Minutes" },
                { value: countdown.seconds, label: "Seconds" },
              ].map(({ value, label }, i) => (
                <div key={label} className="flex items-start gap-3 sm:gap-6">
                  {i > 0 && <span className="font-display text-3xl text-amber-400/50 mt-1">:</span>}
                  <div className="flex flex-col items-center">
                    <span className="font-display text-4xl sm:text-5xl font-bold text-amber-300 tabular-nums">
                      {String(value).padStart(2, "0")}
                    </span>
                    <span className="text-white/40 text-[10px] uppercase tracking-widest mt-1">{label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Highlights strip ─────────────────────────────────────────────── */}
      <div className="bg-amber-50 border-y border-amber-100 py-8">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {HIGHLIGHT_CARDS.map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-amber-700" />
                </div>
                <div>
                  <div className="font-semibold text-amber-900 text-sm leading-snug">{label}</div>
                  <div className="text-amber-700/70 text-xs mt-0.5">{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── About section ────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-8 bg-amber-500" />
              <span className="text-amber-600 text-xs font-semibold uppercase tracking-[0.2em]">About the Festival</span>
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-semibold text-foreground mb-6 leading-snug">
              Celebrating the<br />
              <span className="text-amber-600">Sun God Surya</span>
            </h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                Chhath Puja is one of the oldest and most revered Vedic festivals in the Hindu tradition.
                Dedicated to Surya (the Sun God) and Chhathi Maiya, it celebrates the life-giving energy
                of the sun and expresses gratitude for the prosperity it brings.
              </p>
              <p>
                Unlike most Hindu festivals, Chhath requires no priest — devotees offer prayers
                directly to nature, standing in water at dawn and dusk. It is a festival of
                discipline, purity, and community — making it deeply resonant at PSOTS.
              </p>
              <p>
                At Prestige Song of the South, our North Indian families have transformed our pool deck
                and gardens into a glowing ghat every year — and the entire community joins in the
                celebration, regardless of background.
              </p>
            </div>
          </motion.div>

          {/* Decorative card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative"
          >
            <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-red-600 p-1 shadow-2xl">
              <div className="rounded-[22px] bg-gradient-to-br from-amber-950 to-orange-950 p-8 md:p-10">
                <div className="flex items-center gap-3 mb-8">
                  <Star className="w-5 h-5 text-amber-300 fill-amber-300" />
                  <span className="text-amber-300 font-semibold text-sm uppercase tracking-widest">
                    Chhath {CHHATH_YEAR} Venue
                  </span>
                </div>
                <h3 className="font-display text-2xl text-white font-semibold mb-2">Tower 8 Garden &amp; Pool Deck</h3>
                <p className="text-white/55 text-sm mb-6">Prestige Song of the South, Bangalore</p>
                <div className="space-y-3 text-sm">
                  {[
                    { icon: "📅", text: `November 3–6, ${CHHATH_YEAR}` },
                    { icon: "🌅", text: "Evening arghya: Nov 5, ~5:30 PM IST" },
                    { icon: "🌄", text: "Morning arghya: Nov 6, ~6:10 AM IST" },
                    { icon: "📍", text: "Tower 8 Garden Ghat" },
                    { icon: "🪔", text: "Prasad distribution for all residents" },
                    { icon: "🎶", text: "Chhath geet & folk music evening" },
                  ].map(({ icon, text }) => (
                    <div key={text} className="flex items-center gap-3 text-white/70">
                      <span className="text-base">{icon}</span>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href="/events"
                  className="mt-8 inline-flex items-center gap-2 px-5 py-3 bg-amber-400 text-amber-900 rounded-xl text-sm font-bold hover:bg-amber-300 transition-all"
                >
                  RSVP on Events Page <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
            {/* Glow */}
            <div className="absolute -inset-4 rounded-3xl bg-amber-500/10 blur-2xl -z-10" />
          </motion.div>
        </div>
      </div>

      {/* ─── 4-day Schedule ───────────────────────────────────────────────── */}
      <div id="schedule" className="bg-gradient-to-b from-amber-950 to-orange-950 py-20">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
          <div className="text-center mb-14">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-px w-8 bg-amber-400/60" />
              <span className="text-amber-400/80 text-xs font-semibold uppercase tracking-[0.2em]">
                Four Sacred Days
              </span>
              <div className="h-px w-8 bg-amber-400/60" />
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-semibold text-white mb-3">Festival Schedule</h2>
            <p className="text-white/50 text-base">November 3–6, {CHHATH_YEAR}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {SCHEDULE.map((day, i) => {
              const Icon = day.icon;
              return (
                <motion.div
                  key={day.name}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden hover:bg-white/8 transition-all"
                >
                  {/* Top gradient bar */}
                  <div className={`h-1.5 bg-gradient-to-r ${day.color}`} />
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${day.color} flex items-center justify-center shadow-lg`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-white/40 text-[10px] uppercase tracking-widest font-semibold">Day {day.day}</div>
                        <div className="font-semibold text-white text-sm leading-tight">{day.name}</div>
                      </div>
                    </div>
                    <div className="text-amber-300/80 text-sm font-medium mb-1">{day.nameHindi}</div>
                    <div className="text-white/45 text-xs mb-4 font-medium">
                      {format(day.date, day.day === 3 || day.day === 4 ? "EEEE, MMM d · h:mm a" : "EEEE, MMMM d")}
                    </div>
                    <p className="text-white/55 text-sm leading-relaxed">{day.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Community RSVP / Events from DB ─────────────────────────────── */}
      {chhathEvents.length > 0 && (
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 py-20">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px w-8 bg-amber-500" />
            <span className="text-amber-600 text-xs font-semibold uppercase tracking-[0.2em]">Community Events</span>
          </div>
          <h2 className="font-display text-3xl font-semibold text-foreground mb-8">Chhath Events this Year</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {chhathEvents.map((event, i) => (
              <ChhathEventCard key={event.id} event={event} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* ─── Volunteer / Participate CTA ──────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 py-8">
        <div className="rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 p-10 md:p-14 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-4 left-8 text-8xl">🪔</div>
            <div className="absolute bottom-4 right-8 text-8xl">🌅</div>
            <div className="absolute top-8 right-24 text-5xl">☀️</div>
          </div>
          <div className="relative z-10 max-w-xl mx-auto">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
              Be Part of the Celebration
            </h2>
            <p className="text-white/80 text-base leading-relaxed mb-8">
              Whether you're a devotee, a volunteer, or simply a neighbour who wants to
              experience the magic — you are welcome at the PSOTS Chhath Ghat.
              Everyone is family here.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/events"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-white text-amber-700 rounded-xl font-bold text-sm hover:bg-amber-50 transition-all shadow-xl hover:-translate-y-0.5"
              >
                <Calendar className="w-4 h-4" /> RSVP to Chhath Events
              </Link>
              <Link
                href="/notices"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-white/15 backdrop-blur text-white border border-white/30 rounded-xl font-semibold text-sm hover:bg-white/25 transition-all"
              >
                <Camera className="w-4 h-4" /> See Announcements
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Footer breadcrumb ────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 py-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium">Chhath Puja {CHHATH_YEAR}</span>
        </div>
        <p className="text-xs text-muted-foreground/60 mt-2">
          Celebrating at psots.in · chhath.psots.in
        </p>
      </div>
    </div>
  );
}

// ─── Mini event card for DB-backed Chhath events ─────────────────────────────
function ChhathEventCard({ event, index }: { event: any; index: number }) {
  const rsvpMutation = useRsvpEvent();
  const queryClient = useQueryClient();
  const [hasRsvped, setHasRsvped] = useState(false);
  const date = new Date(event.eventDate);

  const handleRsvp = () => {
    if (hasRsvped) return;
    rsvpMutation.mutate({ id: event.id }, {
      onSuccess: () => {
        setHasRsvped(true);
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
      },
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="bg-white rounded-2xl border border-amber-100 overflow-hidden shadow-sm hover:shadow-lg hover:border-amber-200 transition-all group"
    >
      {event.imageUrl ? (
        <div className="h-40 overflow-hidden">
          <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        </div>
      ) : (
        <div className="h-24 bg-gradient-to-br from-amber-400 via-orange-400 to-red-500 flex items-center justify-center">
          <Sun className="w-10 h-10 text-white/70" />
        </div>
      )}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-lg">
            {format(date, "MMM d")}
          </span>
          <span className="text-[10px] text-muted-foreground font-medium">{format(date, "h:mm a")}</span>
        </div>
        <h3 className="font-display font-semibold text-lg text-foreground mb-1 group-hover:text-amber-700 transition-colors leading-snug">{event.title}</h3>
        <p className="text-muted-foreground text-sm line-clamp-2 mb-4">{event.description}</p>
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Users className="w-3.5 h-3.5" /> {event.rsvpCount} attending
          </div>
          <button
            onClick={handleRsvp}
            disabled={hasRsvped || rsvpMutation.isPending}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              hasRsvped
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                : "bg-amber-400 text-amber-900 hover:bg-amber-300 shadow-sm hover:-translate-y-0.5"
            }`}
          >
            {hasRsvped ? "✓ Going!" : "I'm Coming 🙏"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
