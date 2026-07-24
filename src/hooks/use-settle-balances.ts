import { useQuery } from "@tanstack/react-query";
import {
  getMyGroups,
  getGroupMembers,
  getGroupExpenses,
  getSplitsForExpenses,
  getProfilesByIds,
} from "@/lib/api";
import type { Expense, ExpenseSplit, Profile } from "@/lib/app-types";
import { computePairwiseDebts } from "@/lib/debt";

export interface Balance {
  profile: Profile | undefined;
  counterpartyId: string;
  settlementGroupId: string | null;
  settlementGroupName: string | null;
  amount: number;
}

export function useSettleBalances(userId: string) {
  return useQuery({
    queryKey: ["settle", userId],
    queryFn: async () => {
      const groups = await getMyGroups(userId);
      const expenseArrays = await Promise.all(groups.map((g) => getGroupExpenses(g.id)));
      const allExpenses: Expense[] = expenseArrays.flat();
      const splits = await getSplitsForExpenses(allExpenses.map((e) => e.id));

      const splitsByExpense: Record<string, ExpenseSplit[]> = {};
      for (const s of splits) {
        (splitsByExpense[s.expense_id] ??= []).push(s);
      }

      const pairwiseDebts = computePairwiseDebts(allExpenses, splitsByExpense);

      const iOwe = pairwiseDebts
        .filter((d) => d.from === userId)
        .map((d) => ({ counterpartyId: d.to, amount: d.amount }));
      const owedToMe = pairwiseDebts
        .filter((d) => d.to === userId)
        .map((d) => ({ counterpartyId: d.from, amount: d.amount }));

      const ids = Array.from(new Set([...iOwe, ...owedToMe].map((x) => x.counterpartyId)));
      const profiles = await getProfilesByIds(ids);
      const pmap = new Map(profiles.map((p) => [p.id, p]));

      const memberArrays = await Promise.all(
        groups.map(async (group) => ({
          group,
          members: await getGroupMembers(group.id),
        })),
      );
      const groupInfoByCounterparty = new Map<string, { id: string; name: string }>();
      for (const { group, members } of memberArrays) {
        const acceptedIds = new Set(
          members.filter((m) => m.status === "accepted").map((m) => m.user_id),
        );
        if (!acceptedIds.has(userId)) continue;
        for (const id of ids) {
          if (acceptedIds.has(id) && !groupInfoByCounterparty.has(id)) {
            groupInfoByCounterparty.set(id, { id: group.id, name: group.name });
          }
        }
      }

      return {
        iOwe: iOwe.map<Balance>((x) => {
          const g = groupInfoByCounterparty.get(x.counterpartyId);
          return {
            ...x,
            profile: pmap.get(x.counterpartyId),
            settlementGroupId: g?.id ?? null,
            settlementGroupName: g?.name ?? null,
          };
        }),
        owedToMe: owedToMe.map<Balance>((x) => {
          const g = groupInfoByCounterparty.get(x.counterpartyId);
          return {
            ...x,
            profile: pmap.get(x.counterpartyId),
            settlementGroupId: g?.id ?? null,
            settlementGroupName: g?.name ?? null,
          };
        }),
      };
    },
    enabled: !!userId,
  });
}
