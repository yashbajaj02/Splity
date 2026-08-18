import type { Expense, ExpenseSplit } from "./app-types";

export function getCleanExpenseDescription(rawDescription: string): string {
  if (!rawDescription) return "";
  const parts = rawDescription.split("||");
  return parts[0].trim();
}

export interface LedgerItem {
  id: string;
  expense: Expense;
  description: string;
  cleanDescription: string;
  isSettlement: boolean;
  paidBy: string;
  createdAt: string;
  amount: number;
  yourShare: number;
  counterpartyShare: number;
  netDelta: number;
  runningBalanceAfter: number;
}

export interface PairwiseLedgerResult {
  items: LedgerItem[];
  totalExpensesCount: number;
  totalSharedAmount: number;
  currentNetBalance: number;
}

/**
 * Computes the pairwise running ledger between currentUserId and counterpartyId.
 *
 * Rules:
 * 1. Tracks net balance chronologically across expenses and settlements.
 * 2. Whenever net balance reaches 0 (all debts cleared), that marks a full settlement boundary.
 * 3. Partial settlements reduce the balance without clearing history.
 * 4. The returned ledger contains all transactions since the last full settlement (or beginning),
 *    sorted newest first (descending by created_at).
 */
export function computePairwiseLedger(
  currentUserId: string,
  counterpartyId: string,
  allExpenses: Expense[],
  splitsByExpense: Record<string, ExpenseSplit[]>,
): PairwiseLedgerResult {
  if (!currentUserId || !counterpartyId || allExpenses.length === 0) {
    return {
      items: [],
      totalExpensesCount: 0,
      totalSharedAmount: 0,
      currentNetBalance: 0,
    };
  }

  // 1. Identify all transactions where direct pairwise debt or settlement exists between A and B
  const relevantList: LedgerItem[] = [];

  for (const exp of allExpenses) {
    const splits = splitsByExpense[exp.id] ?? [];
    const desc = exp.description || "";
    const cleanDesc = getCleanExpenseDescription(desc);
    const descLower = cleanDesc.toLowerCase();
    const isSettlement = descLower.includes("settlement") || descLower.includes("paid");

    let netDelta = 0;
    let yourShare = 0;
    let counterpartyShare = 0;

    if (exp.paid_by === currentUserId) {
      // Current user paid: find how much counterparty owes
      const bSplit = splits.find((s) => s.user_id === counterpartyId);
      const bOwed = bSplit ? Number(bSplit.amount_owed) : 0;

      if (bOwed > 0) {
        netDelta = +bOwed;
        counterpartyShare = bOwed;
      }

      if (isSettlement) {
        yourShare = Number(exp.amount);
      } else {
        const selfSplit = splits.find((s) => s.user_id === currentUserId);
        if (selfSplit) {
          yourShare = Number(selfSplit.amount_owed);
        } else {
          const othersOwed = splits
            .filter((s) => s.user_id !== currentUserId)
            .reduce((sum, s) => sum + Number(s.amount_owed), 0);
          yourShare = Math.max(0, Number(exp.amount) - othersOwed);
        }
      }
    } else if (exp.paid_by === counterpartyId) {
      // Counterparty paid: find how much current user owes
      const aSplit = splits.find((s) => s.user_id === currentUserId);
      const aOwed = aSplit ? Number(aSplit.amount_owed) : 0;

      if (aOwed > 0) {
        netDelta = -aOwed;
        yourShare = aOwed;
      }

      if (isSettlement) {
        counterpartyShare = Number(exp.amount);
      } else {
        const cpSplit = splits.find((s) => s.user_id === counterpartyId);
        if (cpSplit) {
          counterpartyShare = Number(cpSplit.amount_owed);
        } else {
          const othersOwed = splits
            .filter((s) => s.user_id !== counterpartyId)
            .reduce((sum, s) => sum + Number(s.amount_owed), 0);
          counterpartyShare = Math.max(0, Number(exp.amount) - othersOwed);
        }
      }
    }

    // Only include if this transaction creates direct debt or settlement between currentUserId & counterpartyId
    if (netDelta !== 0) {
      relevantList.push({
        id: exp.id,
        expense: exp,
        description: desc,
        cleanDescription: cleanDesc,
        isSettlement,
        paidBy: exp.paid_by,
        createdAt: exp.created_at,
        amount: Number(exp.amount),
        yourShare,
        counterpartyShare,
        netDelta,
        runningBalanceAfter: 0,
      });
    }
  }

  // 2. Sort chronological ascending to track running balance accurately
  relevantList.sort((a, b) => {
    const tA = new Date(a.createdAt).getTime();
    const tB = new Date(b.createdAt).getTime();
    if (tA !== tB) return tA - tB;
    return a.id.localeCompare(b.id);
  });

  // 3. Track running balance and find the last index where net balance was exactly 0
  let runningNet = 0;
  let lastZeroIndex = -1;

  for (let i = 0; i < relevantList.length; i++) {
    const item = relevantList[i];
    runningNet = Math.round((runningNet + item.netDelta) * 100) / 100;
    item.runningBalanceAfter = runningNet;

    if (Math.abs(runningNet) < 0.009) {
      runningNet = 0;
      lastZeroIndex = i;
    }
  }

  // 4. Slice active transactions since the last full settlement
  const activeItems = relevantList.slice(lastZeroIndex + 1);

  // 5. Sort newest first (descending by created_at)
  activeItems.sort((a, b) => {
    const tA = new Date(a.createdAt).getTime();
    const tB = new Date(b.createdAt).getTime();
    if (tA !== tB) return tB - tA;
    return b.id.localeCompare(a.id);
  });

  const totalExpensesCount = activeItems.filter((item) => !item.isSettlement).length;
  const totalSharedAmount = activeItems
    .filter((item) => !item.isSettlement)
    .reduce((sum, item) => sum + item.amount, 0);

  return {
    items: activeItems,
    totalExpensesCount,
    totalSharedAmount,
    currentNetBalance: runningNet,
  };
}
