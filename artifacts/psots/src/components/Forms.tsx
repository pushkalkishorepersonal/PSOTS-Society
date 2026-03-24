import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useCreateNotice, 
  useCreateEvent, 
  useCreateListing,
  getListNoticesQueryKey,
  getListEventsQueryKey,
  getListListingsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X, Loader2, Info, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const TOWERS = ["All", ...[1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 14, 15, 16, 17].map(n => `Tower ${n}`)];
const NOTICE_CATEGORIES = ["Maintenance", "Security", "Events", "General", "Water/Power"];
const LISTING_CATEGORIES = ["Furniture", "Electronics", "Kids", "Vehicles", "Services", "Other"];

function Modal({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-md rounded-3xl shadow-2xl border overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-card z-10">
          <h2 className="text-xl font-display font-bold">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-destructive text-xs mt-1 px-1">{message}</p>;
}

function FlatNumberField({ register, error }: { register: any, error?: string }) {
  return (
    <div>
      <input
        {...register("flatNumber")}
        placeholder="Flat Number (e.g. 1203)"
        className="w-full px-4 py-3 bg-secondary/50 rounded-xl outline-none transition-all focus:bg-card"
      />
      <FieldError message={error} />
      <p className="text-[11px] text-muted-foreground mt-1 px-1 flex items-center gap-1">
        <Info className="w-3 h-3 shrink-0" /> Used for resident verification only, not displayed publicly.
      </p>
    </div>
  );
}

// ==========================================
// NOTICE FORM
// ==========================================
const noticeSchema = z.object({
  title: z.string().min(3, "Title required"),
  content: z.string().min(5, "Content required"),
  category: z.string().min(1, "Select category"),
  tower: z.string().min(1, "Select tower"),
  isPinned: z.boolean().default(false),
  postedBy: z.string().min(2, "Name required"),
  flatNumber: z.string().min(1, "Flat number required for verification"),
  communityPin: z.string().min(1, "Community access code required"),
});

export function CreateNoticeModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const createMutation = useCreateNotice();
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(noticeSchema),
    defaultValues: { isPinned: false, tower: "All", category: "General" }
  });

  const onSubmit = (data: any) => {
    setServerError(null);
    createMutation.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNoticesQueryKey() });
        setIsOpen(false);
        reset();
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error;
        setServerError(typeof msg === "string" ? msg : "Something went wrong. Please try again.");
      }
    });
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-full font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
        <Plus className="w-4 h-4" /> Post Notice
      </button>

      <Modal isOpen={isOpen} onClose={() => { setIsOpen(false); setServerError(null); }} title="Post a Notice">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <input {...register("title")} placeholder="Notice Title" className="w-full px-4 py-3 bg-secondary/50 rounded-xl outline-none transition-all focus:bg-card" />
            <FieldError message={errors.title?.message as string} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <select {...register("category")} className="w-full px-4 py-3 bg-secondary/50 rounded-xl outline-none">
              {NOTICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select {...register("tower")} className="w-full px-4 py-3 bg-secondary/50 rounded-xl outline-none">
              {TOWERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <textarea {...register("content")} placeholder="Detailed message..." rows={4} className="w-full px-4 py-3 bg-secondary/50 rounded-xl outline-none resize-none transition-all focus:bg-card" />
            <FieldError message={errors.content?.message as string} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <input {...register("postedBy")} placeholder="Your Name / Committee" className="w-full px-4 py-3 bg-secondary/50 rounded-xl outline-none transition-all focus:bg-card" />
              <FieldError message={errors.postedBy?.message as string} />
            </div>
            <div>
              <input {...register("flatNumber")} placeholder="Flat No. (e.g. 1203)" className="w-full px-4 py-3 bg-secondary/50 rounded-xl outline-none transition-all focus:bg-card" />
              <FieldError message={errors.flatNumber?.message as string} />
            </div>
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-800">Community Access Code</span>
            </div>
            <input
              {...register("communityPin")}
              type="password"
              placeholder="Enter the code shared by Society Office"
              className="w-full px-4 py-3 bg-white rounded-xl border border-amber-200 outline-none focus:border-amber-400 transition-all text-sm"
            />
            <FieldError message={errors.communityPin?.message as string} />
            <p className="text-[11px] text-amber-700 mt-1.5">
              The access code prevents misuse. Ask your Society Office or Admin for it.
            </p>
          </div>

          <label className="flex items-center gap-3 p-3 bg-secondary/30 rounded-xl cursor-pointer">
            <input type="checkbox" {...register("isPinned")} className="w-5 h-5 rounded text-primary focus:ring-primary accent-primary" />
            <span className="text-sm font-medium">Pin to top of board</span>
          </label>

          {serverError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <button type="submit" disabled={createMutation.isPending} className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors flex justify-center items-center gap-2 mt-2">
            {createMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Post Notice"}
          </button>
        </form>
      </Modal>
    </>
  );
}

// ==========================================
// EVENT FORM
// ==========================================
const eventSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(5),
  location: z.string().min(3),
  eventDate: z.string().min(1),
  organizer: z.string().min(2),
  flatNumber: z.string().min(1, "Flat number required for verification"),
});

export function CreateEventModal() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const createMutation = useCreateEvent();
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(eventSchema) });

  const onSubmit = (data: any) => {
    const { flatNumber: _fn, ...rest } = data;
    const payload = { ...rest, eventDate: new Date(rest.eventDate).toISOString() };
    createMutation.mutate({ data: payload }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
        setIsOpen(false);
        reset();
      }
    });
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-accent text-accent-foreground rounded-full font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
        <Plus className="w-4 h-4" /> Create Event
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Create Event">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <input {...register("title")} placeholder="Event Name" className="w-full px-4 py-3 bg-secondary/50 rounded-xl outline-none" />
            <FieldError message={errors.title?.message as string} />
          </div>
          <input type="datetime-local" {...register("eventDate")} className="w-full px-4 py-3 bg-secondary/50 rounded-xl outline-none" />
          <input {...register("location")} placeholder="Venue / Location" className="w-full px-4 py-3 bg-secondary/50 rounded-xl outline-none" />
          <textarea {...register("description")} placeholder="Event Details..." rows={3} className="w-full px-4 py-3 bg-secondary/50 rounded-xl outline-none resize-none" />
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <input {...register("organizer")} placeholder="Organizer Name" className="w-full px-4 py-3 bg-secondary/50 rounded-xl outline-none" />
              <FieldError message={errors.organizer?.message as string} />
            </div>
            <div>
              <input {...register("flatNumber")} placeholder="Flat No. (e.g. 1203)" className="w-full px-4 py-3 bg-secondary/50 rounded-xl outline-none" />
              <FieldError message={errors.flatNumber?.message as string} />
            </div>
          </div>

          <button type="submit" disabled={createMutation.isPending} className="w-full py-3.5 bg-accent text-accent-foreground rounded-xl font-bold hover:bg-accent/90 transition-colors flex justify-center items-center">
            {createMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Event"}
          </button>
        </form>
      </Modal>
    </>
  );
}

// ==========================================
// LISTING FORM
// ==========================================
const listingSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(5),
  price: z.coerce.number().optional().nullable(),
  type: z.enum(["sell", "buy", "rent", "free"]),
  category: z.string().min(1),
  tower: z.string().min(1),
  contactName: z.string().min(2),
  contactPhone: z.string().optional(),
  flatNumber: z.string().min(1, "Flat number required for resident verification"),
});

export function CreateListingModal() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const createMutation = useCreateListing();
  
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({
    resolver: zodResolver(listingSchema),
    defaultValues: { type: "sell", category: "Furniture", tower: "Tower 1" }
  });

  const isFree = watch("type") === "free" || watch("type") === "buy";

  const onSubmit = (data: any) => {
    if (isFree) data.price = null;
    createMutation.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListListingsQueryKey() });
        setIsOpen(false);
        reset();
      }
    });
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-full font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
        <Plus className="w-4 h-4" /> Post Ad
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Post Marketplace Ad">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 p-1 bg-secondary/50 rounded-xl">
            {["sell", "rent", "buy", "free"].map(t => (
              <label key={t} className={cn(
                "text-center py-2 rounded-lg cursor-pointer text-sm font-bold capitalize transition-all",
                watch("type") === t ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
              )}>
                <input type="radio" value={t} {...register("type")} className="hidden" />
                {t}
              </label>
            ))}
          </div>

          <div>
            <input {...register("title")} placeholder="What are you posting?" className="w-full px-4 py-3 bg-secondary/50 rounded-xl outline-none" />
            <FieldError message={errors.title?.message as string} />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <select {...register("category")} className="w-full px-4 py-3 bg-secondary/50 rounded-xl outline-none">
              {LISTING_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {!isFree && (
              <input type="number" {...register("price")} placeholder="Price (₹)" className="w-full px-4 py-3 bg-secondary/50 rounded-xl outline-none" />
            )}
          </div>

          <textarea {...register("description")} placeholder="Describe the item or service..." rows={3} className="w-full px-4 py-3 bg-secondary/50 rounded-xl outline-none resize-none" />
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <input {...register("contactName")} placeholder="Your Name" className="w-full px-4 py-3 bg-secondary/50 rounded-xl outline-none" />
              <FieldError message={errors.contactName?.message as string} />
            </div>
            <select {...register("tower")} className="w-full px-4 py-3 bg-secondary/50 rounded-xl outline-none">
              {TOWERS.filter(t => t !== "All").map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <input {...register("contactPhone")} placeholder="Phone (optional)" className="w-full px-4 py-3 bg-secondary/50 rounded-xl outline-none" />
            <div>
              <input {...register("flatNumber")} placeholder="Flat No. (e.g. 1203)" className="w-full px-4 py-3 bg-secondary/50 rounded-xl outline-none" />
              <FieldError message={errors.flatNumber?.message as string} />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground flex items-center gap-1 px-1">
            <Info className="w-3 h-3 shrink-0" /> Flat number is for resident verification only, not shown publicly.
          </p>

          <button type="submit" disabled={createMutation.isPending} className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors flex justify-center items-center">
            {createMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Post Listing"}
          </button>
        </form>
      </Modal>
    </>
  );
}
