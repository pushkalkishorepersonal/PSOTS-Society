import { useState } from "react";
import { Store, IndianRupee, MapPin, Check, XCircle, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useListListings, useUpdateListing, getListListingsQueryKey } from "@workspace/api-client-react";
import { CreateListingModal } from "@/components/Forms";
import { useQueryClient } from "@tanstack/react-query";
import { differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

const CATEGORIES = ["All", "Furniture", "Electronics", "Kids", "Vehicles", "Services", "Other"];
const TYPES = [
  { label: "All", val: "all" },
  { label: "For Sale", val: "sell" },
  { label: "Wanted", val: "buy" },
  { label: "For Rent", val: "rent" },
  { label: "Free", val: "free" },
];

const TYPE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  sell:  { bg: "bg-blue-50",    text: "text-blue-700",   border: "border-blue-100" },
  buy:   { bg: "bg-violet-50",  text: "text-violet-700", border: "border-violet-100" },
  rent:  { bg: "bg-orange-50",  text: "text-orange-700", border: "border-orange-100" },
  free:  { bg: "bg-emerald-50", text: "text-emerald-700",border: "border-emerald-100" },
};

export function Marketplace() {
  const [category, setCategory] = useState("All");
  const [type, setType] = useState("all");
  const [showArchived, setShowArchived] = useState(false);

  const { data: allListings, isLoading } = useListListings({
    category: category !== "All" ? category : undefined,
    type: type !== "all" ? (type as any) : undefined,
  });

  const active = allListings?.filter(l => l.status === "active") || [];
  const archived = allListings?.filter(l => l.status !== "active") || [];

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 py-14">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px w-8 bg-accent" />
            <span className="text-accent text-xs font-semibold uppercase tracking-[0.18em]">Community</span>
          </div>
          <h1 className="font-display text-5xl font-semibold text-foreground">Marketplace</h1>
          <p className="text-muted-foreground mt-2">Self-managed community classifieds.</p>
        </div>
        <CreateListingModal />
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3 mb-10">
        <div className="flex gap-1.5 flex-wrap">
          {TYPES.map(t => (
            <button
              key={t.val}
              onClick={() => setType(t.val)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                type === t.val
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-white text-muted-foreground border border-border hover:text-foreground hover:border-border/80"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="lg:ml-auto">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-white border border-border rounded-xl px-4 py-2 text-sm font-medium outline-none cursor-pointer w-full lg:w-auto"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c === "All" ? "All Categories" : c}</option>)}
          </select>
        </div>
      </div>

      {/* Listings Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-72 bg-secondary/40 rounded-2xl animate-pulse" />)}
        </div>
      ) : active.length === 0 ? (
        <div className="text-center py-24 bg-white border border-dashed border-border rounded-2xl">
          <Store className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="font-display text-xl font-semibold mb-1">No active listings</h3>
          <p className="text-muted-foreground text-sm">Be the first to post something.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-14">
          {active.map((item, i) => <ListingCard key={item.id} item={item} index={i} />)}
        </div>
      )}

      {/* Archived Section */}
      {archived.length > 0 && (
        <div className="mt-14 pt-10 border-t border-dashed border-border">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2.5 text-muted-foreground hover:text-foreground font-medium text-sm transition-colors"
          >
            Closed & Expired
            <span className="bg-secondary text-muted-foreground text-xs font-semibold px-2.5 py-0.5 rounded-full">{archived.length}</span>
            <ChevronDown className={cn("w-4 h-4 transition-transform", showArchived && "rotate-180")} />
          </button>
          <AnimatePresence>
            {showArchived && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pt-8 pb-4">
                  {archived.map((item, i) => <ListingCard key={item.id} item={item} index={i} isArchived />)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function ListingCard({ item, index, isArchived = false }: { item: any; index: number; isArchived?: boolean }) {
  const updateMutation = useUpdateListing();
  const queryClient = useQueryClient();
  const daysLeft = item.expiresAt ? differenceInDays(new Date(item.expiresAt), new Date()) : 30;
  const typeStyle = TYPE_STYLES[item.type] || { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-100" };

  const handleStatusUpdate = (status: "sold" | "closed") => {
    if (confirm(`Mark this listing as ${status}?`)) {
      updateMutation.mutate({ id: item.id, data: { status } }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListListingsQueryKey() }),
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        "rounded-2xl border flex flex-col overflow-hidden transition-all",
        isArchived
          ? "bg-secondary/20 border-transparent opacity-60"
          : "bg-white border-border hover:shadow-lg hover:border-primary/20 group"
      )}
    >
      {/* Card top */}
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex flex-wrap gap-1.5">
            <span className={cn("px-2.5 py-1 text-[10px] font-semibold rounded-lg uppercase tracking-wider border", typeStyle.bg, typeStyle.text, typeStyle.border)}>
              {item.type}
            </span>
            <span className="px-2.5 py-1 text-[10px] font-medium rounded-lg uppercase tracking-wider bg-secondary text-muted-foreground border border-border">
              {item.category}
            </span>
          </div>
          {item.status !== "active" && (
            <span className={cn(
              "shrink-0 text-[10px] font-bold rounded-lg px-2 py-1 uppercase tracking-wide",
              item.status === "sold" && "bg-blue-600 text-white",
              item.status === "closed" && "bg-slate-600 text-white",
              item.status === "expired" && "bg-red-600 text-white"
            )}>
              {item.status}
            </span>
          )}
        </div>

        <h3 className={cn("font-semibold text-base mb-1.5 leading-snug", !isArchived && "group-hover:text-primary transition-colors")}>
          {item.title}
        </h3>

        {item.price ? (
          <div className={cn("font-display text-2xl font-semibold mb-3 flex items-center gap-0.5", isArchived ? "text-muted-foreground" : "text-foreground")}>
            <IndianRupee className="w-5 h-5" />
            {Number(item.price).toLocaleString()}
          </div>
        ) : (
          <div className={cn("font-display text-xl font-semibold mb-3", isArchived ? "text-muted-foreground" : "text-emerald-600")}>
            Free
          </div>
        )}

        <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1 leading-relaxed">{item.description}</p>

        <div className="space-y-2.5 pt-4 border-t border-border/60">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> {item.tower}
            </div>
            {item.status === "active" && (
              <span className={cn("font-semibold", daysLeft < 5 ? "text-red-500" : "text-muted-foreground")}>
                {daysLeft}d left
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground truncate pr-2">{item.contactName}</span>
            {!isArchived && item.contactPhone && (
              <a href={`tel:${item.contactPhone}`} className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary/8 text-primary hover:bg-primary hover:text-white transition-colors">
                Call
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Self-management actions */}
      {!isArchived && (
        <div className="grid grid-cols-2 gap-px bg-border">
          <button
            onClick={() => handleStatusUpdate("sold")}
            disabled={updateMutation.isPending}
            className="flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-semibold uppercase tracking-wider bg-white text-muted-foreground hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            <Check className="w-3.5 h-3.5" /> Mark Sold
          </button>
          <button
            onClick={() => handleStatusUpdate("closed")}
            disabled={updateMutation.isPending}
            className="flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-semibold uppercase tracking-wider bg-white text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" /> Close Ad
          </button>
        </div>
      )}
    </motion.div>
  );
}
