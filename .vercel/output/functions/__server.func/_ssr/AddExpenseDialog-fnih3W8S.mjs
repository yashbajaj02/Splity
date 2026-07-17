import { r as __toESM } from "../_runtime.mjs";
import { A as require_react, k as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { h as getProfilesByIds, t as addExpense, u as getGroupMembers } from "./api-K9Bdh_wb.mjs";
import { r as cn, t as Button } from "./button-PwNqyxv_.mjs";
import { n as Label, t as Input } from "./label-DDmitfqC.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { f as LoaderCircle, l as Plus, v as Check } from "../_libs/lucide-react.mjs";
import { a as DialogFooter, c as DialogTrigger, n as Dialog, o as DialogHeader, r as DialogContent, s as DialogTitle } from "./CountUpCurrency-CAkKtbv2.mjs";
import { n as CheckboxIndicator, t as Checkbox$1 } from "../_libs/@radix-ui/react-checkbox+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/AddExpenseDialog-fnih3W8S.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var Checkbox = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Checkbox$1, {
	ref,
	className: cn("grid place-content-center peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground", className),
	...props,
	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckboxIndicator, {
		className: cn("grid place-content-center text-current"),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "h-4 w-4" })
	})
}));
Checkbox.displayName = Checkbox$1.displayName;
function AddExpenseDialog({ userId, groupId: fixedGroupId, members: fixedMembers, groups, trigger, open: controlledOpen, onOpenChange: controlledOnOpenChange }) {
	const [internalOpen, setInternalOpen] = (0, import_react.useState)(false);
	const open = controlledOpen ?? internalOpen;
	const setOpen = controlledOnOpenChange ?? setInternalOpen;
	const [selectedGroupId, setSelectedGroupId] = (0, import_react.useState)(fixedGroupId ?? groups?.[0]?.id ?? "");
	const [description, setDescription] = (0, import_react.useState)("");
	const [amount, setAmount] = (0, import_react.useState)("");
	const [paidBy, setPaidBy] = (0, import_react.useState)(userId);
	const [participants, setParticipants] = (0, import_react.useState)([]);
	const queryClient = useQueryClient();
	const activeGroupId = fixedGroupId ?? selectedGroupId;
	const needsGroupPicker = !!groups && !fixedGroupId;
	const membersQuery = useQuery({
		queryKey: ["group-members", activeGroupId],
		queryFn: () => getGroupMembers(activeGroupId),
		enabled: open && !!activeGroupId && !fixedMembers
	});
	const memberIds = (0, import_react.useMemo)(() => {
		if (fixedMembers) return fixedMembers.map((m) => m.id);
		return (membersQuery.data ?? []).filter((m) => m.status === "accepted").map((m) => m.user_id);
	}, [fixedMembers, membersQuery.data]);
	const profilesQuery = useQuery({
		queryKey: ["profiles", memberIds.sort().join(",")],
		queryFn: () => getProfilesByIds(memberIds),
		enabled: open && memberIds.length > 0 && !fixedMembers
	});
	const members = (0, import_react.useMemo)(() => {
		if (fixedMembers) return fixedMembers;
		const pmap = new Map((profilesQuery.data ?? []).map((p) => [p.id, p]));
		return (membersQuery.data ?? []).filter((m) => m.status === "accepted").map((m) => ({
			id: m.user_id,
			name: m.user_id === userId ? "You" : pmap.get(m.user_id)?.username ? `@${pmap.get(m.user_id).username}` : "user"
		}));
	}, [
		fixedMembers,
		membersQuery.data,
		profilesQuery.data,
		userId
	]);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		if (members.length > 0) {
			setParticipants(members.map((m) => m.id));
			setPaidBy((prev) => members.some((m) => m.id === prev) ? prev : userId);
		}
	}, [
		open,
		members,
		userId
	]);
	(0, import_react.useEffect)(() => {
		if (open && groups?.[0] && !fixedGroupId) setSelectedGroupId(groups[0].id);
	}, [
		open,
		groups,
		fixedGroupId
	]);
	const resetForm = () => {
		setDescription("");
		setAmount("");
		setParticipants(members.map((m) => m.id));
		setPaidBy(userId);
	};
	const allSelected = members.length > 0 && participants.length === members.length;
	const toggle = (id) => setParticipants((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
	const toggleAll = () => {
		setParticipants(allSelected ? [] : members.map((m) => m.id));
	};
	const mutation = useMutation({
		mutationFn: async () => {
			if (!activeGroupId) throw new Error("Select a group.");
			const total = Number(amount);
			if (!description.trim()) throw new Error("Add a description.");
			if (!(total > 0)) throw new Error("Enter a valid amount.");
			if (participants.length === 0) throw new Error("Select at least one person to split with.");
			const cents = Math.round(total * 100);
			const base = Math.floor(cents / participants.length);
			let remainder = cents - base * participants.length;
			const splits = participants.map((uid) => {
				let c = base;
				if (remainder > 0) {
					c += 1;
					remainder -= 1;
				}
				return {
					userId: uid,
					amount: c / 100
				};
			});
			await addExpense({
				groupId: activeGroupId,
				createdBy: userId,
				paidBy,
				description: description.trim(),
				amount: total,
				splits
			});
		},
		onSuccess: () => {
			toast.success("Expense added!");
			queryClient.invalidateQueries({ queryKey: ["group-expenses", activeGroupId] });
			queryClient.invalidateQueries({ queryKey: ["group-splits", activeGroupId] });
			queryClient.invalidateQueries({ queryKey: ["settle", userId] });
			setOpen(false);
			resetForm();
		},
		onError: (e) => toast.error(e.message)
	});
	const isLoadingMembers = !fixedMembers && !!activeGroupId && membersQuery.isLoading;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Dialog, {
		open,
		onOpenChange: (next) => {
			setOpen(next);
			if (!next) resetForm();
		},
		children: [trigger ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTrigger, {
			asChild: true,
			children: trigger
		}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Add an expense" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "space-y-4",
			onSubmit: (e) => {
				e.preventDefault();
				mutation.mutate();
			},
			children: [
				needsGroupPicker && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Group" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
						value: selectedGroupId,
						onChange: (e) => setSelectedGroupId(e.target.value),
						className: "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
						required: true,
						children: groups.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: g.id,
							children: g.name
						}, g.id))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Description" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: description,
						onChange: (e) => setDescription(e.target.value),
						placeholder: "Dinner, cab, groceries...",
						required: true
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Amount (₹)" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "number",
						inputMode: "decimal",
						step: "0.01",
						min: "0",
						value: amount,
						onChange: (e) => setAmount(e.target.value),
						placeholder: "0.00",
						required: true
					})]
				}),
				isLoadingMembers ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex justify-center py-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-5 w-5 animate-spin text-primary" })
				}) : members.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "No members in this group yet."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Paid by" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
						value: paidBy,
						onChange: (e) => setPaidBy(e.target.value),
						className: "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
						children: members.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: m.id,
							children: m.name
						}, m.id))
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Split equally between" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: toggleAll,
							className: "text-xs font-medium text-primary hover:underline",
							children: allSelected ? "Deselect all" : "Select all"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "max-h-40 space-y-2 overflow-y-auto rounded-xl border border-border p-3",
						children: members.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "flex cursor-pointer items-center gap-2 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Checkbox, {
								checked: participants.includes(m.id),
								onCheckedChange: () => toggle(m.id)
							}), m.name]
						}, m.id))
					})]
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogFooter, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "submit",
					disabled: mutation.isPending || isLoadingMembers || members.length === 0,
					children: [mutation.isPending && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mr-2 h-4 w-4 animate-spin" }), "Add expense"]
				}) })
			]
		})] })]
	});
}
function AddExpenseFab({ userId, groups }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	if (groups.length === 0) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick: () => setOpen(true),
		className: "fixed bottom-20 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95",
		"aria-label": "Add expense",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "h-7 w-7" })
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AddExpenseDialog, {
		userId,
		groups,
		open,
		onOpenChange: setOpen
	})] });
}
//#endregion
export { AddExpenseFab as n, AddExpenseDialog as t };
