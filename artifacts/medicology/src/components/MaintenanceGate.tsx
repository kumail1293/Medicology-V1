import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { fetchPublicSettings } from "@/lib/adminSettings";
import { Wrench } from "lucide-react";

/**
 * Server-side maintenance mode is enforced by the API (503); this gate just
 * shows a friendly screen instead of a wall of failed requests. Admins bypass
 * it (they keep working during maintenance).
 */
export default function MaintenanceGate({ children }: { children: ReactNode }) {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [maintenance, setMaintenance] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPublicSettings()
      .then(({ maintenance: m }) => { if (!cancelled) setMaintenance(m.enabled); })
      .catch(() => { if (!cancelled) setMaintenance(false); });
    return () => { cancelled = true; };
  }, []);

  // Wait for auth + the maintenance check before deciding.
  if (authLoading || maintenance === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (maintenance && !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Wrench size={28} />
        </div>
        <h1 className="text-2xl font-display font-extrabold">Under Maintenance</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The platform is temporarily under maintenance. Please check back shortly — we're
          making it better.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
