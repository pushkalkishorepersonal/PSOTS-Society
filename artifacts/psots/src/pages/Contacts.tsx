import { Phone, Search, Shield, Wrench, Zap, HeartPulse, ShieldAlert, Building, Mail, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { Link } from "wouter";
import { useListContacts } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const OFFICIAL_CONTACTS = [
  {
    label: "Property Management Helpdesk",
    value: "+91 63665 61152",
    alt: "+91 804140 4804",
    email: "sots.helpdesk@prestigeconstructions.co.in",
    note: "Raise tickets first via MyGate app",
    type: "phone",
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-200",
    icon: Building,
  },
  {
    label: "Executive Committee",
    value: "ec@psots.in",
    alt: null,
    email: null,
    note: "Governance, escalations, event approvals",
    type: "email",
    color: "text-primary",
    bg: "bg-primary/8 border-primary/20",
    icon: Building,
  },
  {
    label: "Finance / Accounting",
    value: "finance@psots.in",
    alt: null,
    email: null,
    note: "CAM dues, maintenance charges, payment queries",
    type: "email",
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
    icon: Building,
  },
];

const ROLE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  "Security":    { icon: Shield,      color: "text-blue-600",   bg: "bg-blue-50 border-blue-100" },
  "Maintenance": { icon: Wrench,      color: "text-amber-600",  bg: "bg-amber-50 border-amber-100" },
  "Electrical":  { icon: Zap,        color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-100" },
  "Plumbing":    { icon: Wrench,     color: "text-cyan-600",   bg: "bg-cyan-50 border-cyan-100" },
  "Medical":     { icon: HeartPulse, color: "text-red-600",    bg: "bg-red-50 border-red-100" },
  "Safety":      { icon: ShieldAlert,color: "text-orange-600", bg: "bg-orange-50 border-orange-100" },
  "Police":      { icon: ShieldAlert,color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-100" },
  "Administration": { icon: Building,color: "text-slate-600",  bg: "bg-slate-50 border-slate-100" },
};

export function Contacts() {
  const { data: contacts, isLoading } = useListContacts();
  const [search, setSearch] = useState("");

  const filtered = contacts?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.role.toLowerCase().includes(search.toLowerCase())
  ) || [];

  // Group by role
  const grouped = filtered.reduce((acc: Record<string, any[]>, c) => {
    acc[c.role] = acc[c.role] || [];
    acc[c.role].push(c);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto px-5 sm:px-8 py-14">
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-px w-8 bg-accent" />
          <span className="text-accent text-xs font-semibold uppercase tracking-[0.18em]">Directory</span>
        </div>
        <h1 className="font-display text-5xl font-semibold text-foreground">Emergency Contacts</h1>
        <p className="text-muted-foreground mt-2 max-w-xl">Quick access to important numbers for security, maintenance, and emergency services.</p>
      </div>

      {/* Official PSOTS Channels */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px w-8 bg-accent" />
          <span className="text-accent text-xs font-semibold uppercase tracking-[0.18em]">Official Channels</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {OFFICIAL_CONTACTS.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={cn("rounded-2xl border p-4", c.bg)}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{c.label}</div>
              {c.type === "phone" ? (
                <>
                  <a href={`tel:${c.value.replace(/\s/g, "")}`} className={cn("flex items-center gap-1.5 font-semibold text-sm mb-0.5", c.color)}>
                    <Phone className="w-3.5 h-3.5" /> {c.value}
                  </a>
                  <div className={cn("text-xs", c.color, "opacity-70")}>{c.alt}</div>
                  <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5 hover:text-foreground transition-colors">
                    <Mail className="w-3 h-3" /> {c.email}
                  </a>
                </>
              ) : (
                <a href={`mailto:${c.value}`} className={cn("flex items-center gap-1.5 font-semibold text-sm", c.color)}>
                  <Mail className="w-3.5 h-3.5" /> {c.value}
                </a>
              )}
              <p className="text-[11px] text-muted-foreground mt-2">{c.note}</p>
            </motion.div>
          ))}
        </div>
        <Link href="/guide" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
          <ExternalLink className="w-3 h-3" /> View escalation path & full community guide
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-12">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search contacts..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white border border-border rounded-xl py-3 pl-11 pr-5 text-sm font-medium outline-none focus:border-primary shadow-sm transition-colors placeholder:text-muted-foreground/60"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-28 bg-secondary/40 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Phone className="w-10 h-10 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="font-display text-xl font-semibold">No contacts found</h3>
          <p className="text-muted-foreground text-sm mt-1">Try a different search term.</p>
        </div>
      ) : search ? (
        // Flat list when searching
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((contact, i) => <ContactCard key={contact.id} contact={contact} index={i} />)}
        </div>
      ) : (
        // Grouped by role when not searching
        <div className="space-y-10">
          {Object.entries(grouped).map(([role, items]) => {
            const config = ROLE_CONFIG[role] || { icon: Phone, color: "text-slate-600", bg: "bg-slate-50 border-slate-100" };
            const Icon = config.icon;
            return (
              <div key={role}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border", config.bg)}>
                    <Icon className={cn("w-4 h-4", config.color)} />
                  </div>
                  <h2 className="font-display text-xl font-semibold text-foreground">{role}</h2>
                  <div className="flex-1 h-px bg-border ml-2" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {items.map((contact, i) => <ContactCard key={contact.id} contact={contact} index={i} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Emergency banner */}
      <div className="mt-16 rounded-2xl bg-red-50 border border-red-100 p-6 flex items-center gap-5">
        <div className="w-12 h-12 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center shrink-0">
          <HeartPulse className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold text-red-800 mb-1">Medical Emergency</h3>
          <p className="text-red-700/80 text-sm">
            For life-threatening emergencies, call <strong>112</strong> (National Emergency) immediately.
          </p>
        </div>
      </div>
    </div>
  );
}

function ContactCard({ contact, index }: { contact: any; index: number }) {
  const config = ROLE_CONFIG[contact.role] || { icon: Phone, color: "text-slate-600", bg: "bg-slate-50 border-slate-100" };
  const Icon = config.icon;

  return (
    <motion.a
      href={`tel:${contact.phone}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-white rounded-2xl p-5 border border-border hover:shadow-lg hover:border-primary/20 transition-all flex items-center gap-4 group"
    >
      <div className={cn("w-12 h-12 shrink-0 rounded-xl flex items-center justify-center border transition-all group-hover:scale-105", config.bg)}>
        <Icon className={cn("w-5 h-5", config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-foreground text-sm leading-tight mb-0.5 group-hover:text-primary transition-colors">{contact.name}</h3>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{contact.role}</div>
        <div className="flex items-center justify-between gap-2">
          <span className="font-display font-semibold text-lg text-foreground">{contact.phone}</span>
          <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-50 border border-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md shrink-0">
            {contact.available}
          </span>
        </div>
      </div>
    </motion.a>
  );
}
