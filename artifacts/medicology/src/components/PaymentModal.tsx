import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, CreditCard, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { initiatePayment, redirectToGateway, type PaymentProvider } from "@/lib/payments";
import { isValidPakistaniPhone } from "@/lib/security";

interface CatalogueItem {
  id: string;
  label: string;
  price: number;
  currency: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  item: CatalogueItem | null;
}

export function PaymentModal({ open, onClose, item }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selected, setSelected] = useState<PaymentProvider | null>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  if (!item) return null;

  const isPKR = item.currency === "PKR";
  const needsPhone = selected === "jazzcash" || selected === "easypaisa";

  const handlePay = async () => {
    if (!selected) {
      toast({ title: "Select a payment method", variant: "destructive" });
      return;
    }
    if (needsPhone) {
      if (!phone || !isValidPakistaniPhone(phone)) {
        setPhoneError("Enter a valid Pakistani mobile number (03xxxxxxxxx)");
        return;
      }
      setPhoneError("");
    }

    setLoading(true);
    try {
      const response = await initiatePayment({
        qbankType: item.id,
        amount: isPKR ? item.price : item.price,
        currency: isPKR ? "PKR" : "USD",
        provider: selected,
        userEmail: user?.email ?? "",
        userName: (user as any)?.name ?? "",
        userPhone: needsPhone ? phone : undefined,
      });

      if (response.redirectUrl) {
        redirectToGateway(response.redirectUrl);
        return;
      }

      toast({ title: "Payment error", description: "Unexpected response from server.", variant: "destructive" });
    } catch (err: any) {
      toast({ title: "Payment failed", description: err.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const priceLabel = isPKR
    ? `PKR ${item.price.toLocaleString()}`
    : `USD ${item.price}`;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Choose payment method</DialogTitle>
          <DialogDescription>
            {item.label} &mdash; <span className="font-bold text-foreground">{priceLabel}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {isPKR && (
            <>
              <button
                onClick={() => setSelected("jazzcash")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${selected === "jazzcash" ? "border-[#CC0000] bg-[#CC0000]/5" : "border-border hover:border-[#CC0000]/40"}`}
              >
                <div className="w-9 h-9 rounded-lg bg-[#CC0000] flex items-center justify-center shrink-0">
                  <CreditCard size={18} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">JazzCash</p>
                  <p className="text-xs text-muted-foreground">Debit card, mobile wallet</p>
                </div>
              </button>

              <button
                onClick={() => setSelected("easypaisa")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${selected === "easypaisa" ? "border-[#6DC03B] bg-[#6DC03B]/5" : "border-border hover:border-[#6DC03B]/40"}`}
              >
                <div className="w-9 h-9 rounded-lg bg-[#6DC03B] flex items-center justify-center shrink-0">
                  <Smartphone size={18} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">Easypaisa</p>
                  <p className="text-xs text-muted-foreground">Mobile wallet</p>
                </div>
              </button>
            </>
          )}

          <button
            onClick={() => setSelected("stripe")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${selected === "stripe" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
          >
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <CreditCard size={18} className="text-primary-foreground" />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">Pay with Card (Intl.)</p>
              <p className="text-xs text-muted-foreground">Visa, Mastercard via Stripe</p>
            </div>
          </button>
        </div>

        {needsPhone && (
          <div className="mt-3 space-y-1.5">
            <label className="text-sm font-semibold text-foreground">
              Mobile number <span className="font-normal text-muted-foreground">(03xxxxxxxxx)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setPhoneError(""); }}
              placeholder="03001234567"
              maxLength={11}
              className="w-full px-3 py-2.5 bg-background border-2 border-border rounded-xl focus:border-primary outline-none text-sm transition-colors"
            />
            {phoneError && <p className="text-xs text-red-500">{phoneError}</p>}
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border-2 border-border text-sm font-semibold hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePay}
            disabled={loading || !selected}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : "Pay Now"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
