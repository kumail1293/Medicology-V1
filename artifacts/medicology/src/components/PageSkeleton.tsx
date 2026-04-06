import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const item = {
  hidden: { opacity: 0 },
  show: { opacity: 1 },
};

export function PageSkeleton() {
  return (
    <motion.div 
      className="space-y-6 max-w-5xl mx-auto px-4 py-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item} className="flex items-center justify-between">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-10 w-28 rounded-xl" />
      </motion.div>
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <motion.div key={i} variants={item} className="rounded-2xl border border-border/50 bg-card shadow-md p-5 space-y-3">
            <Skeleton className="h-4 w-24 rounded-lg" />
            <Skeleton className="h-8 w-16 rounded-lg" />
            <Skeleton className="h-3 w-32 rounded-lg" />
          </motion.div>
        ))}
      </motion.div>
      <motion.div variants={item} className="rounded-2xl border border-border/50 bg-card shadow-md p-6 space-y-4">
        <Skeleton className="h-5 w-40 rounded-lg" />
        {[...Array(5)].map((_, i) => (
          <motion.div key={i} variants={item} className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full rounded-lg" />
              <Skeleton className="h-3 w-2/3 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-20 rounded-lg" />
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <motion.div 
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {[...Array(count)].map((_, i) => (
        <motion.div key={i} variants={item} className="rounded-2xl border border-border/50 bg-card shadow-md p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4 rounded-lg" />
              <Skeleton className="h-3 w-1/2 rounded-lg" />
            </div>
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="flex gap-2">
            <Skeleton className="h-8 flex-1 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <motion.div 
      className="rounded-2xl border border-border/50 overflow-hidden bg-card shadow-md"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item} className="bg-gradient-mesh px-5 py-4 flex gap-4 border-b border-border/40">
        {[40, 25, 20, 15].map((w, i) => (
          <Skeleton key={i} className="h-4 rounded-lg" style={{ width: `${w}%` }} />
        ))}
      </motion.div>
      <div className="divide-y divide-border/40">
        {[...Array(rows)].map((_, i) => (
          <motion.div key={i} variants={item} className="px-5 py-4 flex gap-4 items-center hover:bg-muted/30 transition-colors duration-200">
            {[40, 25, 20, 15].map((w, j) => (
              <Skeleton key={j} className="h-4 rounded-lg" style={{ width: `${w}%` }} />
            ))}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
