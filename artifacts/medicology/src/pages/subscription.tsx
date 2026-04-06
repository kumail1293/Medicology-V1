import { useState, useEffect } from "react";
import { PageTransition } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, CheckCircle, XCircle, Clock, BookOpen, GraduationCap, Settings, ChevronDown, ShoppingBag, Star } from "lucide-react";
import { LogoImg } from "@/components/LogoImg";
import { Link } from "wouter";
import { clsx } from "clsx";
import { motion, AnimatePresence } from "framer-motion";

interface SubItem {
  id: number;
  qbankType: string;
  label: string;
  subtitle: string;
  qbankKind: string;
  isUniversity: boolean;
  status: string;
  purchasedAt: string;
  expiresAt: string | null;
  isExpired: boolean;
  daysLeft: number | null;
  price: string | null;
  selectedYear: string | null;
}

interface SubscriptionData {
  active: SubItem[];
  expired: SubItem[];
  total: number;
}

const YEAR_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];

const LOGO_MAP: Record<string, string> = {
  mbbs:            "/logos/pakistan-flag.svg",
  fcps_part1:      "/logos/cpsp.png",
  fcps_part2:      "/logos/cpsp.png",
  fcps_fellowship: "/logos/cpsp.png",
  nle_nle1:        "/logos/pmdc.png",
  nle_nle2:        "/logos/pmdc.png",
  neb_1:           "/logos/pmdc.png",
  neb_2:           "/logos/pmdc.png",
  usmle_step1:     "/logos/usmle.png",
  usmle_step2ck:   "/logos/usmle.png",
  usmle_step3:     "/logos/usmle.png",
  amc_cat:         "/logos/amc.png",
  amc_clinical:    "/logos/amc.png",
  mrcp_part1:      "/logos/mrcp.png",
  mrcp_part2:      "/logos/mrcp.png",
  plab1:           "/logos/gmc.png",
  plab2:           "/logos/gmc.png",
};

function daysLeftLabel(item: SubItem) {
  if (!item.expiresAt) return "Lifetime access";
  if (item.isExpired) return "Expired";
  if (item.daysLeft !== null) {
    if (item.daysLeft === 0) return "Expires today";
    return `${item.daysLeft} day${item.daysLeft !== 1 ? "s" : ""} left`;
  }
  return "";
}

function daysLeftColor(item: SubItem) {
  if (item.isExpired) return "text-red-500 bg-red-500/10";
  if (item.daysLeft === null) return "text-green-600 bg-green-500/10";
  if (item.daysLeft <= 7) return "text-orange-500 bg-orange-500/10";
  return "text-green-600 bg-green-500/10";
}

function YearSelector({ item, onSaved }: { item: SubItem; onSaved: (year: string) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const token = localStorage.getItem("medicology_token");

  const handleSelect = async (year: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/qbanks/my/settings/${item.qbankType}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ selectedYear: year }),
      });
      if (res.ok) {
        onSaved(year);
        toast({ title: "Year saved", description: `${item.label} set to ${year}` });
      }
    } catch {
      toast({ title: "Failed to save year", variant: "destructive" });
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={saving}
        className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
      >
        <GraduationCap size={13} />
        {item.selectedYear ?? "Set Year"}
        <ChevronDown size={12} className={clsx("transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-[140px]"
          >
            {YEAR_OPTIONS.map(yr => (
              <button
                key={yr}
                onClick={() => handleSelect(yr)}
                className={clsx(
                  "w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors",
                  item.selectedYear === yr ? "font-bold text-primary" : "text-foreground"
                )}
              >
                {yr}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SubscriptionCard({ item, onYearSaved }: { item: SubItem; onYearSaved: (qbankType: string, year: string) => void }) {
  const logo = LOGO_MAP[item.qbankType];
  const label = daysLeftLabel(item);
  const colorCls = daysLeftColor(item);

  return (
    <div className={clsx(
      "bg-card border rounded-2xl p-5 shadow-sm flex flex-col gap-4",
      item.isExpired ? "border-red-200 dark:border-red-900/40 opacity-70" : "border-border"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <LogoImg src={logo} size={28} className="rounded-lg" />
          <div>
            <p className="font-bold text-sm text-foreground">{item.label}</p>
            <p className="text-xs text-muted-foreground">{item.subtitle}</p>
          </div>
        </div>
        <span className={clsx("shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full", colorCls)}>
          {label}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className={clsx("px-2 py-0.5 rounded-full font-semibold text-[10px] uppercase tracking-wide",
          item.isUniversity ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600"
        )}>
          {item.isUniversity ? "University" : "International"}
        </span>
        {item.price && <span className="text-muted-foreground">\u2022 Paid: {item.price}</span>}
        <span className="text-muted-foreground">\u2022 Purchased {new Date(item.purchasedAt).toLocaleDateString()}</span>
        {item.expiresAt && !item.isExpired && (
          <span className="text-muted-foreground">\u2022 Expires {new Date(item.expiresAt).toLocaleDateString()}</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        {item.isUniversity && !item.isExpired && (
          <YearSelector item={item} onSaved={year => onYearSaved(item.qbankType, year)} />
        )}
        {!item.isExpired ? (
          <Link href="/create-test">
            <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors cursor-pointer">
              <BookOpen size={13} /> Study Now
            </span>
          </Link>
        ) : (
          <Link href="/qbanks">
            <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-muted text-foreground rounded-lg hover:bg-muted/70 transition-colors cursor-pointer">
              <ShoppingBag size={13} /> Renew
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}

export default function SubscriptionPage() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("medicology_token");

  const load = async () => {
    try {
      const res = await fetch("/api/qbanks/subscription", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setData(await res.json());
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleYearSaved = (qbankType: string, year: string) => {
    setData(prev => {
      if (!prev) return prev;
      const patch = (list: SubItem[]) => list.map(item =>
        item.qbankType === qbankType ? { ...item, selectedYear: year } : item
      );
      return { ...prev, active: patch(prev.active), expired: patch(prev.expired) };
    });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <CreditCard size={32} className="text-primary opacity-60" />
          <p className="text-muted-foreground text-sm">Loading subscriptions\u2026</p>
        </div>
      </div>
    );
  }

  const active = data?.active ?? [];
  const expired = data?.expired ?? [];

  return (
    <PageTransition className="space-y-8 max-w-3xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight flex items-center gap-3">
            <CreditCard size={28} className="text-primary" /> My Subscription
          </h1>
          <p className="text-muted-foreground mt-1">Manage your active QBank subscriptions and year settings</p>
        </div>
        <Link href="/qbanks">
          <span className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl font-semibold text-sm hover:bg-primary/20 transition-colors cursor-pointer">
            <ShoppingBag size={15} /> Browse QBanks
          </span>
        </Link>
      </div>

      {/* Summary strip */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-extrabold text-primary">{active.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Active</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-extrabold text-foreground">{data.total}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total Purchases</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-extrabold text-red-500">{expired.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Expired</p>
          </div>
        </div>
      )}

      {/* Active subscriptions */}
      {active.length > 0 ? (
        <section>
          <h2 className="text-base font-bold mb-4 flex items-center gap-2 text-green-600">
            <CheckCircle size={17} /> Active Subscriptions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {active.map(item => (
              <SubscriptionCard key={item.id} item={item} onYearSaved={handleYearSaved} />
            ))}
          </div>
        </section>
      ) : (
        <div className="bg-card border border-border rounded-3xl p-10 text-center shadow-sm">
          <CreditCard size={40} className="mx-auto text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-lg font-bold mb-2">No active subscriptions</h3>
          <p className="text-muted-foreground text-sm mb-6">Purchase a QBank to unlock full access to thousands of practice questions.</p>
          <Link href="/qbanks">
            <span className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors cursor-pointer">
              <ShoppingBag size={16} /> Browse QBanks
            </span>
          </Link>
        </div>
      )}

      {/* Expired subscriptions */}
      {expired.length > 0 && (
        <section>
          <h2 className="text-base font-bold mb-4 flex items-center gap-2 text-red-500">
            <XCircle size={17} /> Expired / Inactive
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {expired.map(item => (
              <SubscriptionCard key={item.id} item={item} onYearSaved={handleYearSaved} />
            ))}
          </div>
        </section>
      )}

      {/* University QBank help */}
      {active.some(i => i.isUniversity) && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex items-start gap-4">
          <Settings size={20} className="text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm mb-1">University QBank Settings</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              For Pakistani university QBanks (MBBS, FCPS), select your current year of study using the
              <span className="font-semibold text-foreground"> Set Year</span> button on each card.
              This helps filter questions relevant to your curriculum and block structure.
            </p>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
