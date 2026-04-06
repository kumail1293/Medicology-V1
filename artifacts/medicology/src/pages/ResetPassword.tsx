import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Lock, Loader2, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isStrongPassword } from "@/lib/security";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const mountTime = useRef(Date.now());

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (Date.now() - mountTime.current < 1500) {
      toast({ title: "Please wait", description: "Submission too fast.", variant: "destructive" });
      return;
    }
    if (!isStrongPassword(password)) {
      setError("Password must be at least 8 characters with one uppercase letter and one number.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
        toast({ title: "Password reset!", description: "You can now sign in with your new password." });
        setTimeout(() => setLocation("/login"), 2500);
      } else {
        setError(data.error || "Reset failed. The link may have expired.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center">
          <XCircle size={48} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">Invalid link</h2>
          <p className="text-muted-foreground text-sm mb-6">This password reset link is invalid or has expired.</p>
          <Link href="/forgot-password">
            <a className="text-primary font-semibold hover:underline">Request a new link</a>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-card border border-border rounded-3xl shadow-xl p-8 sm:p-10">
          {done ? (
            <div className="text-center">
              <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
              <h2 className="text-2xl font-display font-bold mb-2">Password reset!</h2>
              <p className="text-muted-foreground text-sm">Redirecting to sign in\u2026</p>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-display font-bold text-foreground mb-2">Set new password</h2>
                <p className="text-muted-foreground text-sm">Must be at least 8 characters with one uppercase and one number.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input
                      type={showPwd ? "text" : "password"} value={password}
                      onChange={e => setPassword(e.target.value)} required
                      className="w-full pl-11 pr-11 py-3 bg-background border-2 border-border rounded-xl focus:border-primary outline-none transition-colors text-sm"
                      placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                    />
                    <button type="button" onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input
                      type={showPwd ? "text" : "password"} value={confirm}
                      onChange={e => setConfirm(e.target.value)} required
                      className={`w-full pl-11 pr-4 py-3 bg-background border-2 rounded-xl outline-none transition-colors text-sm ${confirm && password !== confirm ? "border-red-400" : "border-border focus:border-primary"}`}
                      placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                    />
                  </div>
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <button
                  type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-bold hover:bg-primary/90 shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all disabled:opacity-70"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : "Reset password"}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
