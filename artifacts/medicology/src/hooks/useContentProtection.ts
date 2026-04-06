import { useEffect, useRef } from "react";
import {
  blockCaptureShortcuts,
  detectDevTools,
  blurOnFocusLoss,
  reportSuspiciousActivity,
} from "@/lib/contentProtection";
import { useToast } from "@/hooks/use-toast";

interface Options {
  sessionId?: string;
  mode?: "exam" | "practice" | "review";
  onTabHidden?: () => void;
  onTabVisible?: () => void;
}

export function useContentProtection(opts: Options = {}) {
  const { toast } = useToast();
  const warnedRef = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cleanups: (() => void)[] = [];

    cleanups.push(blockCaptureShortcuts());

    if (!import.meta.env.DEV) {
      cleanups.push(detectDevTools(() => {
        if (opts.sessionId)
          reportSuspiciousActivity(opts.sessionId, "devtools");
        toast({
          title: "Security warning",
          description: "Developer tools detected. This has been logged.",
          variant: "destructive",
        });
      }));
    }

    if (opts.mode === "exam" && contentRef.current) {
      cleanups.push(blurOnFocusLoss(contentRef.current));
    }

    const visibilityHandler = () => {
      if (document.visibilityState === "hidden") {
        opts.onTabHidden?.();
        if (opts.sessionId)
          reportSuspiciousActivity(opts.sessionId, "tab_hidden");
        if (opts.mode === "exam" && !warnedRef.current) {
          warnedRef.current = true;
          toast({
            title: "Tab switch detected",
            description: "Leaving this tab during an exam has been logged.",
            variant: "destructive",
          });
        }
      } else {
        warnedRef.current = false;
        opts.onTabVisible?.();
      }
    };
    document.addEventListener("visibilitychange", visibilityHandler);
    cleanups.push(() =>
      document.removeEventListener("visibilitychange", visibilityHandler)
    );

    const rcHandler = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", rcHandler);
    cleanups.push(() => document.removeEventListener("contextmenu", rcHandler));

    return () => cleanups.forEach(fn => fn());
  }, [opts.sessionId, opts.mode]);

  return { contentRef };
}
