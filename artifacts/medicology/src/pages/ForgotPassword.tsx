import { useState, useRef } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Mail, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isValidEmail, clientRateLimit } from "@/lib/security";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();
  const mountTime = useRef(Date.now());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (Date.now() - mountTime.current < 1500) {
      toast({ title: "Please wait", description: "Submission too fast. Please try again.", variant: "destructive" });
      return;
    }

    if (!isValidEmail(email)) {
      toast({ title: "Invalid email", variant: "destructive" });
      return;
    }

    if (!clientRateLimit("forgot-password", 3)) {
      toast({ title: "Too many attempts", description: "Please wait a minute before trying again.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        setSent(true);
      }
    } catch {
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-card border border-border rounded-3xl shadow-xl p-8 sm:p-10">
          <Link href="/login">
            <a className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
              <ArrowLeft size={16} /> Back to sign in
            </a>
          </Link>

          {sent ? (
            <div className="text-center">
              <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
              <h2 className="text-2xl font-display font-bold text-foreground mb-2">Check your inbox</h2>
              <p className="text-muted-foreground text-sm">
                If an account with <span className="font-semibold text-foreground">{email}</span> exists,
                a password reset link has been sent. Check your spam folder too.
              </p>
              <Link href="/login">
                <a className="inline-block mt-6 text-primary font-semibold text-sm hover:underline">Return to sign in</a>
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-display font-bold text-foreground mb-2">Forgot password?</h2>
                <p className="text-muted-foreground text-sm">Enter your email and we\u2019ll send a reset link.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input
                      type="email" value={email} onChange={e => setEmail(e.target.value)} required
                      className="w-full pl-11 pr-4 py-3 bg-background border-2 border-border rounded-xl focus:border-primary outline-none transition-colors text-sm"
                      placeholder="doctor@college.edu"
                    />
                  </div>
                </div>

                <button
                  type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-bold hover:bg-primary/90 shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:transform-none"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : "Send reset link"}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
