import { useQuery } from "@tanstack/react-query";
import {
  getMyGroups,
  getGroupExpenses,
  getSplitsForExpenses,
  getProfilesByIds,
} from "@/lib/api";
import type { Expense, ExpenseSplit, Profile } from "@/lib/app-types";
import { computeNetBalances, simplifyDebts } from "@/lib/debt";

export interface Balance {
  profile: Profile | undefined;
  counterpartyId: string;
  amount: number;
}

export function useSettleBalances(userId: string) {
  return useQuery({
    queryKey: ["settle", userId],
    queryFn: async () => {
      const groups = await getMyGroups(userId);
      const expenseArrays = await Promise.all(
        groups.map((g) => getGroupExpenses(g.id)),
      );
      const allExpenses: Expense[] = expenseArrays.flat();
      const splits = await getSplitsForExpenses(allExpenses.map((e) => e.id));

      const splitsByExpense: Record<string, ExpenseSplit[]> = {};
      for (const s of splits) {
        (splitsByExpense[s.expense_id] ??= []).push(s);
      }

      const balances = computeNetBalances(allExpenses, splitsByExpense);
      const simplified = simplifyDebts(balances);

      const iOwe = simplified
        .filter((d) => d.from === userId)
        .map((d) => ({ counterpartyId: d.to, amount: d.amount }));
      const owedToMe = simplified
        .filter((d) => d.to === userId)
        .map((d) => ({ counterpartyId: d.from, amount: d.amount }));

      const ids = Array.from(
        new Set([...iOwe, ...owedToMe].map((x) => x.counterpartyId)),
      );
      const profiles = await getProfilesByIds(ids);
      const pmap = new Map(profiles.map((p) => [p.id, p]));

      return {
        iOwe: iOwe.map<Balance>((x) => ({
          ...x,
          profile: pmap.get(x.counterpartyId),
        })),
        owedToMe: owedToMe.map<Balance>((x) => ({
          ...x,
          profile: pmap.get(x.counterpartyId),
        })),
      };
    },
  });
}
