import type { Expense, ExpenseSplit } from "./app-types";

export interface PaymentHistoryEntry {
  amount: number;
  date: string;
}

export interface BreakdownExpense {
  expense: Expense;
  yourShare: number;
  paidAmount: number;
  remainingAmount: number;
  status: "Pending" | "Partially Settled" | "Fully Settled";
  payments: PaymentHistoryEntry[];
}

export function computeExpenseBreakdown(
  currentUserId: string,
  counterpartyId: string,
  allExpenses: Expense[],
  splitsByExpense: Record<string, ExpenseSplit[]>,
): BreakdownExpense[] {
  // 1. Filter expenses involving both users, chronological ascending
  const relevantExpenses = allExpenses
    .filter((expense) => {
      const splits = splitsByExpense[expense.id] ?? [];
      const userIdsInSplits = new Set(splits.map((s) => s.user_id));
      userIdsInSplits.add(expense.paid_by);
      return userIdsInSplits.has(currentUserId) && userIdsInSplits.has(counterpartyId);
    })
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const breakdown: BreakdownExpense[] = [];

  // To accumulate payments made BY currentUserId TO counterpartyId
  const settlementPayments: Record<string, PaymentHistoryEntry[]> = {}; // expenseId -> payments
  let genericPaymentPool = 0; // for older settlements without JSON

  // First pass: aggregate all settlements
  for (const exp of relevantExpenses) {
    const descLower = exp.description.toLowerCase();
    const isSettlement = descLower.includes("settlement") || descLower.includes("paid");

    if (isSettlement) {
      if (exp.paid_by === currentUserId) {
        // I paid them
        const splits = splitsByExpense[exp.id] ?? [];
        const theirSplit = splits.find((s) => s.user_id === counterpartyId);
        const amount = theirSplit ? Number(theirSplit.amount_owed) : Number(exp.amount);

        // Parse JSON from description if exists
        const parts = exp.description.split("||");
        if (parts.length > 1) {
          try {
            const json = JSON.parse(parts[1].trim());
            if (json.settled && typeof json.settled === "object") {
              for (const [eId, amt] of Object.entries(json.settled)) {
                if (!settlementPayments[eId]) settlementPayments[eId] = [];
                settlementPayments[eId].push({ amount: Number(amt), date: exp.created_at });
              }
              continue; // fully mapped
            }
          } catch (e) {
            // Ignore parse errors, treat as generic pool
          }
        }

        // If no JSON or parse failed, add to generic pool
        genericPaymentPool += amount;
      }
    }
  }

  // Second pass: Calculate remaining shares for non-settlement expenses
  for (const exp of relevantExpenses) {
    const descLower = exp.description.toLowerCase();
    const isSettlement = descLower.includes("settlement") || descLower.includes("paid");

    if (isSettlement) continue;

    // Calculate your share (how much you owe counterparty)
    // Only matters if counterparty paid and you owe them
    let yourShare = 0;
    if (exp.paid_by === counterpartyId) {
      const splits = splitsByExpense[exp.id] ?? [];
      const mySplit = splits.find((s) => s.user_id === currentUserId);
      if (mySplit) {
        yourShare = Number(mySplit.amount_owed);
      }
    }

    if (yourShare <= 0) continue; // Only care about debts from me to them

    const payments = settlementPayments[exp.id] || [];
    let paid = payments.reduce((acc, p) => acc + p.amount, 0);
    let remaining = yourShare - paid;

    // Apply generic pool if needed
    if (remaining > 0 && genericPaymentPool > 0) {
      const applyAmt = Math.min(remaining, genericPaymentPool);
      payments.push({ amount: applyAmt, date: exp.created_at }); // use exp date as fallback, or something
      paid += applyAmt;
      remaining -= applyAmt;
      genericPaymentPool -= applyAmt;
    }

    remaining = Math.max(0, remaining);

    let status: "Pending" | "Partially Settled" | "Fully Settled" = "Pending";
    if (remaining === 0) status = "Fully Settled";
    else if (paid > 0) status = "Partially Settled";

    breakdown.push({
      expense: exp,
      yourShare,
      paidAmount: paid,
      remainingAmount: remaining,
      status,
      payments,
    });
  }

  return breakdown;
}
