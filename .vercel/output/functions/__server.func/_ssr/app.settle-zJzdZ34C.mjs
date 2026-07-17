import { k as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { r as useAuth } from "./use-auth-BtUVOn94.mjs";
import { C as settleByCash, S as sendSettlementRequest, w as settleByUpi } from "./api-K9Bdh_wb.mjs";
import { t as Button } from "./button-PwNqyxv_.mjs";
import { i as useQueryClient, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { b as Bell, f as LoaderCircle } from "../_libs/lucide-react.mjs";
import { t as CountUpCurrency } from "./CountUpCurrency-CAkKtbv2.mjs";
import { t as UpiQrDialog } from "./UpiQrDialog-C_jX33Y0.mjs";
import { n as useSettleBalances, t as BalanceSummaryCards } from "./BalanceSummaryCards-CCq9N0V-.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/app.settle-zJzdZ34C.js
var import_jsx_runtime = require_jsx_runtime();
function SettlePage() {
	const { session } = useAuth();
	const userId = session.user.id;
	const queryClient = useQueryClient();
	const query = useSettleBalances(userId);
	const remind = useMutation({
		mutationFn: (v) => sendSettlementRequest({
			recipientId: v.debtorId,
			senderId: userId,
			amount: v.amount,
			message: "Please settle up on SplitPay"
		}),
		onSuccess: () => {
			toast.success("Reminder sent!");
			queryClient.invalidateQueries({ queryKey: ["settle", userId] });
		},
		onError: (e) => toast.error(e.message)
	});
	const cashSettlement = useMutation({
		mutationFn: (v) => settleByCash({
			groupId: v.groupId,
			payerId: userId,
			payeeId: v.payeeId,
			amount: v.amount
		}),
		onSuccess: () => {
			toast.success("Cash payment recorded. They were notified.");
			queryClient.invalidateQueries({ queryKey: ["settle", userId] });
			queryClient.invalidateQueries({ queryKey: ["notifications"] });
		},
		onError: (e) => toast.error(e.message)
	});
	const upiSettlement = useMutation({
		mutationFn: (v) => settleByUpi({
			groupId: v.groupId,
			payerId: userId,
			payeeId: v.payeeId,
			amount: v.amount
		}),
		onSuccess: (_data, values) => {
			toast.success(`Payment of Rs ${values.amount.toFixed(2)} settled.`);
			queryClient.invalidateQueries({ queryKey: ["settle", userId] });
			queryClient.invalidateQueries({ queryKey: ["notifications"] });
		},
		onError: (e) => toast.error(e.message)
	});
	if (query.isLoading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex justify-center py-16",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-6 w-6 animate-spin text-primary" })
	});
	if (query.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3 py-16 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-xl font-bold",
				children: "Balances could not load"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: query.error.message
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				size: "sm",
				variant: "outline",
				onClick: () => query.refetch(),
				children: "Try again"
			})
		]
	});
	const data = query.data;
	const totalOwe = data.iOwe.reduce((s, b) => s + b.amount, 0);
	const totalOwed = data.owedToMe.reduce((s, b) => s + b.amount, 0);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-2xl font-bold",
				children: "Settle up"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: "Balances are simplified across all your groups."
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BalanceSummaryCards, {
				totalOwe,
				totalOwed
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "You owe",
				empty: "You don't owe anyone. Nice!",
				children: data.iOwe.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BalanceRow, {
					b,
					negative: true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UpiQrDialog, {
						payeeName: b.profile?.username ? `@${b.profile.username}` : "them",
						payeeUpiId: b.profile?.upi_id ?? null,
						amount: b.amount,
						note: "SplitPay settlement",
						onCashPaid: () => {
							if (!b.settlementGroupId) {
								toast.error("No shared group found to record this payment.");
								return;
							}
							cashSettlement.mutate({
								groupId: b.settlementGroupId,
								payeeId: b.counterpartyId,
								amount: b.amount
							});
						},
						cashDisabled: !b.settlementGroupId,
						cashBusy: cashSettlement.isPending,
						onUpiPaid: () => {
							if (!b.settlementGroupId) {
								toast.error("No shared group found to record this payment.");
								return;
							}
							upiSettlement.mutate({
								groupId: b.settlementGroupId,
								payeeId: b.counterpartyId,
								amount: b.amount
							});
						},
						upiBusy: upiSettlement.isPending
					})
				}, b.counterpartyId))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Owed to you",
				empty: "No one owes you right now.",
				children: data.owedToMe.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BalanceRow, {
					b,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						variant: "outline",
						disabled: remind.isPending,
						onClick: () => remind.mutate({
							debtorId: b.counterpartyId,
							amount: b.amount
						}),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "mr-1.5 h-4 w-4" }), " Remind"]
					})
				}, b.counterpartyId))
			})
		]
	});
}
function Section({ title, empty, children }) {
	const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "font-display text-sm font-semibold text-muted-foreground",
			children: title
		}), hasChildren ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "space-y-2",
			children
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "rounded-xl border border-dashed border-border bg-card/50 p-4 text-center text-sm text-muted-foreground",
			children: empty
		})]
	});
}
function BalanceRow({ b, negative, children }) {
	const name = b.profile?.username ? `@${b.profile.username}` : "Unknown user";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold uppercase text-primary",
				children: (b.profile?.username ?? "?").slice(0, 2)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "truncate font-semibold",
					children: name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: `text-sm font-medium ${negative ? "text-destructive" : "text-success"}`,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CountUpCurrency, { amount: b.amount })
				})]
			}),
			children
		]
	});
}
//#endregion
export { SettlePage as component };
