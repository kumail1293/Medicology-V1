import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { Link, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Mail, Lock, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sanitizeInput, clientRateLimit } from '@/lib/security';
import { mockAuthService } from '@/lib/mockAuth';

export default function Login() {
  const [email, setEmail] = useState('test@college.edu');
  const [password, setPassword] = useState('Password123');
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [rememberMe, setRememberMe] = useState(true);
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const mountTime = useRef(Date.now());
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startLockout = (seconds: number) => {
    const until = Date.now() + seconds * 1000;
    setLockoutUntil(until);
    setCountdown(seconds);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      const remaining = Math.ceil((until - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setCountdown(0);
        if (countdownRef.current) clearInterval(countdownRef.current);
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (Date.now() - mountTime.current < 1500) {
      toast({ title: "Please wait", description: "Submission too fast. Please try again.", variant: "destructive" });
      return;
    }

    if (lockoutUntil && Date.now() < lockoutUntil) {
      toast({ title: \Try again in \s\, variant: "destructive" });
      return;
    }

    if (!clientRateLimit("login", 5)) {
      toast({ title: "Too many attempts", description: "Please wait a minute before trying again.", variant: "destructive" });
      return;
    }

    setIsPending(true);
    try {
      const data = await mockAuthService.login(sanitizeInput(email.trim()), password);
      setFailedAttempts(0);
      login(data.token, data.user, rememberMe);
      toast({ title: "Welcome back!", description: \Logged in as \\, variant: "default" });
      setLocation('/');
    } catch (err: any) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      if (newAttempts >= 3) startLockout(30);
      toast({
        title: "Login Failed",
        description: err?.message || "Invalid credentials",
        variant: "destructive"
      });
    } finally {
      setIsPending(false);
    }
  };

  const isLocked = !!lockoutUntil && Date.now() < lockoutUntil;

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left branding */}
      <div className="hidden lg:flex flex-1 relative bg-primary items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80" />
        <div className="absolute inset-0 opacity-10">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="absolute rounded-full bg-white" style={{
              width: Math.random() * 120 + 30, height: Math.random() * 120 + 30,
              left: \\%\, top: \\%\,
              opacity: Math.random() * 0.5
            }} />
          ))}
        </div>
        <div className="relative z-10 p-12 text-white max-w-lg">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
            <img src={\\images/logo-white.png\} alt="Medicology" className="h-32 w-auto object-contain mb-8 drop-shadow-2xl" />
            <h1 className="text-5xl font-display font-bold mb-6 leading-tight">Master your medical knowledge.</h1>
            <p className="text-lg text-white/80 leading-relaxed">
              The premier QBank platform designed exclusively for MBBS students. High-yield questions, detailed explanations, and AI-powered insights.
            </p>
            <div className="mt-8 pt-6 border-t border-white/20">
              <p className="text-sm text-white/70 mb-3 font-medium">?? Demo Mode - Test with:</p>
              <p className="text-xs text-white/60">Email: test@college.edu</p>
              <p className="text-xs text-white/60">Password: Password123</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="flex items-center justify-center mb-6 lg:hidden">
            <img src={\\images/logo-colored.png\} alt="Medicology" className="h-16 w-auto object-contain" />
          </div>

          <div className="bg-card p-8 sm:p-10 rounded-3xl shadow-xl border border-border">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-display font-bold text-foreground mb-2">Welcome back</h2>
              <p className="text-muted-foreground text-sm">Sign in to continue your progress</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    className="w-full pl-11 pr-4 py-3 bg-background border-2 border-border rounded-xl focus:border-primary outline-none transition-colors"
                    placeholder="doctor@college.edu"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <input
                    type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required
                    className="w-full pl-11 pr-12 py-3 bg-background border-2 border-border rounded-xl focus:border-primary outline-none transition-colors"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="form-checkbox h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  Keep me signed in
                </label>
                <Link href="/forgot-password" className="text-xs text-primary hover:underline font-medium">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit" disabled={isPending || isLocked}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-bold text-base hover:bg-primary/90 shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:transform-none"
              >
                {isPending
                  ? <Loader2 className="animate-spin" size={18} />
                  : isLocked
                  ? \Try again in \s\
                  : <><span>Sign In</span><ArrowRight size={18} /></>}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-card text-xs text-muted-foreground">or</span>
              </div>
            </div>

            {/* Google Sign-in */}
            <button
              type="button"
              onClick={() => toast({ title: "Coming Soon", description: "Google sign-in will be available soon. Please use email registration for now." })}
              className="w-full flex items-center justify-center gap-3 py-3 border-2 border-border rounded-xl hover:bg-muted transition-colors text-sm font-medium"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <p className="text-center mt-6 text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link href="/register" className="text-primary font-semibold hover:underline">Create one</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
