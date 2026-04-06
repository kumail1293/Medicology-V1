import { apiFetch } from "@/lib/api";

export type PaymentProvider = "jazzcash" | "easypaisa" | "stripe";

export interface PaymentRequest {
  qbankType: string;
  amount: number;
  currency: "PKR" | "USD";
  provider: PaymentProvider;
  userEmail: string;
  userName: string;
  userPhone?: string;
}

export interface PaymentResponse {
  provider: PaymentProvider;
  sessionId?: string;
  redirectUrl?: string;
  orderId: string;
  status: "pending" | "redirect" | "error";
  message?: string;
}

export async function initiatePayment(req: PaymentRequest): Promise<PaymentResponse> {
  const res = await apiFetch("/api/payments/initiate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || "Payment initiation failed");
  }
  return res.json();
}

export function redirectToGateway(url: string) {
  window.location.href = url;
}
