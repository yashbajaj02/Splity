import type { Expense, ExpenseSplit } from "./app-types";

export interface RawDebt {
  from: string; // debtor user id
  to: string; // creditor user id
  amount: number;
}

export interface SimplifiedDebt {
  from: string;
  to: string;
  amount: number;
}

/**
 * Turn expenses + splits into net balances per user (positive = is owed money,
 * negative = owes money) for a given set of members.
 */
export function computeNetBalances(
  expenses: Expense[],
  splitsByExpense: Record<string, ExpenseSplit[]>,
): Record<string, number> {
  const balances: Record<string, number> = {};
  const add = (uid: string, amt: number) => {
    balances[uid] = (balances[uid] ?? 0) + amt;
  };

  for (const exp of expenses) {
    const splits = splitsByExpense[exp.id] ?? [];
    // Payer fronted the whole amount -> they are owed it.
    add(exp.paid_by, Number(exp.amount));
    // Each person owes their split.
    for (const s of splits) {
      add(s.user_id, -Number(s.amount_owed));
    }
  }

  // Round to 2 decimals to avoid float dust.
  for (const k of Object.keys(balances)) {
    balances[k] = Math.round(balances[k] * 100) / 100;
  }
  return balances;
}

/**
 * Debt simplification: given net balances, produce the minimum set of
 * transactions so that everyone is settled. This collapses chains like
 * A owes B, B owes C into A owes C directly.
 *
 * Greedy min-cash-flow: repeatedly settle the biggest creditor with the
 * biggest debtor.
 */
export function simplifyDebts(balances: Record<string, number>): SimplifiedDebt[] {
  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];

  for (const [id, bal] of Object.entries(balances)) {
    if (bal > 0.009) creditors.push({ id, amount: bal });
    else if (bal < -0.009) debtors.push({ id, amount: -bal });
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const result: SimplifiedDebt[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const settled = Math.min(debtor.amount, creditor.amount);

    result.push({
      from: debtor.id,
      to: creditor.id,
      amount: Math.round(settled * 100) / 100,
    });

    debtor.amount -= settled;
    creditor.amount -= settled;

    if (debtor.amount < 0.009) i++;
    if (creditor.amount < 0.009) j++;
  }

  return result.filter((d) => d.amount > 0);
}

/** Build the standard UPI deep link used to render a payment QR code. */
export function buildUpiUri(opts: {
  payeeUpiId: string;
  payeeName?: string;
  amount: number;
  note?: string;
}): string {
  const params = new URLSearchParams();
  params.set("pa", opts.payeeUpiId);
  if (opts.payeeName) params.set("pn", opts.payeeName);
  params.set("am", opts.amount.toFixed(2));
  params.set("cu", "INR");
  if (opts.note) params.set("tn", opts.note);
  return `upi://pay?${params.toString()}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}
