import { k as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { d as getMyGroups, g as getSplitsForExpenses, h as getProfilesByIds, l as getGroupExpenses, u as getGroupMembers } from "./api-K9Bdh_wb.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { C as ArrowUpRight, T as ArrowDownLeft } from "../_libs/lucide-react.mjs";
import { t as CountUpCurrency, u as computePairwiseDebts } from "./CountUpCurrency-CAkKtbv2.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/BalanceSummaryCards-CCq9N0V-.js
var import_jsx_runtime = require_jsx_runtime();
function useSettleBalances(userId) {
	return useQuery({
		queryKey: ["settle", userId],
		queryFn: async () => {
			const groups = await getMyGroups(userId);
			const allExpenses = (await Promise.all(groups.map((g) => getGroupExpenses(g.id)))).flat();
			const splits = await getSplitsForExpenses(allExpenses.map((e) => e.id));
			const splitsByExpense = {};
			for (const s of splits) (splitsByExpense[s.expense_id] ??= []).push(s);
			const pairwiseDebts = computePairwiseDebts(allExpenses, splitsByExpense);
			const iOwe = pairwiseDebts.filter((d) => d.from === userId).map((d) => ({
				counterpartyId: d.to,
				amount: d.amount
			}));
			const owedToMe = pairwiseDebts.filter((d) => d.to === userId).map((d) => ({
				counterpartyId: d.from,
				amount: d.amount
			}));
			const ids = Array.from(new Set([...iOwe, ...owedToMe].map((x) => x.counterpartyId)));
			const profiles = await getProfilesByIds(ids);
			const pmap = new Map(profiles.map((p) => [p.id, p]));
			const memberArrays = await Promise.all(groups.map(async (group) => ({
				groupId: group.id,
				members: await getGroupMembers(group.id)
			})));
			const groupIdsByCounterparty = /* @__PURE__ */ new Map();
			for (const { groupId, members } of memberArrays) {
				const acceptedIds = new Set(members.filter((m) => m.status === "accepted").map((m) => m.user_id));
				if (!acceptedIds.has(userId)) continue;
				for (const id of ids) if (acceptedIds.has(id) && !groupIdsByCounterparty.has(id)) groupIdsByCounterparty.set(id, groupId);
			}
			return {
				iOwe: iOwe.map((x) => ({
					...x,
					profile: pmap.get(x.counterpartyId),
					settlementGroupId: groupIdsByCounterparty.get(x.counterpartyId) ?? null
				})),
				owedToMe: owedToMe.map((x) => ({
					...x,
					profile: pmap.get(x.counterpartyId),
					settlementGroupId: groupIdsByCounterparty.get(x.counterpartyId) ?? null
				}))
			};
		}
	});
}
function BalanceSummaryCards({ totalOwe, totalOwed }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid grid-cols-2 gap-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rounded-2xl border border-border bg-card p-4 shadow-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-1.5 text-xs font-medium text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpRight, { className: "h-3.5 w-3.5 text-destructive" }), " You owe"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 font-display text-xl font-bold text-destructive",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CountUpCurrency, { amount: totalOwe })
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rounded-2xl border border-border bg-card p-4 shadow-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-1.5 text-xs font-medium text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDownLeft, { className: "h-3.5 w-3.5 text-success" }), " You're owed"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 font-display text-xl font-bold text-success",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CountUpCurrency, { amount: totalOwed })
			})]
		})]
	});
}
//#endregion
export { useSettleBalances as n, BalanceSummaryCards as t };
