import { r as __toESM } from "../_runtime.mjs";
import { A as require_react, _ as DialogTrigger$1, d as DialogClose, f as DialogContent$1, g as DialogTitle$1, h as DialogPortal$1, k as require_jsx_runtime, m as DialogOverlay$1, p as DialogDescription$1, u as Dialog$1 } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { r as cn } from "./button-PwNqyxv_.mjs";
import { t as X } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/CountUpCurrency-CAkKtbv2.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var Dialog = Dialog$1;
var DialogTrigger = DialogTrigger$1;
var DialogPortal = DialogPortal$1;
var DialogOverlay = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay$1, {
	ref,
	className: cn("fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className),
	...props
}));
DialogOverlay.displayName = DialogOverlay$1.displayName;
var DialogContent = import_react.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent$1, {
	ref,
	className: cn("fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg", className),
	...props,
	children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogClose, {
		className: "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background cursor-pointer transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "h-4 w-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "sr-only",
			children: "Close"
		})]
	})]
})] }));
DialogContent.displayName = DialogContent$1.displayName;
var DialogHeader = ({ className, ...props }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
	className: cn("flex flex-col space-y-1.5 text-center sm:text-left", className),
	...props
});
DialogHeader.displayName = "DialogHeader";
var DialogFooter = ({ className, ...props }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
	className: cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className),
	...props
});
DialogFooter.displayName = "DialogFooter";
var DialogTitle = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle$1, {
	ref,
	className: cn("text-lg font-semibold leading-none tracking-tight", className),
	...props
}));
DialogTitle.displayName = DialogTitle$1.displayName;
var DialogDescription = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription$1, {
	ref,
	className: cn("text-sm text-muted-foreground", className),
	...props
}));
DialogDescription.displayName = DialogDescription$1.displayName;
function normalizeAmount(amount) {
	return Math.round(amount * 100) / 100;
}
function computePairwiseDebts(expenses, splitsByExpense) {
	const pairBalances = /* @__PURE__ */ new Map();
	for (const expense of expenses) {
		const splits = splitsByExpense[expense.id] ?? [];
		for (const split of splits) {
			const owed = Number(split.amount_owed);
			if (owed <= 0 || split.user_id === expense.paid_by) continue;
			const key = `${split.user_id}->${expense.paid_by}`;
			pairBalances.set(key, (pairBalances.get(key) ?? 0) + owed);
		}
	}
	const normalizedPairs = /* @__PURE__ */ new Map();
	for (const [key, amount] of pairBalances.entries()) {
		const [from, to] = key.split("->");
		const reverseKey = `${to}->${from}`;
		const reverseAmount = pairBalances.get(reverseKey) ?? 0;
		if (normalizedPairs.has(key) || normalizedPairs.has(reverseKey)) continue;
		const net = normalizeAmount(amount - reverseAmount);
		if (net > .009) normalizedPairs.set(key, net);
		else if (net < -.009) normalizedPairs.set(reverseKey, Math.abs(net));
	}
	return Array.from(normalizedPairs.entries()).map(([key, amount]) => {
		const [from, to] = key.split("->");
		return {
			from,
			to,
			amount: normalizeAmount(amount)
		};
	}).sort((left, right) => right.amount - left.amount);
}
/** Build the standard UPI deep link used to render a payment QR code. */
function buildUpiUri(opts) {
	const params = new URLSearchParams();
	params.set("pa", opts.payeeUpiId);
	if (opts.payeeName) params.set("pn", opts.payeeName);
	params.set("am", opts.amount.toFixed(2));
	params.set("cu", "INR");
	if (opts.note) params.set("tn", opts.note);
	return `upi://pay?${params.toString()}`;
}
function formatCurrency(amount) {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 2
	}).format(amount);
}
function CountUpCurrency({ amount, duration = 800 }) {
	const [displayAmount, setDisplayAmount] = (0, import_react.useState)(0);
	(0, import_react.useEffect)(() => {
		const target = Number.isFinite(amount) ? amount : 0;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || target === 0) {
			setDisplayAmount(target);
			return;
		}
		let frame = 0;
		const startedAt = performance.now();
		const tick = (now) => {
			const progress = Math.min((now - startedAt) / duration, 1);
			const eased = 1 - Math.pow(1 - progress, 3);
			setDisplayAmount(target * eased);
			if (progress < 1) frame = requestAnimationFrame(tick);
		};
		setDisplayAmount(0);
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [amount, duration]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: formatCurrency(displayAmount) });
}
//#endregion
export { DialogFooter as a, DialogTrigger as c, DialogDescription as i, buildUpiUri as l, Dialog as n, DialogHeader as o, DialogContent as r, DialogTitle as s, CountUpCurrency as t, computePairwiseDebts as u };
