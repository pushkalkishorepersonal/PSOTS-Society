import { useState } from "react";
import { format, isBefore, startOfDay } from "date-fns";
import { Calendar as CalendarIcon, MapPin, Users, CheckCircle2, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useListEvents, useRsvpEvent, getListEventsQueryKey } from "@workspace/api-client-react";
import { CreateEventModal } from "@/components/Forms";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export function Events() {
  const { data: events, isLoading } = useListEvents();
  const [showPast, setShowPast] = useState(false);

  const today = startOfDay(new Date());
  const upcoming = events?.filter(e => !isBefore(startOfDay(new Date(e.eventDate)), today))
    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()) || [];
  const past = events?.filter(e => isBefore(startOfDay(new Date(e.eventDate)), today))
    .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()) || [];

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 py-14">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px w-8 bg-accent" />
            <span className="text-accent text-xs font-semibold uppercase tracking-[0.18em]">Community</span>
          </div>
          <h1 className="font-display text-5xl font-semibold text-foreground">Events</h1>
          <p className="text-muted-foreground mt-2">Join gatherings, meetings, and celebrations.</p>
        </div>
        <CreateEventModal />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <div key={i} className="h-80 bg-secondary/40 rounded-2xl animate-pulse" />)}
        </div>
      ) : upcoming.length === 0 ? (
        <div className="text-center py-24 bg-white border border-dashed border-border rounded-2xl max-w-xl mx-auto">
          <CalendarIcon className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="font-display text-xl font-semibold mb-2">No upcoming events</h3>
          <p className="text-muted-foreground text-sm mb-6">Be the first to create one.</p>
          <CreateEventModal />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-14">
          {upcoming.map((event, i) => <EventCard key={event.id} event={event} index={i} isPast={false} />)}
        </div>
      )}

      {/* Past Events */}
      {past.length > 0 && (
        <div className="mt-14 pt-10 border-t border-border">
          <button
            onClick={() => setShowPast(!showPast)}
            className="flex items-center gap-2.5 text-muted-foreground hover:text-foreground font-medium text-sm transition-colors"
          >
            Past Events
            <span className="bg-secondary text-muted-foreground text-xs font-semibold px-2.5 py-0.5 rounded-full">{past.length}</span>
            <ChevronDown className={cn("w-4 h-4 transition-transform", showPast && "rotate-180")} />
          </button>
          <AnimatePresence>
            {showPast && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-8 pb-4">
                  {past.map((event, i) => <EventCard key={event.id} event={event} index={i} isPast />)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function EventCard({ event, index, isPast }: { event: any; index: number; isPast: boolean }) {
  const date = new Date(event.eventDate);
  const rsvpMutation = useRsvpEvent();
  const queryClient = useQueryClient();
  const [hasRsvped, setHasRsvped] = useState(false);

  const handleRsvp = () => {
    if (hasRsvped) return;
    rsvpMutation.mutate({ id: event.id }, {
      onSuccess: () => {
        setHasRsvped(true);
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
      }
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "rounded-2xl border overflow-hidden flex flex-col transition-all",
        isPast
          ? "bg-secondary/20 border-transparent opacity-70"
          : "bg-white border-border hover:shadow-xl hover:border-primary/20 group"
      )}
    >
      {/* Card Top — date banner */}
      <div className={cn(
        "flex items-center gap-4 p-5 border-b",
        isPast ? "bg-secondary/30 border-border/40" : "bg-gradient-to-r from-primary/5 to-accent/5 border-border/50"
      )}>
        <div className={cn(
          "w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 border",
          isPast ? "bg-secondary border-border text-muted-foreground" : "bg-white border-border shadow-sm text-foreground group-hover:border-accent/30 transition-colors"
        )}>
          <span className={cn("text-[9px] font-bold uppercase tracking-wide", !isPast && "text-accent")}>{format(date, "MMM")}</span>
          <span className="font-display text-2xl font-bold leading-tight">{format(date, "d")}</span>
        </div>
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">{format(date, "EEEE")}</div>
          <div className="text-sm font-semibold text-foreground">{format(date, "h:mm a")}</div>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col">
        <h3 className={cn(
          "font-display text-xl font-semibold mb-2 leading-snug",
          !isPast && "group-hover:text-primary transition-colors"
        )}>{event.title}</h3>
        <p className="text-muted-foreground text-sm line-clamp-2 mb-5 flex-1 leading-relaxed">{event.description}</p>

        <div className="space-y-2 text-xs text-muted-foreground font-medium mb-5">
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="line-clamp-1">{event.location}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span>Organised by {event.organizer}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <span className="text-sm font-medium text-muted-foreground">
            <strong className={cn("font-display text-lg", !isPast && "text-foreground")}>{event.rsvpCount}</strong> attending
          </span>
          {!isPast && (
            <button
              onClick={handleRsvp}
              disabled={hasRsvped || rsvpMutation.isPending}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2",
                hasRsvped
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow hover:-translate-y-0.5"
              )}
            >
              {hasRsvped ? <><CheckCircle2 className="w-4 h-4" /> Going</> : "I'm Coming 👋"}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
