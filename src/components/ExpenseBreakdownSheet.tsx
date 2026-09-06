import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, X, Check } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
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
import { QrPayDialog } from "@/components/QrPayDialog";
import { PaidDialog } from "@/components/PaidDialog";

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

export interface ExpenseBreakdownSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  counterpartyId: string;
  displayName: string;
  groupName?: string | null;
  balanceAmount: number;
  negative?: boolean;
  groupId?: string | null;
  payeeUpiId?: string | null;
  onRemind?: () => void;
  remindBusy?: boolean;
  remindSent?: boolean;
}

export function ExpenseBreakdownSheet({
  open,
  onOpenChange,
  currentUserId,
  counterpartyId,
  displayName,
  groupName,
  balanceAmount,
  negative,
  groupId,
  payeeUpiId,
  onRemind,
  remindBusy,
  remindSent,
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
      <DrawerContent className="max-w-md mx-auto max-h-[88vh] rounded-t-[28px] overflow-hidden flex flex-col p-0 bg-white">
        {/* Header Pinned At Top */}
        <DrawerHeader className="px-6 pt-5 pb-4 text-left border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between gap-3 w-full">
            <div className="min-w-0 flex-1">
              <DrawerTitle className="font-display text-xl font-bold text-slate-900 truncate">
                {displayName}
              </DrawerTitle>
              {groupName && (
                <p className="text-xs text-slate-400 font-medium mt-0.5 truncate max-w-[220px]">
                  {groupName}
                </p>
              )}
            </div>

            {/* Top Action Buttons (Remind for positive, Pay/Paid for negative) */}
            <div className="flex items-center gap-2 shrink-0">
              {negative ? (
                <>
                  {/* 1. Pay Button -> connects to existing UPI/Cash QrPayDialog */}
                  <QrPayDialog
                    payeeName={displayName}
                    payeeUpiId={payeeUpiId ?? profileMap.get(counterpartyId)?.upi_id ?? null}
                    amount={balanceAmount}
                    note="Splity settlement"
                    currentUserId={currentUserId}
                    counterpartyId={counterpartyId}
                    groupId={groupId ?? undefined}
                    trigger={
                      <button
                        type="button"
                        className="px-4 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all duration-150 active:scale-[0.98] hover:scale-[1.02] hover:shadow-md animate-settle-glow flex items-center gap-1.5"
                      >
                        <span>Pay</span>
                      </button>
                    }
                  />
                  {/* 2. Paid Button -> connects to existing PaidDialog */}
                  <PaidDialog
                    payeeName={displayName}
                    groupName={groupName ?? undefined}
                    amount={balanceAmount}
                    groupId={groupId ?? null}
                    payeeId={counterpartyId}
                    payerId={currentUserId}
                    trigger={
                      <button
                        type="button"
                        className="px-4 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200/80 transition-all duration-150 active:scale-[0.98] hover:scale-[1.02] hover:shadow-xs flex items-center gap-1.5"
                      >
                        <span>Paid</span>
                      </button>
                    }
                  />
                </>
              ) : (
                /* Remind Button -> connects to existing reminder flow */
                <button
                  type="button"
                  disabled={remindBusy || remindSent}
                  onClick={onRemind}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-150 active:scale-[0.98] hover:scale-[1.02] flex items-center gap-1.5",
                    remindSent
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-default"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow-md",
                  )}
                >
                  {remindSent ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Sent</span>
                    </>
                  ) : (
                    <span>Remind</span>
                  )}
                </button>
              )}
            </div>
          </div>
        </DrawerHeader>

        {/* Scrollable Expense History */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
              Since Last Settlement
            </span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : ledgerItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400 font-medium">
              No new expenses since last settlement.
            </div>
          ) : (
            <div className="space-y-2.5">
              {ledgerItems.map((item, index) => {
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
                  ? "bg-emerald-50/50 border-emerald-100/80 hover:bg-emerald-100/70 hover:border-emerald-300/80"
                  : "bg-rose-50/50 border-rose-100/80 hover:bg-rose-100/70 hover:border-rose-300/80";

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      duration: 0.22,
                      delay: Math.min(index * 0.04, 0.25),
                      ease: "easeOut",
                    }}
                    className={cn(
                      "flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-150 select-none hover:-translate-y-0.5 hover:shadow-xs cursor-pointer",
                      cardStyle,
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white border border-slate-100 text-base shadow-2xs">
                        {getExpenseIcon(item.cleanDescription)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs sm:text-sm truncate text-slate-900">
                          {item.cleanDescription}
                        </p>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium mt-0.5">
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
                      <p className="text-[11px] text-slate-400 font-medium">
                        {item.isSettlement ? "Settlement" : `Total ₹${item.amount.toFixed(2)}`}
                      </p>
                      <p
                        className={cn(
                          "text-xs sm:text-sm font-display font-bold mt-0.5",
                          isPaidByMe ? "text-emerald-600" : "text-rose-600",
                        )}
                      >
                        {item.isSettlement
                          ? `₹${item.amount.toFixed(2)}`
                          : `Your share ₹${item.yourShare.toFixed(2)}`}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fixed Remaining Amount At Bottom */}
        <DrawerFooter className="border-t border-slate-100 px-5 py-3.5 bg-slate-50/60 shrink-0">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white p-2.5 rounded-2xl border border-slate-200/70 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Expenses</p>
              <p className="text-sm sm:text-base font-bold font-display text-slate-800 mt-0.5">
                {expensesCount}
              </p>
            </div>
            <div className="bg-white p-2.5 rounded-2xl border border-slate-200/70 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total Shared
              </p>
              <p className="text-sm sm:text-base font-bold font-display text-slate-800 mt-0.5">
                ₹{totalShared.toFixed(2)}
              </p>
            </div>
            <div
              className={cn(
                "p-2.5 rounded-2xl border shadow-2xs",
                negative
                  ? "bg-rose-50 border-rose-200 text-rose-700"
                  : "bg-emerald-50 border-emerald-200 text-emerald-700",
              )}
            >
              <p
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  negative ? "text-rose-500" : "text-emerald-600",
                )}
              >
                Remaining
              </p>
              <p
                className={cn(
                  "text-sm sm:text-base font-bold font-display mt-0.5",
                  negative ? "text-rose-600" : "text-emerald-600",
                )}
              >
                ₹{balanceAmount.toFixed(2)}
              </p>
            </div>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
