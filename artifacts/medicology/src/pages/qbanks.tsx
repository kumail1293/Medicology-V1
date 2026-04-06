import { useState, useEffect } from "react";
import { PageTransition } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { ShoppingBag, Check, Lock, Star, BookOpen, ChevronRight, X, CreditCard, GraduationCap, Globe, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { PaymentModal } from "@/components/PaymentModal";
import { LogoImg } from "@/components/LogoImg";

interface QBank {
  id: string;
  label: string;
  subtitle: string;
  price: number;
  currency: string;
  description: string;
  purchased: boolean;
  qbankKind?: string;
}

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

const HIGHLIGHT_MAP: Record<string, string> = {
  mbbs: "border-emerald-500/50 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10",
  usmle_step1: "border-blue-500/50 bg-gradient-to-br from-blue-500/5 to-blue-500/10",
  usmle_step2ck: "border-blue-500/50 bg-gradient-to-br from-blue-500/5 to-blue-500/10",
  usmle_step3: "border-blue-500/50 bg-gradient-to-br from-blue-500/5 to-blue-500/10",
  fcps_part1: "border-purple-500/50 bg-gradient-to-br from-purple-500/5 to-purple-500/10",
  fcps_part2: "border-purple-500/50 bg-gradient-to-br from-purple-500/5 to-purple-500/10",
  fcps_fellowship: "border-purple-500/50 bg-gradient-to-br from-purple-500/5 to-purple-500/10",
};

// Which catalogue IDs belong to which group
const PAKISTAN_IDS = new Set(["mbbs", "fcps_part1", "fcps_part2", "fcps_fellowship", "nle_nle1", "nle_nle2", "neb_1", "neb_2"]);
const isInternational = (id: string) => !PAKISTAN_IDS.has(id);

export default function QBanksPage() {
  const [catalogue, setCatalogue] = useState<QBank[]>([]);
  const [purchasedCount, setPurchasedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState<QBank | null>(null);
  const [payModal, setPayModal] = useState<QBank | null>(null);
  const { toast } = useToast();
  const token = localStorage.getItem("medicology_token");

  const load = async () => {
    try {
      const res = await fetch("/api/qbanks/catalogue", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setCatalogue(data.catalogue || []);
      setPurchasedCount(data.purchasedCount || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleOpenPayment = (qbank: QBank) => {
    setShowModal(null);
    setPayModal(qbank);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="text-muted-foreground animate-pulse">Loading QBanks…</div>
    </div>
  );

  const myQBanks = catalogue.filter(q => q.purchased);
  const available = catalogue.filter(q => !q.purchased);

  return (
    <PageTransition className="space-y-8 max-w-5xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight">QBank Store</h1>
          <p className="text-muted-foreground mt-1">Purchase access to premium question banks for your exams</p>
        </div>
        {purchasedCount > 0 && (
          <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-2xl font-semibold text-sm">
            <BookOpen size={16} /> {purchasedCount} Active QBank{purchasedCount > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Demo notice */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 text-sm text-yellow-700 dark:text-yellow-400 flex items-start gap-3">
        <Star size={16} className="shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Demo Mode:</span> Purchases are simulated — no real payment is required. Full payment integration (credit card, JazzCash, EasyPaisa) will be enabled at launch.
        </div>
      </div>

      {/* My Active QBanks */}
      {myQBanks.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Check size={18} className="text-green-500" /> My Active QBanks
            </h2>
            <Link href="/subscription">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline cursor-pointer">
                <CreditCard size={13} /> Manage Subscriptions
              </span>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myQBanks.map(q => {
              const isUniversity = PAKISTAN_IDS.has(q.id);
              return (
                <Card key={q.id} className={cn("border-2 relative overflow-hidden", HIGHLIGHT_MAP[q.id] || "border-green-500/40 bg-green-500/5")}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <LogoImg src={LOGO_MAP[q.id]} size={28} className="rounded-lg" />
                      <div className="flex flex-col items-end gap-1">
                        <Badge className="bg-green-500 text-white text-xs gap-1"><Check size={10} /> Active</Badge>
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                          isUniversity ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600"
                        )}>
                          {isUniversity ? "University" : "International"}
                        </span>
                      </div>
                    </div>
                    <h3 className="font-extrabold text-base mb-0.5">{q.label}</h3>
                    <p className="text-xs text-muted-foreground">{q.subtitle}</p>
                    <div className="flex gap-2 mt-4">
                      <Button size="sm" className="flex-1 gap-1" onClick={() => window.location.href = "/create-test"}>
                        <BookOpen size={14} /> Study <ChevronRight size={13} />
                      </Button>
                      {isUniversity && (
                        <Link href="/subscription">
                          <Button size="sm" variant="outline" className="gap-1 px-3">
                            <GraduationCap size={13} />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Available QBanks */}
      {available.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShoppingBag size={18} /> Available QBanks
          </h2>

          {/* Pakistan / MBBS group */}
          {available.filter(q => !isInternational(q.id)).length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2"><Building2 size={14} className="text-muted-foreground/60" /> Pakistan (MBBS · FCPS · NRE · NEB)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {available.filter(q => !isInternational(q.id)).map(q => (
                  <QBankCard key={q.id} q={q} onUnlock={() => setShowModal(q)} />
                ))}
              </div>
            </div>
          )}

          {/* International group */}
          {available.filter(q => isInternational(q.id)).length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2"><Globe size={15} /> International Exams</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {available.filter(q => isInternational(q.id)).map(q => (
                  <QBankCard key={q.id} q={q} onUnlock={() => setShowModal(q)} />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Purchase Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(null)} />
          <div className="relative bg-card border border-border rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95">
            <button onClick={() => setShowModal(null)} className="absolute top-4 right-4 p-2 rounded-xl hover:bg-muted transition-colors">
              <X size={18} />
            </button>
            <div className="flex justify-center mb-4"><LogoImg src={LOGO_MAP[showModal.id]} size={56} className="rounded-2xl" /></div>
            <h2 className="text-2xl font-display font-extrabold text-center mb-1">{showModal.label}</h2>
            <p className="text-muted-foreground text-center text-sm mb-6">{showModal.subtitle}</p>
            <div className="bg-muted/50 rounded-2xl p-4 mb-6 text-sm leading-relaxed text-muted-foreground">
              {showModal.description}
            </div>
            <div className="text-center mb-6">
              <div className="text-4xl font-extrabold text-foreground">{showModal.currency} {showModal.price.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground mt-1">One-time payment · Lifetime access</div>
            </div>
            <div className="space-y-3">
              <Button
                className="w-full py-6 text-base font-bold rounded-2xl gap-2"
                onClick={() => handleOpenPayment(showModal)}
              >
                {`Subscribe — ${showModal.currency} ${showModal.price.toLocaleString()}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      <PaymentModal
        open={!!payModal}
        onClose={() => setPayModal(null)}
        item={payModal ? { id: payModal.id, label: payModal.label, price: payModal.price, currency: payModal.currency } : null}
      />
    </PageTransition>
  );
}

function QBankCard({ q, onUnlock }: { q: { id: string; label: string; subtitle: string; price: number; currency: string; description: string; purchased: boolean }; onUnlock: () => void }) {
  return (
    <Card className="border border-border hover:border-primary/40 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <LogoImg src={LOGO_MAP[q.id]} size={28} className="rounded-lg" />
          <div className="text-right">
            <div className="font-extrabold text-lg text-foreground">{q.currency} {q.price.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">one-time</div>
          </div>
        </div>
        <h3 className="font-extrabold text-base mb-0.5">{q.label}</h3>
        <p className="text-xs text-muted-foreground mb-3">{q.subtitle}</p>
        <p className="text-xs text-muted-foreground leading-relaxed mb-4 line-clamp-2">{q.description}</p>
        <Button size="sm" className="w-full gap-1.5" variant="outline" onClick={onUnlock}>
          <Lock size={13} /> Unlock Access
        </Button>
      </CardContent>
    </Card>
  );
}
