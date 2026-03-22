import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Pin, Archive, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useListNotices } from "@workspace/api-client-react";
import { CreateNoticeModal } from "@/components/Forms";
import { cn } from "@/lib/utils";

const TOWERS = ["All", ...[1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 14, 15, 16, 17].map(n => `Tower ${n}`)];
const CATEGORIES = ["All", "Maintenance", "Security", "Events", "General", "Water/Power"];

export function NoticeBoard() {
  const [activeTower, setActiveTower] = useState("All");
  const [activeCategory, setActiveCategory] = useState("All");
  const [showArchive, setShowArchive] = useState(false);

  const { data: allNotices, isLoading } = useListNotices({
    tower: activeTower !== "All" ? activeTower : undefined,
    category: activeCategory !== "All" ? activeCategory : undefined,
  });

  const activeNotices = allNotices?.filter(n => !n.archivedAt) || [];
  const archivedNotices = allNotices?.filter(n => !!n.archivedAt) || [];
  const pinnedNotices = activeNotices.filter(n => n.isPinned);
  const regularNotices = activeNotices.filter(n => !n.isPinned);

  return (
    <div className="max-w-4xl mx-auto px-5 sm:px-8 py-14">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px w-8 bg-accent" />
            <span className="text-accent text-xs font-semibold uppercase tracking-[0.18em]">Community</span>
          </div>
          <h1 className="font-display text-5xl font-semibold text-foreground">Notice Board</h1>
          <p className="text-muted-foreground mt-2">Official updates and announcements.</p>
        </div>
        <CreateNoticeModal />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-border p-4 mb-10 flex flex-wrap gap-4">
        <div className="flex items-center gap-2 text-muted-foreground shrink-0 pl-1">
          <SlidersHorizontal className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Filter</span>
        </div>
        <div className="flex-1 min-w-[160px]">
          <select
            value={activeTower}
            onChange={(e) => setActiveTower(e.target.value)}
            className="w-full bg-secondary/60 border-0 rounded-xl px-4 py-2.5 text-sm font-medium outline-none cursor-pointer transition-colors hover:bg-secondary focus:bg-secondary"
          >
            {TOWERS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <select
            value={activeCategory}
            onChange={(e) => setActiveCategory(e.target.value)}
            className="w-full bg-secondary/60 border-0 rounded-xl px-4 py-2.5 text-sm font-medium outline-none cursor-pointer transition-colors hover:bg-secondary focus:bg-secondary"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-44 bg-secondary/40 rounded-2xl animate-pulse" />)}
        </div>
      ) : activeNotices.length === 0 ? (
        <div className="text-center py-24 bg-white border border-dashed border-border rounded-2xl">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="font-display text-xl font-semibold mb-1">No active notices</h3>
          <p className="text-muted-foreground text-sm">Try adjusting your filters or post a new notice.</p>
        </div>
      ) : (
        <div className="space-y-4 mb-14">
          {pinnedNotices.map(n => <NoticeCard key={n.id} notice={n} isPinned />)}
          {regularNotices.map(n => <NoticeCard key={n.id} notice={n} />)}
        </div>
      )}

      {/* Archive */}
      {archivedNotices.length > 0 && (
        <div className="mt-14 pt-10 border-t border-dashed border-border">
          <button
            onClick={() => setShowArchive(!showArchive)}
            className="flex items-center gap-2.5 text-muted-foreground hover:text-foreground font-medium text-sm transition-colors mx-auto"
          >
            <Archive className="w-4 h-4" />
            Archived Notices ({archivedNotices.length})
            <ChevronDown className={cn("w-4 h-4 transition-transform", showArchive && "rotate-180")} />
          </button>
          <AnimatePresence>
            {showArchive && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 pt-8 pb-4">
                  {archivedNotices.map(n => <NoticeCard key={n.id} notice={n} isArchived />)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function NoticeCard({ notice, isPinned = false, isArchived = false }: { notice: any; isPinned?: boolean; isArchived?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative rounded-2xl border transition-all",
        isPinned
          ? "bg-white border-primary/25 shadow-md shadow-primary/5"
          : isArchived
            ? "bg-secondary/30 border-transparent opacity-70"
            : "bg-white border-border hover:border-border hover:shadow-md"
      )}
    >
      {isPinned && (
        <div className="absolute -top-px left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent rounded-t-2xl" />
      )}
      <div className="p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {isPinned && (
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-lg">
              <Pin className="w-3 h-3 fill-current" /> Pinned
            </span>
          )}
          <span className={cn(
            "text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-lg border",
            isArchived
              ? "bg-secondary text-muted-foreground border-border"
              : "bg-primary/8 text-primary border-primary/15"
          )}>
            {notice.category}
          </span>
          <span className="text-xs font-medium text-muted-foreground">{notice.tower}</span>
          <span className="ml-auto text-xs text-muted-foreground">{format(new Date(notice.createdAt), "MMM d, yyyy")}</span>
        </div>

        <h3 className={cn("font-display text-2xl font-semibold mb-3 leading-snug", isArchived ? "text-muted-foreground" : "text-foreground")}>
          {notice.title}
        </h3>
        <p className={cn("text-sm leading-relaxed whitespace-pre-line mb-5", isArchived ? "text-muted-foreground/70" : "text-muted-foreground")}>
          {notice.content}
        </p>

        <div className="flex items-center gap-2.5 pt-4 border-t border-border/60">
          <div className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold",
            isArchived ? "bg-secondary text-muted-foreground" : "bg-primary/10 text-primary"
          )}>
            {notice.postedBy.charAt(0)}
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            {notice.postedBy}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
