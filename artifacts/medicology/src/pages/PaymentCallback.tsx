import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

type Status = "verifying" | "success" | "failed";

export default function PaymentCallback() {
  const [status, setStatus] = useState<Status>("verifying");
  const [message, setMessage] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gatewayStatus = params.get("status");
    const provider = params.get("provider") ?? "";
    const orderId = params.get("orderId") ?? "";
    const ref = params.get("ref") ?? "";

    async function verify() {
      if (gatewayStatus === "failed" || gatewayStatus === "cancel") {
        setStatus("failed");
        setMessage("Payment was not completed.");
        toast({ title: "Payment cancelled", description: "Your payment was not completed.", variant: "destructive" });
        setTimeout(() => setLocation("/subscription"), 3000);
        return;
      }

      try {
        const res = await apiFetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, provider, ref }),
        });

        if (res.ok) {
          const data = await res.json();
          setStatus("success");
          setMessage(`${data.qbankType ? "QBank access" : "Payment"} verified! Redirecting\u2026`);
          toast({ title: "Payment successful!", description: "Your subscription is now active." });
          setTimeout(() => setLocation("/subscription"), 2000);
        } else {
          setStatus("failed");
          setMessage("Payment verification failed. Please contact support.");
          toast({ title: "Verification failed", description: "Contact support if payment was deducted.", variant: "destructive" });
          setTimeout(() => setLocation("/subscription"), 4000);
        }
      } catch {
        setStatus("failed");
        setMessage("Network error during verification. Contact support.");
        setTimeout(() => setLocation("/subscription"), 4000);
      }
    }

    verify();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="bg-card border border-border rounded-3xl shadow-xl p-10 max-w-sm w-full text-center">
        {status === "verifying" && (
          <>
            <Loader2 size={48} className="mx-auto animate-spin text-primary mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Verifying payment</h2>
            <p className="text-muted-foreground text-sm">Please wait while we confirm your transaction\u2026</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Payment confirmed!</h2>
            <p className="text-muted-foreground text-sm">{message}</p>
          </>
        )}
        {status === "failed" && (
          <>
            <XCircle size={48} className="mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Payment issue</h2>
            <p className="text-muted-foreground text-sm">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}
