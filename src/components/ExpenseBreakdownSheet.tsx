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
import { getMyGroups, getGroupExpenses, getSplitsForGroup, getProfilesByIds } from "@/lib/api";
import type { Expense, ExpenseSplit } from "@/lib/app-types";
import { computePairwiseLedger } from "@/lib/ledger";
import { CountUpCurrency } from "@/components/CountUpCurrency";

function getExpenseIcon(description: string): string {
  const desc = description.toLowerCase();
  if (
    desc.includes("settlement") ||
    desc.includes("paid") ||
    desc.includes("upi") ||
    desc.includes("cash")
  )
    return "💸";
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
      const expenseArrays = await Promise.all(groups.map((g) => getGroupExpenses(g.id)));
      const allExpenses: Expense[] = expenseArrays.flat();

      const splitsArrays = await Promise.all(groups.map((g) => getSplitsForGroup(g.id)));
      const splits = splitsArrays.flat();

      const splitsByExpense: Record<string, ExpenseSplit[]> = {};
      for (const s of splits) {
        (splitsByExpense[s.expense_id] ??= []).push(s);
      }
      const profiles = await getProfilesByIds([currentUserId, counterpartyId]);
      const profileMap = new Map(profiles.map((p) => [p.id, p]));
      return { allExpenses, splitsByExpense, profileMap };
    },
  });

  const { allExpenses = [], splitsByExpense = {}, profileMap = new Map() } = data ?? {};

  // Compute the running pairwise ledger since last full settlement (newest first)
  const ledger = computePairwiseLedger(currentUserId, counterpartyId, allExpenses, splitsByExpense);

  const ledgerItems = ledger.items;
  const totalShared = ledger.totalSharedAmount;
  const expensesCount = ledger.totalExpensesCount;

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
          ) : ledgerItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No new expenses since last settlement.
            </div>
          ) : (
            <div className="space-y-2.5">
              {ledgerItems.map((item) => {
                let addedBy = "You";
                if (item.paidBy === counterpartyId) {
                  const p = profileMap.get(counterpartyId);
                  addedBy = p?.full_name?.trim() || p?.username?.trim() || displayName;
                } else if (item.paidBy !== currentUserId) {
                  const p = profileMap.get(item.paidBy);
                  addedBy = p?.full_name?.trim() || p?.username?.trim() || "Someone";
                }

                const isPaidByMe = item.paidBy === currentUserId;
                const cardStyle = isPaidByMe
                  ? "bg-[rgba(16,185,129,0.06)] border-[rgba(16,185,129,0.15)] hover:bg-[rgba(16,185,129,0.10)]"
                  : "bg-[rgba(239,68,68,0.06)] border-[rgba(239,68,68,0.15)] hover:bg-[rgba(239,68,68,0.10)]";

                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-colors ${cardStyle}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-lg">
                        {getExpenseIcon(item.cleanDescription)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate text-foreground">
                          {item.cleanDescription}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <span>
                            {item.isSettlement
                              ? isPaidByMe
                                ? "Paid by You"
                                : `Paid by ${addedBy}`
                              : `Added by ${addedBy}`}
                          </span>
                          <span>•</span>
                          <span>{format(new Date(item.createdAt), "d MMM")}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-xs text-muted-foreground">
                        {item.isSettlement ? "Settlement" : `Total Bill ₹${item.amount.toFixed(2)}`}
                      </p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">
                        {item.isSettlement
                          ? `₹${item.amount.toFixed(2)}`
                          : `Your Share ₹${item.yourShare.toFixed(2)}`}
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
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Expenses</p>
              <p className="text-base font-bold font-display mt-0.5">{expensesCount}</p>
            </div>
            <div className="bg-secondary/40 p-2.5 rounded-xl border border-border/40">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                Total Shared
              </p>
              <p className="text-base font-bold font-display mt-0.5">₹{totalShared.toFixed(2)}</p>
            </div>
            <div className="bg-primary/10 p-2.5 rounded-xl border border-primary/20">
              <p className="text-[10px] font-semibold uppercase text-primary">Remaining</p>
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
