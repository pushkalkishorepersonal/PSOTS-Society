import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export function AuthVerify() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");

    if (!token) {
      setStatus("error");
      setErrorMsg("No token found in this link. Please request a new login link.");
      return;
    }

    fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data: any) => {
        if (data.token) {
          login(data.token);
          setStatus("success");
          setTimeout(() => navigate("/"), 2000);
        } else {
          setStatus("error");
          setErrorMsg(data.error ?? "Login failed. Please try again.");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMsg("Could not connect to server. Please try again.");
      });
  }, [login, navigate]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        {status === "loading" && (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
            <h2 className="font-display text-2xl font-semibold">Verifying your link…</h2>
            <p className="text-muted-foreground mt-2">Just a moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="font-display text-2xl font-semibold">You're logged in!</h2>
            <p className="text-muted-foreground mt-2">Taking you home…</p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="font-display text-2xl font-semibold">Login link invalid</h2>
            <p className="text-muted-foreground mt-2 mb-6">{errorMsg}</p>
            <button
              onClick={() => navigate("/")}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-full font-bold text-sm hover:bg-primary/90 transition-colors"
            >
              Go home
            </button>
          </>
        )}
      </div>
    </div>
  );
}
