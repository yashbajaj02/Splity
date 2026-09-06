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
    <div className="grid grid-cols-2 gap-3.5">
      <div className="glass-card rounded-2xl p-4 transition-transform duration-200 hover:scale-[1.01]">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </div>
          <span>You owe</span>
        </div>
        <p className="mt-2 font-display text-2xl font-bold tracking-tight text-destructive">
          <CountUpCurrency amount={totalOwe} />
        </p>
      </div>

      <div className="glass-card rounded-2xl p-4 transition-transform duration-200 hover:scale-[1.01]">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success/10 text-success">
            <ArrowDownLeft className="h-3.5 w-3.5" />
          </div>
          <span>You're owed</span>
        </div>
        <p className="mt-2 font-display text-2xl font-bold tracking-tight text-success">
          <CountUpCurrency amount={totalOwed} />
        </p>
      </div>
    </div>
  );
}
