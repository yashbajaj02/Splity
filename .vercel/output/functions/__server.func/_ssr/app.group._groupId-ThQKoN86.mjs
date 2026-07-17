import { r as __toESM } from "../_runtime.mjs";
import { A as require_react, a as Overlay2, c as Title2, i as Description2, k as require_jsx_runtime, l as Trigger2, n as Cancel, o as Portal2, r as Content2, s as Root2, t as Action } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { n as supabase, r as useAuth } from "./use-auth-BtUVOn94.mjs";
import { C as settleByCash, _ as inviteToGroup, a as deleteGroup, c as getGroup, g as getSplitsForExpenses, h as getProfilesByIds, i as deleteExpense, l as getGroupExpenses, n as canDeleteExpense, s as findUserByUsername, u as getGroupMembers, v as leaveGroup, w as settleByUpi } from "./api-K9Bdh_wb.mjs";
import { n as buttonVariants, r as cn, t as Button } from "./button-PwNqyxv_.mjs";
import { n as Label, t as Input } from "./label-DDmitfqC.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as Trash2, c as QrCode, d as LogOut, f as LoaderCircle, i as UserPlus, m as Clock, s as Receipt, w as ArrowLeft } from "../_libs/lucide-react.mjs";
import { _ as useNavigate, g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as DialogFooter, c as DialogTrigger, n as Dialog, o as DialogHeader, r as DialogContent, s as DialogTitle, t as CountUpCurrency, u as computePairwiseDebts } from "./CountUpCurrency-CAkKtbv2.mjs";
import { t as UpiQrDialog } from "./UpiQrDialog-C_jX33Y0.mjs";
import { t as Route } from "./app.group._groupId-TeS0xIxo.mjs";
import { t as AddExpenseDialog } from "./AddExpenseDialog-fnih3W8S.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/app.group._groupId-ThQKoN86.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var AlertDialog = Root2;
var AlertDialogTrigger = Trigger2;
var AlertDialogPortal = Portal2;
var AlertDialogOverlay = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Overlay2, {
	className: cn("fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className),
	...props,
	ref
}));
AlertDialogOverlay.displayName = Overlay2.displayName;
var AlertDialogContent = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogOverlay, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content2, {
	ref,
	className: cn("fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg", className),
	...props
})] }));
AlertDialogContent.displayName = Content2.displayName;
var AlertDialogHeader = ({ className, ...props }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
	className: cn("flex flex-col space-y-2 text-center sm:text-left", className),
	...props
});
AlertDialogHeader.displayName = "AlertDialogHeader";
var AlertDialogFooter = ({ className, ...props }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
	className: cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className),
	...props
});
AlertDialogFooter.displayName = "AlertDialogFooter";
var AlertDialogTitle = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Title2, {
	ref,
	className: cn("text-lg font-semibold", className),
	...props
}));
AlertDialogTitle.displayName = Title2.displayName;
var AlertDialogDescription = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Description2, {
	ref,
	className: cn("text-sm text-muted-foreground", className),
	...props
}));
AlertDialogDescription.displayName = Description2.displayName;
var AlertDialogAction = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Action, {
	ref,
	className: cn(buttonVariants(), className),
	...props
}));
AlertDialogAction.displayName = Action.displayName;
var AlertDialogCancel = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cancel, {
	ref,
	className: cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className),
	...props
}));
AlertDialogCancel.displayName = Cancel.displayName;
function GroupDetail() {
	const { groupId } = Route.useParams();
	const { session } = useAuth();
	const userId = session.user.id;
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const groupQuery = useQuery({
		queryKey: ["group", groupId],
		queryFn: () => getGroup(groupId)
	});
	const membersQuery = useQuery({
		queryKey: ["group-members", groupId],
		queryFn: () => getGroupMembers(groupId)
	});
	const expensesQuery = useQuery({
		queryKey: ["group-expenses", groupId],
		queryFn: () => getGroupExpenses(groupId)
	});
	const memberIds = (membersQuery.data ?? []).map((member) => member.user_id);
	const profilesQuery = useQuery({
		queryKey: ["profiles", memberIds.sort().join(",")],
		queryFn: () => getProfilesByIds(memberIds),
		enabled: memberIds.length > 0
	});
	const profileMap = new Map((profilesQuery.data ?? []).map((profile) => [profile.id, profile]));
	const nameOf = (id) => {
		if (id === userId) return "You";
		const profile = profileMap.get(id);
		return profile?.username ? `@${profile.username}` : "user";
	};
	const expenseIds = (expensesQuery.data ?? []).map((expense) => expense.id);
	const splitsQuery = useQuery({
		queryKey: [
			"group-splits",
			groupId,
			expenseIds.join(",")
		],
		queryFn: () => getSplitsForExpenses(expenseIds),
		enabled: expenseIds.length > 0
	});
	(0, import_react.useEffect)(() => {
		const channel = supabase.channel(`group-live-${groupId}`).on("postgres_changes", {
			event: "*",
			schema: "public",
			table: "expenses",
			filter: `group_id=eq.${groupId}`
		}, () => {
			queryClient.invalidateQueries({ queryKey: ["group-expenses", groupId] });
			queryClient.invalidateQueries({ queryKey: ["group-splits", groupId] });
			queryClient.invalidateQueries({ queryKey: ["settle", userId] });
		}).on("postgres_changes", {
			event: "*",
			schema: "public",
			table: "group_members",
			filter: `group_id=eq.${groupId}`
		}, () => {
			queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
			queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
			queryClient.invalidateQueries({ queryKey: ["settle", userId] });
		}).subscribe();
		return () => {
			supabase.removeChannel(channel);
		};
	}, [
		groupId,
		queryClient,
		userId
	]);
	const leaveMutation = useMutation({
		mutationFn: () => leaveGroup(groupId, userId),
		onSuccess: () => {
			toast.success("Left the group");
			queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
			navigate({ to: "/app" });
		},
		onError: (error) => toast.error(error.message)
	});
	const deleteMutation = useMutation({
		mutationFn: () => deleteGroup(groupId),
		onSuccess: () => {
			toast.success("Group deleted");
			queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
			navigate({ to: "/app" });
		},
		onError: (error) => toast.error(error.message)
	});
	const removeExpenseMutation = useMutation({
		mutationFn: (expenseId) => deleteExpense(expenseId, userId),
		onSuccess: () => {
			toast.success("Expense removed");
			queryClient.invalidateQueries({ queryKey: ["group-expenses", groupId] });
			queryClient.invalidateQueries({ queryKey: ["group-splits", groupId] });
			queryClient.invalidateQueries({ queryKey: ["settle", userId] });
		},
		onError: (error) => toast.error(error.message)
	});
	const cashSettlement = useMutation({
		mutationFn: (values) => settleByCash({
			groupId,
			payerId: userId,
			payeeId: values.payeeId,
			amount: values.amount
		}),
		onSuccess: () => {
			toast.success("Cash payment recorded. They were notified.");
			queryClient.invalidateQueries({ queryKey: ["group-expenses", groupId] });
			queryClient.invalidateQueries({ queryKey: ["settle", userId] });
		},
		onError: (error) => toast.error(error.message)
	});
	const upiSettlement = useMutation({
		mutationFn: (values) => settleByUpi({
			groupId,
			payerId: userId,
			payeeId: values.payeeId,
			amount: values.amount
		}),
		onSuccess: (_data, values) => {
			toast.success(`Payment of Rs ${values.amount.toFixed(2)} settled.`);
			queryClient.invalidateQueries({ queryKey: ["group-expenses", groupId] });
			queryClient.invalidateQueries({ queryKey: ["settle", userId] });
			queryClient.invalidateQueries({ queryKey: ["notifications"] });
		},
		onError: (error) => toast.error(error.message)
	});
	if (groupQuery.isLoading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex justify-center py-16",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-6 w-6 animate-spin text-primary" })
	});
	if (groupQuery.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3 py-16 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm font-medium text-foreground",
				children: "Could not load this group."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: groupQuery.error.message
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				variant: "outline",
				size: "sm",
				onClick: () => groupQuery.refetch(),
				children: "Try again"
			})
		]
	});
	if (!groupQuery.data) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "py-16 text-center text-sm text-muted-foreground",
		children: "Group not found."
	});
	const group = groupQuery.data;
	const members = membersQuery.data ?? [];
	const acceptedMembers = members.filter((member) => member.status === "accepted");
	const pendingMembers = members.filter((member) => member.status === "pending");
	const expenses = expensesQuery.data ?? [];
	const splitsByExpense = {};
	for (const split of splitsQuery.data ?? []) (splitsByExpense[split.expense_id] ??= []).push(split);
	const pairwiseDebts = computePairwiseDebts(expenses, splitsByExpense);
	const isCreator = group.created_by === userId;
	const isMember = acceptedMembers.some((member) => member.user_id === userId);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/app",
					className: "inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "h-4 w-4" }), " Groups"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "font-display text-2xl font-bold",
							children: group.name
						}), group.description ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted-foreground",
							children: group.description
						}) : null]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex shrink-0 flex-wrap justify-end gap-2",
						children: [isMember && !isCreator ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LeaveGroupButton, {
							groupName: group.name,
							busy: leaveMutation.isPending,
							onLeave: () => leaveMutation.mutate()
						}) : null, isCreator ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeleteGroupButton, {
							groupName: group.name,
							busy: deleteMutation.isPending,
							onDelete: () => deleteMutation.mutate()
						}) : null]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "space-y-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
						className: "font-display text-sm font-semibold text-muted-foreground",
						children: [
							"Members (",
							acceptedMembers.length,
							")"
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InviteDialog, {
						groupId,
						groupName: group.name,
						inviterId: userId
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [acceptedMembers.map((member) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rounded-full bg-secondary px-3 py-1 text-sm font-medium text-primary",
						children: nameOf(member.user_id)
					}, member.id)), pendingMembers.map((member) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-sm text-muted-foreground",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "h-3 w-3" }),
							" ",
							nameOf(member.user_id)
						]
					}, member.id))]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "space-y-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-sm font-semibold text-muted-foreground",
					children: "Who owes whom"
				}), pairwiseDebts.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "rounded-xl border border-dashed border-border bg-card/50 p-4 text-center text-sm text-muted-foreground",
					children: "Everyone's settled up."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-2",
					children: pairwiseDebts.map((debt) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DebtRow, {
						debt,
						userId,
						nameOf,
						payeeUpiId: profileMap.get(debt.to)?.upi_id ?? null,
						cashBusy: cashSettlement.isPending,
						upiBusy: upiSettlement.isPending,
						onUpiPaid: () => upiSettlement.mutate({
							payeeId: debt.to,
							amount: debt.amount
						}),
						onCashPaid: () => cashSettlement.mutate({
							payeeId: debt.to,
							amount: debt.amount
						}),
						groupName: group.name
					}, `${debt.from}-${debt.to}`))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "space-y-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-sm font-semibold text-muted-foreground",
						children: "Expenses"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AddExpenseDialog, {
						groupId,
						userId,
						members: acceptedMembers.map((member) => ({
							id: member.user_id,
							name: nameOf(member.user_id)
						})),
						trigger: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							children: "Add expense"
						})
					})]
				}), expenses.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "rounded-xl border border-dashed border-border bg-card/50 p-4 text-center text-sm text-muted-foreground",
					children: "No expenses yet. Add the first one!"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-2",
					children: expenses.map((expense) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExpenseRow, {
						expense,
						currentUserId: userId,
						creatorName: nameOf(expense.created_by),
						payerName: nameOf(expense.paid_by),
						canRemove: canDeleteExpense(expense, userId),
						removeBusy: removeExpenseMutation.isPending,
						onRemove: () => removeExpenseMutation.mutate(expense.id)
					}, expense.id))
				})]
			})
		]
	});
}
function DebtRow({ debt, userId, nameOf, payeeUpiId, cashBusy, upiBusy, onUpiPaid, onCashPaid, groupName }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-w-0 flex-1 text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-semibold",
				children: debt.from === userId ? `You owe ${nameOf(debt.to)}` : debt.to === userId ? `${nameOf(debt.from)} owes you` : `${nameOf(debt.from)} owes ${nameOf(debt.to)}`
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "ml-1 font-display font-bold text-primary",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CountUpCurrency, { amount: debt.amount })
			})]
		}), debt.from === userId ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UpiQrDialog, {
			payeeName: nameOf(debt.to),
			payeeUpiId,
			amount: debt.amount,
			note: `SplitPay - ${groupName}`,
			onUpiPaid,
			upiBusy,
			onCashPaid,
			cashBusy,
			trigger: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				size: "sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCode, { className: "mr-1.5 h-4 w-4" }), " Pay"]
			})
		}) : null]
	});
}
function ExpenseRow({ expense, currentUserId, creatorName, payerName, canRemove, removeBusy, onRemove }) {
	const youAddedThis = expense.created_by === currentUserId;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Receipt, { className: "h-5 w-5" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "truncate font-semibold",
					children: expense.description
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-muted-foreground",
					children: [
						creatorName,
						" added · ",
						payerName,
						" paid · ",
						new Date(expense.created_at).toLocaleString()
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display font-bold",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CountUpCurrency, { amount: Number(expense.amount) })
				}), youAddedThis ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialog, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogTrigger, {
					asChild: true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "icon",
						variant: "ghost",
						disabled: !canRemove || removeBusy,
						"aria-label": "Remove expense",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-4 w-4" })
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogTitle, { children: "Remove this expense?" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogDescription, { children: "You can remove an expense only within 5 hours of adding it." })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogCancel, { children: "Cancel" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogAction, {
					onClick: onRemove,
					disabled: removeBusy,
					children: "Remove"
				})] })] })] }) : null]
			})
		]
	});
}
function LeaveGroupButton({ groupName, busy, onLeave }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialog, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogTrigger, {
		asChild: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			variant: "outline",
			size: "sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, { className: "mr-1.5 h-4 w-4" }), " Leave"]
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogTitle, { children: "Leave this group?" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogDescription, { children: [
		"You won't see expenses or balances for \"",
		groupName,
		"\" anymore. You can be re-invited later."
	] })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogCancel, { children: "Cancel" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogAction, {
		onClick: onLeave,
		disabled: busy,
		children: "Leave"
	})] })] })] });
}
function DeleteGroupButton({ groupName, busy, onDelete }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialog, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogTrigger, {
		asChild: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			variant: "destructive",
			size: "sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "mr-1.5 h-4 w-4" }), " Delete"]
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogTitle, { children: [
		"Delete \"",
		groupName,
		"\"?"
	] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogDescription, { children: "This permanently deletes the group, all expenses, and member data. This cannot be undone." })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogCancel, { children: "Cancel" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogAction, {
		className: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
		onClick: onDelete,
		disabled: busy,
		children: "Delete"
	})] })] })] });
}
function InviteDialog({ groupId, groupName, inviterId }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [username, setUsername] = (0, import_react.useState)("");
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: async () => {
			const user = await findUserByUsername(username.trim().toLowerCase());
			if (!user) throw new Error("No user found with that username.");
			if (user.id === inviterId) throw new Error("You're already in this group.");
			await inviteToGroup({
				groupId,
				groupName,
				targetUserId: user.id,
				inviterId
			});
		},
		onSuccess: () => {
			toast.success("Invite sent!");
			queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
			setOpen(false);
			setUsername("");
		},
		onError: (error) => toast.error(error.message)
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Dialog, {
		open,
		onOpenChange: setOpen,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTrigger, {
			asChild: true,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				size: "sm",
				variant: "outline",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserPlus, { className: "mr-1 h-4 w-4" }), " Invite"]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Invite by username" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "space-y-4",
			onSubmit: (event) => {
				event.preventDefault();
				if (!username.trim()) return;
				mutation.mutate();
			},
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Username" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: username,
					onChange: (event) => setUsername(event.target.value),
					placeholder: "friend_username",
					autoCapitalize: "none",
					required: true
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogFooter, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				type: "submit",
				disabled: mutation.isPending,
				children: [mutation.isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mr-2 h-4 w-4 animate-spin" }) : null, "Send invite"]
			}) })]
		})] })]
	});
}
//#endregion
export { GroupDetail as component };
