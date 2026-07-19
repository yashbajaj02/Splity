import type { Expense, ExpenseSplit, PairwiseDebt } from "./app-types";

function normalizeAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function computePairwiseDebts(
  expenses: Expense[],
  splitsByExpense: Record<string, ExpenseSplit[]>,
): PairwiseDebt[] {
  const pairBalances = new Map<string, number>();

  for (const expense of expenses) {
    const splits = splitsByExpense[expense.id] ?? [];
    for (const split of splits) {
      const owed = Number(split.amount_owed);
      if (owed <= 0 || split.user_id === expense.paid_by) continue;
      const key = `${split.user_id}->${expense.paid_by}`;
      pairBalances.set(key, (pairBalances.get(key) ?? 0) + owed);
    }
  }

  const normalizedPairs = new Map<string, number>();
  for (const [key, amount] of pairBalances.entries()) {
    const [from, to] = key.split("->");
    const reverseKey = `${to}->${from}`;
    const reverseAmount = pairBalances.get(reverseKey) ?? 0;
    if (normalizedPairs.has(key) || normalizedPairs.has(reverseKey)) continue;

    const net = normalizeAmount(amount - reverseAmount);
    if (net > 0.009) normalizedPairs.set(key, net);
    else if (net < -0.009) normalizedPairs.set(reverseKey, Math.abs(net));
  }

  return Array.from(normalizedPairs.entries())
    .map(([key, amount]) => {
      const [from, to] = key.split("->");
      return { from, to, amount: normalizeAmount(amount) };
    })
    .sort((left, right) => right.amount - left.amount);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}
