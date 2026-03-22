import { motion } from "framer-motion";
import {
  Mail, Phone, ExternalLink, Clock, AlertTriangle, Zap,
  Waves, Dumbbell, Music, Trophy, Trees, Car, Trash2,
  ChevronDown, ChevronUp, BookOpen, Users
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// ─── DATA ──────────────────────────────────────────────────────────────────

const OFFICIAL_CHANNELS = [
  {
    label: "Executive Committee",
    value: "ec@psots.in",
    type: "email",
    note: "Escalation Level 4 — governance, decisions",
    color: "bg-primary/8 border-primary/20 text-primary",
  },
  {
    label: "Finance / Accounting",
    value: "finance@psots.in",
    type: "email",
    note: "CAM dues, maintenance charges, invoices",
    color: "bg-amber-50 border-amber-200 text-amber-700",
  },
  {
    label: "Property Management Helpdesk",
    value: "sots.helpdesk@prestigeconstructions.co.in",
    type: "email",
    note: "Raise tickets on MyGate first — email for follow-ups",
    color: "bg-emerald-50 border-emerald-200 text-emerald-700",
  },
  {
    label: "Helpdesk Phone",
    value: "+91 63665 61152",
    type: "phone",
    note: "Also: +91 804140 4804",
    color: "bg-blue-50 border-blue-200 text-blue-700",
  },
];

const ESCALATION = [
  { level: "1", title: "MyGate Helpdesk", desc: "Raise a ticket on MyGate app for any issue — maintenance, complaints, requests." },
  { level: "2", title: "Property Management POC", desc: "Manjunath G — if the MyGate ticket is unresolved." },
  { level: "3", title: "Finance / Estate Manager", desc: "finance@psots.in for billing issues. Estate Manager for operational escalations." },
  { level: "4", title: "Executive Committee", desc: "ec@psots.in — final authority for unresolved grievances." },
];

const AMENITY_GROUPS = [
  {
    icon: Waves,
    title: "Swimming Pool",
    color: "text-cyan-600",
    bg: "bg-cyan-50 border-cyan-100",
    items: [
      { name: "Swimming Pool (Main)", timing: "Tue–Sun: 6:00 AM – 1:00 PM & 3:00 PM – 8:00 PM", note: "Closed Mondays" },
      { name: "Kids' Pool", timing: "Same as main pool", note: "Children under 4 not allowed in main pool" },
    ],
    rules: [
      "Shower before entering the pool",
      "Swim caps and proper swimwear mandatory — no boxers, denims or t-shirts",
      "Children under 15 must be accompanied by an adult (18+)",
      "No food inside pool area — only water or sports drinks",
      "Pets not permitted near the pool",
    ],
  },
  {
    icon: Dumbbell,
    title: "Fitness & Indoor Sports",
    color: "text-violet-600",
    bg: "bg-violet-50 border-violet-100",
    items: [
      { name: "Gym", timing: "As per clubhouse hours", note: "Book via MyGate" },
      { name: "Yoga Room", timing: "As per clubhouse hours", note: "Book via MyGate" },
      { name: "Movement Studio (Dance / Aerobics)", timing: "As per clubhouse hours", note: "Book via MyGate" },
      { name: "2 Badminton Courts", timing: "As per clubhouse hours", note: "Non-marking shoes mandatory" },
      { name: "2 Squash Courts", timing: "As per clubhouse hours", note: "Non-marking shoes mandatory" },
      { name: "Table Tennis Room", timing: "As per clubhouse hours", note: "Book via MyGate" },
      { name: "Snooker / Billiards Room", timing: "As per clubhouse hours", note: "Book via MyGate" },
      { name: "Indoor Games Room", timing: "As per clubhouse hours", note: "Carrom, chess, etc." },
      { name: "Sauna", timing: "As per clubhouse hours", note: "Book via MyGate; shower before use" },
    ],
    rules: [
      "All amenities must be booked in advance via the MyGate app",
      "Dedicated gym shoes required — no outdoor footwear inside courts or gym",
      "No food or coloured drinks (cola, coffee, etc.) inside any facility",
      "Children under 18 must be accompanied by an adult in the gym",
      "Trainers/coaches allowed Mon–Thu only in Football & Basketball; not permitted for Badminton, Squash, Cricket, Tennis",
    ],
  },
  {
    icon: Trophy,
    title: "Outdoor Sports",
    color: "text-orange-600",
    bg: "bg-orange-50 border-orange-100",
    items: [
      { name: "Football Arena", timing: "Bookable via MyGate", note: "Training: Mon–Thu only" },
      { name: "Basketball Court", timing: "Bookable via MyGate", note: "Training: Mon–Thu only" },
      { name: "Cricket Pitch", timing: "Bookable via MyGate", note: "No coaches/trainers" },
      { name: "Tennis Court", timing: "Bookable via MyGate", note: "No coaches/trainers" },
      { name: "Skating Rink", timing: "Open access", note: "No skating near pool or inside clubhouse" },
    ],
    rules: [
      "Book courts via MyGate — deposit Clubhouse ID card with security to collect keys",
      "The resident who booked is responsible for locking up and returning keys",
      "No food or coloured drinks on or around courts",
      "Littering attracts a cleaning charge of ₹2,000",
    ],
  },
  {
    icon: Music,
    title: "Amphitheatre & Events",
    color: "text-rose-600",
    bg: "bg-rose-50 border-rose-100",
    items: [
      { name: "Amphitheatre", timing: "8:00 AM – 10:00 PM (New Year: up to 12:30 AM with EC approval)", note: "Silent hours: 2 PM – 4 PM" },
      { name: "Banquet Hall (The Opera Clubhouse)", timing: "As per clubhouse guidelines", note: "For personal events only" },
    ],
    rules: [
      "Community events open to all residents can be held in the Amphitheatre or Banquet Hall",
      "Book at least 15 days in advance (30 days if stalls are involved) — email the helpdesk + EC",
      "Electricity charge: ₹200/hour + GST",
      "No cooking heaters, halogen lights, or high-power equipment without prior PM approval",
      "Organizer responsible for cleanup — failure to clean by 6 PM (morning event) or 9 AM next day attracts ₹5,000 fine",
      "No loud music that disturbs nearby towers; police permission required for loudspeakers from gate to clubhouse",
      "Smoking, alcohol, and intoxicants are prohibited in all common areas",
    ],
  },
  {
    icon: Trees,
    title: "Other Amenities",
    color: "text-green-600",
    bg: "bg-green-50 border-green-100",
    items: [
      { name: "Library", timing: "As per clubhouse hours", note: "" },
      { name: "Crèche", timing: "As per schedule", note: "" },
      { name: "Mini Theatre / Movie Theatre", timing: "As per clubhouse hours", note: "" },
      { name: "Kids' Play Area", timing: "Open access", note: "Only children under 12 years" },
      { name: "Convenience Store", timing: "As per store hours", note: "" },
      { name: "EV Charging Stations", timing: "As per availability", note: "Contact helpdesk to register" },
    ],
    rules: [
      "All clubhouse facilities are exclusively for residents — Clubhouse ID card required",
      "No commercial use of any facility",
    ],
  },
];

const DAILY_RULES = [
  {
    icon: Car,
    title: "Vehicles & Parking",
    color: "text-blue-600",
    bg: "bg-blue-50",
    points: [
      "Speed limit: 15 km/h on podium and in basements",
      "Drive clockwise only on podium roads",
      "PSOTS is a honk-free community",
      "Park only in your allocated basement slot",
      "Guest parking free for up to 2 days; ₹250/day (4W) or ₹100/day (2W) thereafter",
      "Visitor rental parking: ₹1,500/month (individual) or ₹2,500/month (linked) — email helpdesk to apply",
    ],
  },
  {
    icon: Trash2,
    title: "Waste & Garbage",
    color: "text-green-600",
    bg: "bg-green-50",
    points: [
      "Segregate into Wet (green bin), Dry (blue bin), Sanitary/Reject (red bin)",
      "Keep bins outside your flat between 9:00 AM – 12:00 PM only",
      "If leaving early: bags allowed from 6:00 AM onwards in CPCB-certified compostable bags",
      "Take back empty bins by 12:30 PM",
      "Keeping garbage outside beyond allowed timings: ₹500 fine",
      "Interior work debris: contact helpdesk separately — do not leave in basements",
    ],
  },
  {
    icon: Users,
    title: "Common Areas & Conduct",
    color: "text-slate-600",
    bg: "bg-slate-50",
    points: [
      "No garments, rugs, or antennae on balcony grills or building facades",
      "No encroachment of corridors — no shoe racks, plants, bicycles, cartons outside flats",
      "Children's play areas: for children under 12 only; no cycling, skating near pool or inside clubhouse",
      "Walking on lawns strictly prohibited (except unavoidable circumstances)",
      "Political events are prohibited inside PSOTS",
      "No commercial activities from residential apartments without prior written permission from EC",
    ],
  },
];

const PENALTIES = [
  { violation: "Common area noise / littering / improper trash", fine: "₹1,000" },
  { violation: "Common area encroachment (not cleared)", fine: "₹5,000 + removal cost" },
  { violation: "Speeding (over 15 km/h)", fine: "₹500" },
  { violation: "Wrong direction driving (one-way violation)", fine: "₹1,500 (2W) / ₹3,000 (4W)" },
  { violation: "Unauthorized parking (per day, up to 5 days)", fine: "₹1,000 (4W) / ₹500 (2W)" },
  { violation: "Guest parking beyond 2 days (per day)", fine: "₹250 (4W) / ₹100 (2W)" },
  { violation: "Parking in emergency / disabled-only spots", fine: "₹1,000" },
  { violation: "Garbage kept outside flat beyond allowed timing", fine: "₹500" },
  { violation: "Littering in outdoor sports facilities", fine: "₹2,000 cleaning charge" },
  { violation: "Amphitheatre not cleaned after event", fine: "₹5,000 cleaning charge" },
  { violation: "Pet waste not cleaned in common areas", fine: "₹1,000" },
  { violation: "Interior work debris removal (mandatory)", fine: "₹3,000" },
  { violation: "Move-in / Move-out charge (tenant)", fine: "₹1,500 + GST each way" },
  { violation: "Loss of parking sticker / RFID", fine: "₹500 replacement" },
  { violation: "Driving lesson inside society", fine: "₹2,000 (1st instance); reported to authorities on repeat" },
];

// ─── COMPONENTS ─────────────────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="h-px w-8 bg-accent" />
      <span className="text-accent text-xs font-semibold uppercase tracking-[0.18em]">{text}</span>
    </div>
  );
}

function Accordion({ title, icon: Icon, color, bg, children }: {
  title: string; icon: any; color: string; bg: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
      <button
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-secondary/30 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border shrink-0", bg)}>
          <Icon className={cn("w-5 h-5", color)} />
        </div>
        <span className="font-display text-xl font-semibold text-foreground flex-1">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-6 border-t border-border/50">{children}</div>}
    </div>
  );
}

// ─── PAGE ────────────────────────────────────────────────────────────────────

export function CommunityGuide() {
  return (
    <div className="max-w-4xl mx-auto px-5 sm:px-8 py-14 pb-28">

      {/* Header */}
      <div className="mb-14">
        <SectionLabel text="Resident Handbook" />
        <h1 className="font-display text-5xl font-semibold text-foreground">Community Guide</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-base leading-relaxed">
          Everything residents need to know — official channels, amenity timings, daily rules, and penalties. Sourced directly from the PSOTS Rules of Residency (v2.0, October 2025).
        </p>
      </div>

      {/* ── 1. Official Channels ──────────────────────────────────────────── */}
      <section className="mb-16">
        <SectionLabel text="Official Channels" />
        <h2 className="font-display text-3xl font-semibold text-foreground mb-6">How to reach PSOTSAOA</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {OFFICIAL_CHANNELS.map((ch, i) => (
            <motion.div
              key={ch.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-white rounded-2xl border border-border p-5"
            >
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{ch.label}</div>
              {ch.type === "email" ? (
                <a
                  href={`mailto:${ch.value}`}
                  className={cn("inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg border", ch.color)}
                >
                  <Mail className="w-3.5 h-3.5" /> {ch.value}
                </a>
              ) : (
                <a
                  href={`tel:${ch.value.replace(/\s/g, "")}`}
                  className={cn("inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg border", ch.color)}
                >
                  <Phone className="w-3.5 h-3.5" /> {ch.value}
                </a>
              )}
              <p className="text-xs text-muted-foreground mt-2">{ch.note}</p>
            </motion.div>
          ))}
        </div>

        {/* Escalation path */}
        <div className="bg-foreground rounded-2xl p-6 text-white">
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle className="w-4 h-4 text-accent" />
            <span className="font-semibold text-sm text-white/80">Escalation Path — follow in order</span>
          </div>
          <div className="space-y-3">
            {ESCALATION.map((e, i) => (
              <div key={e.level} className="flex gap-4 items-start">
                <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center shrink-0 text-accent font-bold text-xs">
                  {e.level}
                </div>
                <div>
                  <div className="font-semibold text-white text-sm">{e.title}</div>
                  <div className="text-white/55 text-xs mt-0.5">{e.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 2. Daily Rules ───────────────────────────────────────────────── */}
      <section className="mb-16">
        <SectionLabel text="Daily Living" />
        <h2 className="font-display text-3xl font-semibold text-foreground mb-6">Key Rules at a Glance</h2>
        <div className="space-y-5">
          {DAILY_RULES.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.title} className={cn("rounded-2xl p-6", group.bg, "border border-border")}>
                <div className="flex items-center gap-3 mb-4">
                  <Icon className={cn("w-5 h-5", group.color)} />
                  <h3 className="font-display text-xl font-semibold text-foreground">{group.title}</h3>
                </div>
                <ul className="space-y-2">
                  {group.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2.5 text-sm text-foreground/80">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current shrink-0 opacity-40" />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 3. Amenities & Timings ───────────────────────────────────────── */}
      <section className="mb-16">
        <SectionLabel text="The Opera Clubhouse & Facilities" />
        <h2 className="font-display text-3xl font-semibold text-foreground mb-2">Amenities & Timings</h2>
        <p className="text-muted-foreground text-sm mb-6">All courts and rooms must be booked in advance via the MyGate app unless stated otherwise.</p>
        <div className="space-y-3">
          {AMENITY_GROUPS.map((group) => (
            <Accordion key={group.title} title={group.title} icon={group.icon} color={group.color} bg={group.bg}>
              {/* Amenity list */}
              <div className="mt-5 space-y-2 mb-5">
                {group.items.map((item) => (
                  <div key={item.name} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-2.5 border-b border-border/40 last:border-0">
                    <span className="font-medium text-sm text-foreground flex-1">{item.name}</span>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" /> {item.timing}
                    </div>
                    {item.note && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md whitespace-nowrap">
                        {item.note}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {/* Rules */}
              <div className="bg-secondary/50 rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Key Rules</div>
                <ul className="space-y-1.5">
                  {group.rules.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-xs text-foreground/75">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-foreground/30 shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </Accordion>
          ))}
        </div>
      </section>

      {/* ── 4. Penalties ─────────────────────────────────────────────────── */}
      <section className="mb-16">
        <SectionLabel text="Penalties & Charges" />
        <h2 className="font-display text-3xl font-semibold text-foreground mb-2">Quick Reference</h2>
        <p className="text-muted-foreground text-sm mb-6">
          Fines are levied per instance unless stated otherwise. Non-payment may result in suspension of facility access. Paid via MyGate app — no cash accepted.
        </p>
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="grid grid-cols-[1fr_auto] text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-5 py-3 border-b border-border bg-secondary/30">
            <span>Violation</span>
            <span className="text-right">Fine / Charge</span>
          </div>
          {PENALTIES.map((p, i) => (
            <div
              key={p.violation}
              className={cn(
                "grid grid-cols-[1fr_auto] items-center px-5 py-3.5 gap-4 border-b border-border/50 last:border-0 text-sm",
                i % 2 === 0 ? "bg-white" : "bg-secondary/20"
              )}
            >
              <span className="text-foreground/80">{p.violation}</span>
              <span className="font-display font-semibold text-right text-foreground whitespace-nowrap">{p.fine}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3 px-1">
          Repeated violations may be escalated to authorities. The Association reserves the right to revise penalties. Source: PSOTS Rules of Residency v2.0 & Penalties Schedule.
        </p>
      </section>

      {/* ── 5. Document reference ─────────────────────────────────────────── */}
      <div className="rounded-2xl bg-primary/5 border border-primary/15 p-6 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground mb-1">Full Documents</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This guide summarises the key points from the PSOTS Rules of Residency (v2.0, October 2025), Penalties Schedule, and Declaration of Duties (DOD). For the complete legal text, contact the EC at{" "}
            <a href="mailto:ec@psots.in" className="text-primary font-medium hover:underline">ec@psots.in</a>{" "}
            or request a soft copy via the Property Management Helpdesk on MyGate.
          </p>
        </div>
      </div>
    </div>
  );
}
