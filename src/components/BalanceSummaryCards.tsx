import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { CountUpCurrency } from "@/components/CountUpCurrency";

export function BalanceSummaryCards({
  totalOwe,
  totalOwed,
}: {
  totalOwe: number;
  totalOwed: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <ArrowUpRight className="h-3.5 w-3.5 text-destructive" /> You owe
        </div>
        <p className="mt-1 font-display text-xl font-bold text-destructive">
          <CountUpCurrency amount={totalOwe} />
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <ArrowDownLeft className="h-3.5 w-3.5 text-success" /> You're owed
        </div>
        <p className="mt-1 font-display text-xl font-bold text-success">
          <CountUpCurrency amount={totalOwed} />
        </p>
      </div>
    </div>
  );
}
