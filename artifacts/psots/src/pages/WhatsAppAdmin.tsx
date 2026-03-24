import { useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Send, UserPlus, Trash2, Users, CheckCircle, AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListWhatsappSubscribers,
  useAddWhatsappSubscriber,
  useRemoveWhatsappSubscriber,
  useWhatsappBroadcast,
  getListWhatsappSubscribersQueryKey,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const QUICK_TEMPLATES = [
  { label: "Payment Reminder", emoji: "⏰", text: "🏢 *PSOTS Chhath Puja 2026 Update*\n\nDear Resident,\n\nThis is a reminder that the maintenance payment for this month is due. Please make the payment at your earliest convenience.\n\nThank you,\nPSOTS Management" },
  { label: "Arghya Timing", emoji: "🌅", text: "🏢 *PSOTS Arghya Timing Update*\n\nDear Resident,\n\nThe Arghya ceremony timings are as follows:\n• Morning Arghya: 6:00 AM\n• Evening Arghya: 5:30 PM\n\nPlease plan accordingly.\n\nThank you,\nPSOTS Management" },
  { label: "Prasad Update", emoji: "🙏", text: "🏢 *PSOTS Prasad Distribution Update*\n\nDear Resident,\n\nPrasad distribution will take place today at the community hall. All residents are welcome.\n\nThank you,\nPSOTS Management" },
  { label: "Thank You", emoji: "🎉", text: "🏢 *Thank You from PSOTS!*\n\nDear Resident,\n\nThank you for your participation and support. We truly appreciate being part of such a wonderful community.\n\nWarm regards,\nPSOTS Management" },
];

export function WhatsAppAdmin() {
  const queryClient = useQueryClient();

  const { data: subscribers = [], isLoading } = useListWhatsappSubscribers();
  const addMutation = useAddWhatsappSubscriber();
  const removeMutation = useRemoveWhatsappSubscriber();
  const broadcastMutation = useWhatsappBroadcast();

  const [message, setMessage] = useState("🏢 *PSOTS Chhath Puja 2026 Update*");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const optedIn = subscribers.filter((s) => s.optedIn);

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleAddSubscriber(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;
    try {
      await addMutation.mutateAsync({ data: { name: newName.trim(), phone: newPhone.trim() } });
      queryClient.invalidateQueries({ queryKey: getListWhatsappSubscribersQueryKey() });
      setNewName("");
      setNewPhone("");
      showToast("success", "Subscriber added successfully");
    } catch {
      showToast("error", "Failed to add subscriber");
    }
  }

  async function handleRemove(id: number, name: string) {
    try {
      await removeMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListWhatsappSubscribersQueryKey() });
      showToast("success", `${name} unsubscribed`);
    } catch {
      showToast("error", "Failed to remove subscriber");
    }
  }

  async function handleBroadcast() {
    if (!message.trim()) return;
    if (optedIn.length === 0) {
      showToast("error", "No opted-in subscribers with mobile numbers found");
      return;
    }
    try {
      const result = await broadcastMutation.mutateAsync({ data: { message } });
      showToast("success", `Sent to ${result.sent} subscriber${result.sent !== 1 ? "s" : ""} via Fonnte`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Broadcast failed";
      showToast("error", msg);
    }
  }

  function handleWhatsAppManual() {
    if (!message.trim()) return;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  }

  return (
    <div className="max-w-4xl mx-auto px-5 sm:px-8 py-14">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-px w-8 bg-accent" />
          <span className="text-accent text-xs font-semibold uppercase tracking-[0.18em]">Admin</span>
        </div>
        <h1 className="font-display text-5xl font-semibold text-foreground flex items-center gap-3">
          <MessageCircle className="w-10 h-10 text-green-600" />
          WhatsApp Broadcast
        </h1>
        <p className="text-muted-foreground mt-2 max-w-xl">
          Manage subscribers and send updates directly via WhatsApp using Fonnte.
        </p>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6 mb-10 p-4 bg-green-50 border border-green-100 rounded-2xl">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-green-600" />
          <span className="font-semibold text-green-800">{optedIn.length}</span>
          <span className="text-green-700 text-sm">opted-in subscribers</span>
        </div>
        <div className="text-green-300">|</div>
        <div className="text-green-700 text-sm">{subscribers.length} total registered</div>
      </div>

      {/* Broadcast composer */}
      <div className="bg-white border border-border rounded-2xl p-6 mb-6 shadow-sm">
        <h2 className="font-display text-xl font-semibold mb-4">Compose Message</h2>

        <textarea
          className="w-full border border-border rounded-xl p-4 text-sm font-medium resize-none outline-none focus:border-primary transition-colors min-h-[120px]"
          placeholder="Type your WhatsApp message here..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="text-right text-xs text-muted-foreground mt-1 mb-4">
          {message.length} characters
        </div>

        {/* Quick templates */}
        <div className="mb-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Quick Templates
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_TEMPLATES.map((t) => (
              <button
                key={t.label}
                onClick={() => setMessage(t.text)}
                className="text-xs font-medium border border-border rounded-lg px-3 py-1.5 bg-secondary/40 hover:bg-secondary transition-colors"
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="mb-5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Message Preview (as WhatsApp)
          </div>
          <div className="bg-[#dcf8c6] rounded-xl rounded-tl-none p-4 text-sm max-w-sm whitespace-pre-wrap font-sans">
            {message || <span className="text-muted-foreground italic">Your message preview…</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleBroadcast}
            disabled={broadcastMutation.isPending || !message.trim()}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all",
              "bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <Send className="w-4 h-4" />
            {broadcastMutation.isPending
              ? "Sending…"
              : `Send via Fonnte to All Subscribers`}
          </button>
          <button
            onClick={handleWhatsAppManual}
            disabled={!message.trim()}
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm border border-green-300 text-green-700 bg-white hover:bg-green-50 transition-all disabled:opacity-50"
          >
            <MessageCircle className="w-4 h-4" />
            Open in WhatsApp (manual)
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          "Send via Fonnte" delivers directly to all opted-in subscribers — no manual steps needed.
          Requires <code>FONNTE_TOKEN</code> in environment variables.
        </p>
      </div>

      {/* Add subscriber */}
      <div className="bg-white border border-border rounded-2xl p-6 mb-6 shadow-sm">
        <h2 className="font-display text-xl font-semibold mb-4">Add Subscriber</h2>
        <form onSubmit={handleAddSubscriber} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
              Name
            </label>
            <input
              type="text"
              placeholder="Resident name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full border border-border rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-primary transition-colors"
              required
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
              Mobile Number
            </label>
            <input
              type="tel"
              placeholder="+91 98765 43210"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="w-full border border-border rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-primary transition-colors"
              required
            />
          </div>
          <button
            type="submit"
            disabled={addMutation.isPending}
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm bg-primary text-white hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" />
            {addMutation.isPending ? "Adding…" : "Add Subscriber"}
          </button>
        </form>
      </div>

      {/* Subscriber list */}
      <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
        <h2 className="font-display text-xl font-semibold mb-4">
          Subscribers{" "}
          <span className="text-base font-normal text-muted-foreground">
            ({optedIn.length} active)
          </span>
        </h2>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-secondary/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : subscribers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-display text-lg font-semibold text-foreground">No subscribers yet</p>
            <p className="text-muted-foreground text-sm mt-1">
              Add subscribers above to start sending WhatsApp updates.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {subscribers.map((sub, i) => (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  "flex items-center justify-between p-4 rounded-xl border transition-all",
                  sub.optedIn
                    ? "bg-white border-border"
                    : "bg-secondary/20 border-border/50 opacity-60"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-2.5 h-2.5 rounded-full shrink-0",
                      sub.optedIn ? "bg-green-500" : "bg-muted-foreground/30"
                    )}
                  />
                  <div>
                    <div className="font-semibold text-sm">{sub.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{sub.phone}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border",
                      sub.optedIn
                        ? "bg-green-50 text-green-700 border-green-100"
                        : "bg-secondary text-muted-foreground border-border/50"
                    )}
                  >
                    {sub.optedIn ? "Opted In" : "Opted Out"}
                  </span>
                  {sub.optedIn && (
                    <button
                      onClick={() => handleRemove(sub.id, sub.name)}
                      disabled={removeMutation.isPending}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Unsubscribe"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className={cn(
            "fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-sm font-semibold z-50",
            toast.type === "success"
              ? "bg-green-800 text-white"
              : "bg-red-700 text-white"
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          {toast.text}
        </motion.div>
      )}
    </div>
  );
}
