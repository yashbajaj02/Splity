import { r as __toESM } from "../_runtime.mjs";
import { A as require_react, k as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { r as useAuth } from "./use-auth-BtUVOn94.mjs";
import { d as getMyGroups, r as createGroup } from "./api-K9Bdh_wb.mjs";
import { r as cn, t as Button } from "./button-PwNqyxv_.mjs";
import { n as Label, t as Input } from "./label-DDmitfqC.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { _ as ChevronRight, f as LoaderCircle, l as Plus, n as Users } from "../_libs/lucide-react.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as DialogFooter, c as DialogTrigger, n as Dialog, o as DialogHeader, r as DialogContent, s as DialogTitle } from "./CountUpCurrency-CAkKtbv2.mjs";
import { n as AddExpenseFab } from "./AddExpenseDialog-fnih3W8S.mjs";
import { n as useSettleBalances, t as BalanceSummaryCards } from "./BalanceSummaryCards-CCq9N0V-.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/app.index-CrlBCD_J.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var Textarea = import_react.forwardRef(({ className, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
		className: cn("flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", className),
		ref,
		...props
	});
});
Textarea.displayName = "Textarea";
function GroupsHome() {
	const { session } = useAuth();
	const userId = session.user.id;
	const groupsQuery = useQuery({
		queryKey: ["my-groups", userId],
		queryFn: () => getMyGroups(userId)
	});
	const settleQuery = useSettleBalances(userId);
	const groups = groupsQuery.data ?? [];
	const totalOwe = (settleQuery.data?.iOwe ?? []).reduce((s, b) => s + b.amount, 0);
	const totalOwed = (settleQuery.data?.owedToMe ?? []).reduce((s, b) => s + b.amount, 0);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-2xl font-bold",
					children: "Your groups"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "Split bills with friends and roommates."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CreateGroupDialog, { userId })]
			}),
			settleQuery.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex justify-center py-6",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-5 w-5 animate-spin text-primary" })
			}) : settleQuery.isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl border border-dashed border-border bg-card/50 p-4 text-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm font-medium",
					children: "Balances could not load."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					className: "mt-3",
					size: "sm",
					variant: "outline",
					onClick: () => settleQuery.refetch(),
					children: "Try again"
				})]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BalanceSummaryCards, {
				totalOwe,
				totalOwed
			}),
			groupsQuery.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex justify-center py-16",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-6 w-6 animate-spin text-primary" })
			}) : groupsQuery.isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "h-6 w-6" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "mt-4 font-display text-base font-semibold",
						children: "Groups could not load"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted-foreground",
						children: groupsQuery.error.message
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						className: "mt-5",
						size: "sm",
						variant: "outline",
						onClick: () => groupsQuery.refetch(),
						children: "Try again"
					})
				]
			}) : groups.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, { userId }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-3",
				children: groups.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/app/group/$groupId",
					params: { groupId: g.id },
					className: "flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "h-5 w-5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate font-semibold",
								children: g.name
							}), g.description && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate text-sm text-muted-foreground",
								children: g.description
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "h-5 w-5 text-muted-foreground" })
					]
				}, g.id))
			})
		]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AddExpenseFab, {
		userId,
		groups: groups.map((g) => ({
			id: g.id,
			name: g.name
		}))
	})] });
}
function EmptyState({ userId }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "h-6 w-6" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "mt-4 font-display text-base font-semibold",
				children: "No groups yet"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mx-auto mt-1 max-w-xs text-sm text-muted-foreground",
				children: "Create your first group and invite friends by their username to start splitting expenses."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-5 flex justify-center",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CreateGroupDialog, { userId })
			})
		]
	});
}
function CreateGroupDialog({ userId }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [name, setName] = (0, import_react.useState)("");
	const [description, setDescription] = (0, import_react.useState)("");
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: () => createGroup(userId, name.trim(), description.trim() || null),
		onSuccess: () => {
			toast.success("Group created!");
			queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
			setOpen(false);
			setName("");
			setDescription("");
		},
		onError: (e) => toast.error(e.message)
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Dialog, {
		open,
		onOpenChange: setOpen,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTrigger, {
			asChild: true,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				size: "sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "mr-1 h-4 w-4" }), " New group"]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Create a group" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "space-y-4",
			onSubmit: (e) => {
				e.preventDefault();
				if (!name.trim()) return;
				mutation.mutate();
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Group name" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: name,
						onChange: (e) => setName(e.target.value),
						placeholder: "Goa Trip, Flat 4B, ...",
						required: true
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Description (optional)" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
						value: description,
						onChange: (e) => setDescription(e.target.value),
						placeholder: "What's this group for?",
						rows: 2
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogFooter, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "submit",
					disabled: mutation.isPending,
					children: [mutation.isPending && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mr-2 h-4 w-4 animate-spin" }), "Create group"]
				}) })
			]
		})] })]
	});
}
//#endregion
export { GroupsHome as component };
