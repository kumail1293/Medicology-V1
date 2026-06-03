import React, { useState, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { Link, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  Mail, Lock, User, Building, GraduationCap,
  Loader2, ArrowRight, Eye, EyeOff, University, ChevronDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { stripHtmlTags, isValidEmail, isStrongPassword, clientRateLimit } from '@/lib/security';

const UNIVERSITIES = [
  "Aga Khan University (AKU)",
  "National University of Medical Sciences (NUMS)",
  "Dow University of Health Sciences (DUHS)",
  "University of Health Sciences (UHS)",
  "Khyber Medical University (KMU)",
  "Jinnah Sindh Medical University (JSMU)",
  "Bahria University Medical & Dental College (BUMDC)",
  "Ziauddin University (ZU)",
  "Baqai Medical University (BMU)",
  "Hamdard University (HU)",
  "Isra University",
  "The University of Lahore (UOL)",
  "King Edward Medical University (KEMU)",
  "Rawalpindi Medical University (RMU)",
  "Quaid-e-Azam Medical College (QAMC)",
  "Nishtar Medical University",
  "Sheikh Zayed Medical College",
  "Allama Iqbal Medical College (AIMC)",
  "Services Institute of Medical Sciences (SIMS)",
  "Fatima Jinnah Medical University (FJMU)",
];

function generateCaptcha() {
  const a = Math.floor(Math.random() * 12) + 1;
  const b = Math.floor(Math.random() * 12) + 1;
  const ops = ['+', '−', '×'] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];
  let answer: number;
  if (op === '+') answer = a + b;
  else if (op === '−') answer = a - b;
  else answer = a * b;
  return { question: `${a} ${op} ${b} = ?`, answer };
}

export default function Register() {
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    college: '', university: '', year: 1
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [universityMode, setUniversityMode] = useState<'list' | 'custom'>('list');
  const [captcha] = useState(generateCaptcha);
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaError, setCaptchaError] = useState('');
  const [isPending, setIsPending] = useState(false);
  const mountTime = useRef(Date.now());

  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const passwordStrength = useMemo(() => {
    const p = formData.password;
    if (!p) return 0;
    let score = 0;
    if (p.length >= 6) score++;
    if (p.length >= 10) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  }, [formData.password]);

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'][passwordStrength];
  const strengthColor = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400', 'bg-green-600'][passwordStrength];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'year' ? parseInt(value) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (Date.now() - mountTime.current < 1500) {
      toast({ title: "Please wait", description: "Submission too fast. Please try again.", variant: "destructive" });
      return;
    }

    if (!clientRateLimit("register", 3)) {
      toast({ title: "Too many attempts", description: "Please wait a minute before trying again.", variant: "destructive" });
      return;
    }

    if (!isValidEmail(formData.email)) {
      toast({ title: "Invalid email address", variant: "destructive" }); return;
    }

    if (!isStrongPassword(formData.password)) {
      toast({ title: "Weak password", description: "Use at least 8 characters with one uppercase letter and one number.", variant: "destructive" }); return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" }); return;
    }

    const captchaAnswer = parseInt(captchaInput.trim());
    if (isNaN(captchaAnswer) || captchaAnswer !== captcha.answer) {
      setCaptchaError('Incorrect answer. Please try again.');
      setCaptchaInput('');
      return;
    }
    setCaptchaError('');

    const payload = {
      name: stripHtmlTags(formData.name.trim()),
      email: formData.email.trim().toLowerCase(),
      password: formData.password,
      college: stripHtmlTags(formData.college.trim()),
      university: formData.university.trim() || undefined,
      year: Number(formData.year),
    };

    setIsPending(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const msg = data?.error || data?.message || `Error ${response.status}`;
        toast({ title: "Registration Failed", description: msg, variant: "destructive" });
        return;
      }

      login(data.token, data.user, true);
      setLocation('/');
    } catch (err: any) {
      toast({ title: "Registration Failed", description: err?.message || "Network error. Please try again.", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Branding Panel */}
      <div className="hidden lg:flex flex-1 relative bg-primary items-center justify-center overflow-hidden order-2">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80" />
        <div className="absolute inset-0 opacity-10">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="absolute rounded-full bg-white" style={{
              width: Math.random() * 100 + 20, height: Math.random() * 100 + 20,
              left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.5
            }} />
          ))}
        </div>
        <div className="relative z-10 p-12 text-white max-w-lg">
          <img src={`${import.meta.env.BASE_URL}images/logo-white.png`} alt="Medicology" className="h-32 w-auto mb-8 object-contain" />
          <h1 className="text-5xl font-display font-bold mb-6 leading-tight">Join the elite.</h1>
          <p className="text-xl text-white/80 leading-relaxed mb-8">
            Practice with thousands of peer-reviewed MCQs tailored for MBBS students across Pakistan.
          </p>
          <div className="space-y-3">
            {["High-yield questions for all subjects", "AI-powered explanations", "Track your progress daily"].map((f) => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
                <span className="text-white/90 text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form Panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 sm:p-8 order-1 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg my-4"
        >
          {/* Mobile Logo */}
          <div className="flex items-center justify-center mb-6 lg:hidden">
            <img src={`${import.meta.env.BASE_URL}images/logo-colored.png`} alt="Medicology" className="h-16 w-auto object-contain" />
          </div>

          <div className="bg-card p-6 sm:p-8 rounded-3xl shadow-xl border border-border">
            <h2 className="text-2xl font-display font-bold text-foreground mb-1">Create Account</h2>
            <p className="text-sm text-muted-foreground mb-6">Join thousands of MBBS students</p>

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-foreground">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <input
                    type="text" name="name" value={formData.name} onChange={handleChange} required
                    className="w-full pl-10 pr-4 py-2.5 bg-background border-2 border-border rounded-xl focus:border-primary outline-none text-sm transition-colors"
                    placeholder="Dr. Ahmed Ali"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-foreground">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <input
                    type="email" name="email" value={formData.email} onChange={handleChange} required
                    className="w-full pl-10 pr-4 py-2.5 bg-background border-2 border-border rounded-xl focus:border-primary outline-none text-sm transition-colors"
                    placeholder="doctor@college.edu"
                  />
                </div>
              </div>

              {/* University */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-foreground">University</label>
                <div className="flex gap-2 mb-1.5">
                  <button type="button" onClick={() => setUniversityMode('list')}
                    className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${universityMode === 'list' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                    Select University
                  </button>
                  <button type="button" onClick={() => setUniversityMode('custom')}
                    className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${universityMode === 'custom' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                    Other / Not Listed
                  </button>
                </div>
                {universityMode === 'list' ? (
                  <div className="relative">
                    <University className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={14} />
                    <select
                      name="university" value={formData.university} onChange={handleChange}
                      className="w-full pl-10 pr-8 py-2.5 bg-background border-2 border-border rounded-xl focus:border-primary outline-none text-sm appearance-none transition-colors"
                    >
                      <option value="">Select your university...</option>
                      {UNIVERSITIES.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="relative">
                      <University className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                      <input
                        type="text" name="university" value={formData.university} onChange={handleChange}
                        className="w-full pl-10 pr-4 py-2.5 bg-background border-2 border-border rounded-xl focus:border-primary outline-none text-sm transition-colors"
                        placeholder="Enter your university name..."
                      />
                    </div>
                    <p className="text-xs text-muted-foreground px-1">Your university will be reviewed and may be added to our list.</p>
                  </div>
                )}
              </div>

              {/* College & Year */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-foreground">College</label>
                  <div className="relative">
                    <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <input
                      type="text" name="college" value={formData.college} onChange={handleChange} required
                      className="w-full pl-10 pr-3 py-2.5 bg-background border-2 border-border rounded-xl focus:border-primary outline-none text-sm transition-colors"
                      placeholder="KEMU"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-foreground">Year</label>
                  <div className="relative">
                    <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={14} />
                    <select
                      name="year" value={formData.year} onChange={handleChange}
                      className="w-full pl-10 pr-8 py-2.5 bg-background border-2 border-border rounded-xl focus:border-primary outline-none text-sm appearance-none transition-colors"
                    >
                      {[1,2,3,4,5,6].map(y => <option key={y} value={y}>Year {y}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-foreground">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <input
                    type={showPassword ? "text" : "password"} name="password"
                    value={formData.password} onChange={handleChange} required minLength={6}
                    className="w-full pl-10 pr-10 py-2.5 bg-background border-2 border-border rounded-xl focus:border-primary outline-none text-sm transition-colors"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {formData.password && (
                  <div className="space-y-1 px-1">
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= passwordStrength ? strengthColor : 'bg-muted'}`} />
                      ))}
                    </div>
                    <p className={`text-xs font-medium ${passwordStrength <= 1 ? 'text-red-500' : passwordStrength <= 3 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {strengthLabel}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-foreground">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <input
                    type={showConfirmPassword ? "text" : "password"} name="confirmPassword"
                    value={formData.confirmPassword} onChange={handleChange} required
                    className={`w-full pl-10 pr-10 py-2.5 bg-background border-2 rounded-xl outline-none text-sm transition-colors ${
                      formData.confirmPassword && formData.password !== formData.confirmPassword
                        ? 'border-red-400 focus:border-red-500'
                        : formData.confirmPassword && formData.password === formData.confirmPassword
                        ? 'border-green-400 focus:border-green-500'
                        : 'border-border focus:border-primary'
                    }`}
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5">
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="text-xs text-red-500 px-1">Passwords do not match</p>
                )}
              </div>

              {/* CAPTCHA */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-foreground">Security Check</label>
                <div className="flex items-center gap-3">
                  <div className="bg-muted border-2 border-border rounded-xl px-4 py-2.5 font-mono font-bold text-base select-none text-foreground min-w-28 text-center tracking-widest">
                    {captcha.question}
                  </div>
                  <input
                    type="number"
                    value={captchaInput}
                    onChange={(e) => { setCaptchaInput(e.target.value); setCaptchaError(''); }}
                    className="flex-1 py-2.5 px-4 bg-background border-2 border-border rounded-xl focus:border-primary outline-none text-sm transition-colors"
                    placeholder="Your answer"
                    required
                  />
                </div>
                {captchaError && <p className="text-xs text-red-500 px-1">{captchaError}</p>}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:bg-primary/90 shadow-md shadow-primary/25 hover:-translate-y-0.5 mt-2 transition-all disabled:opacity-70"
              >
                {isPending ? <Loader2 className="animate-spin" size={18} /> : <>Create Account <ArrowRight size={18} /></>}
              </button>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-card text-xs text-muted-foreground">or</span>
                </div>
              </div>

              {/* Google Sign-in */}
              <button
                type="button"
                onClick={() => toast({ title: "Coming Soon", description: "Google sign-in will be available soon." })}
                className="w-full flex items-center justify-center gap-3 py-2.5 border-2 border-border rounded-xl hover:bg-muted transition-colors text-sm font-medium"
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

            </form>

            <p className="text-center mt-5 text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
