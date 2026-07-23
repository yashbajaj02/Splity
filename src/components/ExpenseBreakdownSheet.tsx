import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import {
  getMyGroups,
  getGroupExpenses,
  getSplitsForExpenses,
  getProfilesByIds,
} from "@/lib/api";
import type { Expense, ExpenseSplit } from "@/lib/app-types";
import { CountUpCurrency } from "@/components/CountUpCurrency";

function getExpenseIcon(description: string): string {
  const desc = description.toLowerCase();
  if (
    desc.includes("pizza") ||
    desc.includes("food") ||
    desc.includes("lunch") ||
    desc.includes("dinner") ||
    desc.includes("restaurant") ||
    desc.includes("cafe")
  )
    return "🍕";
  if (
    desc.includes("milk") ||
    desc.includes("grocery") ||
    desc.includes("groceries") ||
    desc.includes("store")
  )
    return "🥛";
  if (
    desc.includes("coffee") ||
    desc.includes("tea") ||
    desc.includes("chai") ||
    desc.includes("starbucks")
  )
    return "☕";
  if (
    desc.includes("cab") ||
    desc.includes("uber") ||
    desc.includes("ola") ||
    desc.includes("taxi") ||
    desc.includes("auto") ||
    desc.includes("travel") ||
    desc.includes("bus") ||
    desc.includes("flight")
  )
    return "🚕";
  if (
    desc.includes("rent") ||
    desc.includes("flat") ||
    desc.includes("house") ||
    desc.includes("room") ||
    desc.includes("hostel")
  )
    return "🏠";
  if (
    desc.includes("bill") ||
    desc.includes("wifi") ||
    desc.includes("electricity") ||
    desc.includes("power") ||
    desc.includes("water") ||
    desc.includes("recharge")
  )
    return "⚡";
  if (
    desc.includes("movie") ||
    desc.includes("cinema") ||
    desc.includes("film") ||
    desc.includes("netflix") ||
    desc.includes("show")
  )
    return "🎬";
  if (
    desc.includes("beer") ||
    desc.includes("drink") ||
    desc.includes("pub") ||
    desc.includes("party")
  )
    return "🍺";
  return "🧾";
}

interface ExpenseBreakdownSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  counterpartyId: string;
  displayName: string;
  groupName?: string | null;
  balanceAmount: number;
}

export function ExpenseBreakdownSheet({
  open,
  onOpenChange,
  currentUserId,
  counterpartyId,
  displayName,
  groupName,
  balanceAmount,
}: ExpenseBreakdownSheetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["expense-breakdown", currentUserId, counterpartyId],
    enabled: open,
    queryFn: async () => {
      const groups = await getMyGroups(currentUserId);
      const expenseArrays = await Promise.all(
        groups.map((g) => getGroupExpenses(g.id)),
      );
      const allExpenses: Expense[] = expenseArrays.flat();
      const splits = await getSplitsForExpenses(allExpenses.map((e) => e.id));
      const splitsByExpense: Record<string, ExpenseSplit[]> = {};
      for (const s of splits) {
        (splitsByExpense[s.expense_id] ??= []).push(s);
      }
      const profiles = await getProfilesByIds([currentUserId, counterpartyId]);
      const profileMap = new Map(profiles.map((p) => [p.id, p]));
      return { allExpenses, splitsByExpense, profileMap };
    },
  });

  const { allExpenses = [], splitsByExpense = {}, profileMap = new Map() } =
    data ?? {};

  // 1. Filter expenses that involve BOTH currentUserId and counterpartyId
  const relevantExpenses = allExpenses.filter((expense) => {
    const splits = splitsByExpense[expense.id] ?? [];
    const userIdsInSplits = new Set(splits.map((s) => s.user_id));
    userIdsInSplits.add(expense.paid_by);
    return userIdsInSplits.has(currentUserId) && userIdsInSplits.has(counterpartyId);
  });

  // Sort chronological ascending
  relevantExpenses.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  // 2. Find last settlement timestamp
  let lastSettlementTime = 0;
  for (const exp of relevantExpenses) {
    const isSettlement =
      exp.description.toLowerCase().includes("settlement") ||
      exp.description.toLowerCase().includes("paid");
    if (isSettlement) {
      const t = new Date(exp.created_at).getTime();
      if (t > lastSettlementTime) {
        lastSettlementTime = t;
      }
    }
  }

  // 3. Keep non-settlement expenses created AFTER last settlement
  const filteredExpenses = relevantExpenses.filter((exp) => {
    const isSettlement =
      exp.description.toLowerCase().includes("settlement") ||
      exp.description.toLowerCase().includes("paid");
    if (isSettlement) return false;
    if (lastSettlementTime > 0) {
      return new Date(exp.created_at).getTime() > lastSettlementTime;
    }
    return true;
  });

  const totalShared = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-md mx-auto max-h-[85vh] rounded-t-[24px]">
        <DrawerHeader className="px-6 pt-2 pb-4 text-left border-b border-border/50">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <DrawerTitle className="font-display text-xl font-bold truncate">
                {displayName}
              </DrawerTitle>
              {groupName && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[240px]">
                  {groupName}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Current Balance
              </p>
              <p className="text-lg font-display font-bold text-primary mt-0.5">
                <CountUpCurrency amount={balanceAmount} />
              </p>
            </div>
          </div>
        </DrawerHeader>

        <div className="p-6 overflow-y-auto space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border/60" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
              Since Last Settlement
            </span>
            <div className="h-px flex-1 bg-border/60" />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No new expenses since last settlement.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredExpenses.map((exp) => {
                const splits = splitsByExpense[exp.id] ?? [];
                let yourShare = 0;

                if (exp.paid_by === currentUserId) {
                  const selfSplit = splits.find((s) => s.user_id === currentUserId);
                  if (selfSplit) {
                    yourShare = Number(selfSplit.amount_owed);
                  } else {
                    const othersOwed = splits
                      .filter((s) => s.user_id !== currentUserId)
                      .reduce((sum, s) => sum + Number(s.amount_owed), 0);
                    yourShare = Number(exp.amount) - othersOwed;
                  }
                } else {
                  const selfSplit = splits.find((s) => s.user_id === currentUserId);
                  yourShare = selfSplit ? Number(selfSplit.amount_owed) : 0;
                }

                let addedBy = "You";
                if (exp.paid_by === counterpartyId) {
                  const p = profileMap.get(counterpartyId);
                  addedBy = p?.full_name?.trim() || p?.username?.trim() || displayName;
                } else if (exp.paid_by !== currentUserId) {
                  const p = profileMap.get(exp.paid_by);
                  addedBy = p?.full_name?.trim() || p?.username?.trim() || "Someone";
                }

                return (
                  <div
                    key={exp.id}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-card/60 hover:bg-secondary/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-lg">
                        {getExpenseIcon(exp.description)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate text-foreground">
                          {exp.description}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <span>Added by {addedBy}</span>
                          <span>•</span>
                          <span>{format(new Date(exp.created_at), "d MMM")}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-xs text-muted-foreground">
                        Total Bill ₹{Number(exp.amount).toFixed(2)}
                      </p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">
                        Your Share ₹{yourShare.toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DrawerFooter className="border-t border-border/50 px-6 py-4 bg-card/40">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-secondary/40 p-2.5 rounded-xl border border-border/40">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                Expenses
              </p>
              <p className="text-base font-bold font-display mt-0.5">
                {filteredExpenses.length}
              </p>
            </div>
            <div className="bg-secondary/40 p-2.5 rounded-xl border border-border/40">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                Total Shared
              </p>
              <p className="text-base font-bold font-display mt-0.5">
                ₹{totalShared.toFixed(2)}
              </p>
            </div>
            <div className="bg-primary/10 p-2.5 rounded-xl border border-primary/20">
              <p className="text-[10px] font-semibold uppercase text-primary">
                Remaining
              </p>
              <p className="text-base font-bold font-display text-primary mt-0.5">
                ₹{balanceAmount.toFixed(2)}
              </p>
            </div>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
