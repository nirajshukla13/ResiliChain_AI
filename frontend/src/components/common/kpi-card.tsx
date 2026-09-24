import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { useAnimatedNumber } from "@/hooks/use-animated-number";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  /** Signed percentage, e.g. -3.2 renders "3.2%" with a down arrow. */
  delta?: number;
  /** Whether a positive delta is good (default) or bad (e.g. cost). */
  positiveIsGood?: boolean;
  hint?: string;
  index?: number;
  animateValue?: boolean;
}

/** Single KPI stat tile with an optional trend delta. */
export function KpiCard({
  label,
  value,
  icon: Icon,
  delta,
  positiveIsGood = true,
  hint,
  index = 0,
  animateValue = true,
}: KpiCardProps) {
  const isUp = (delta ?? 0) >= 0;
  const isGood = positiveIsGood ? isUp : !isUp;

  // Extract numeric part for animation
  const match = value.match(/^([^0-9\-\.]*)([0-9,\.]+)(.*)$/);
  const prefix = match ? match[1] : "";
  const numericStr = match ? match[2].replace(/,/g, "") : "0";
  const numericPart = parseFloat(numericStr);
  const suffix = match ? match[3] : "";

  const animatedNum = useAnimatedNumber(numericPart, 1000, animateValue && !!match && !isNaN(numericPart));
  
  let displayValue = value;
  if (match && animateValue && !isNaN(numericPart)) {
    const isInteger = !match[2].includes(".");
    const fractionDigits = isInteger ? 0 : match[2].split(".")[1].length;
    displayValue = `${prefix}${animatedNum.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}${suffix}`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04, ease: "easeOut" }}
    >
      <Card className="transition-shadow hover-lift gradient-accent glass-card">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <div className="rounded-md bg-primary/10 p-1.5 text-primary">
              <Icon className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{displayValue}</p>
          <div className="mt-1 flex items-center gap-1.5 text-xs">
            {delta !== undefined && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-medium",
                  isGood ? "text-success" : "text-destructive",
                )}
              >
                {isUp ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                {Math.abs(delta).toFixed(1)}%
              </span>
            )}
            {hint && <span className="text-muted-foreground">{hint}</span>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
