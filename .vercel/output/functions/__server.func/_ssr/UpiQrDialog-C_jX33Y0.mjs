import { r as __toESM } from "../_runtime.mjs";
import { A as require_react, k as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { t as Button } from "./button-PwNqyxv_.mjs";
import { c as QrCode, f as LoaderCircle, g as CircleCheck, h as CircleX, x as Banknote } from "../_libs/lucide-react.mjs";
import { c as DialogTrigger, i as DialogDescription, l as buildUpiUri, n as Dialog, o as DialogHeader, r as DialogContent, s as DialogTitle, t as CountUpCurrency } from "./CountUpCurrency-CAkKtbv2.mjs";
import { t as QRCodeSVG } from "../_libs/qrcode.react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/UpiQrDialog-C_jX33Y0.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function UpiQrDialog({ payeeName, payeeUpiId, amount, note, trigger, onCashPaid, cashDisabled, cashBusy, onUpiPaid, upiBusy }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [awaitingConfirmation, setAwaitingConfirmation] = (0, import_react.useState)(false);
	const hasUpi = !!payeeUpiId;
	const uri = hasUpi ? buildUpiUri({
		payeeUpiId,
		payeeName,
		amount,
		note
	}) : "";
	const launchUpiApp = () => {
		setAwaitingConfirmation(true);
		window.location.href = uri;
	};
	const markFailed = () => {
		setAwaitingConfirmation(false);
	};
	const markPaid = () => {
		if (!onUpiPaid) return;
		onUpiPaid();
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Dialog, {
		open,
		onOpenChange: (next) => {
			setOpen(next);
			if (!next) setAwaitingConfirmation(false);
		},
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTrigger, {
			asChild: true,
			children: trigger ?? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				size: "sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCode, { className: "mr-1.5 h-4 w-4" }), " Settle up"]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-w-xs",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogTitle, { children: ["Pay ", payeeName] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogDescription, { children: [
				"Scan with any UPI app (GPay, PhonePe, Paytm) to pay",
				" ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CountUpCurrency, { amount }) }),
				"."
			] })] }), hasUpi ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col items-center gap-4 py-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "rounded-2xl bg-white p-4 shadow-sm",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QRCodeSVG, {
							value: uri,
							size: 200,
							level: "M"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-center",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-2xl font-bold text-primary",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CountUpCurrency, { amount })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-sm text-muted-foreground",
							children: ["to ", payeeUpiId]
						})]
					}),
					!awaitingConfirmation ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						className: "w-full",
						onClick: launchUpiApp,
						children: "Open in UPI app"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "w-full space-y-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-center text-sm text-muted-foreground",
								children: "After returning to Splity, confirm whether the payment worked."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								className: "w-full",
								onClick: markPaid,
								disabled: upiBusy,
								children: [upiBusy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mr-1.5 h-4 w-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "mr-1.5 h-4 w-4" }), "Paid"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								className: "w-full",
								variant: "outline",
								onClick: markFailed,
								disabled: upiBusy,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleX, { className: "mr-1.5 h-4 w-4" }), "Failed"]
							})
						]
					}),
					onCashPaid ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						className: "w-full",
						variant: "outline",
						onClick: onCashPaid,
						disabled: cashDisabled || cashBusy || upiBusy,
						children: [cashBusy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mr-1.5 h-4 w-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Banknote, { className: "mr-1.5 h-4 w-4" }), "Paid by cash"]
					}) : null
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-4 py-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-center text-sm text-muted-foreground",
					children: [payeeName, " hasn't added a UPI ID yet. Ask them to update their profile, or mark it paid if you settled directly."]
				}), onCashPaid ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					className: "w-full",
					variant: "outline",
					onClick: onCashPaid,
					disabled: cashDisabled || cashBusy,
					children: [cashBusy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mr-1.5 h-4 w-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Banknote, { className: "mr-1.5 h-4 w-4" }), "Paid by cash"]
				}) : null]
			})]
		})]
	});
}
//#endregion
export { UpiQrDialog as t };
