import { r as __toESM } from "../_runtime.mjs";
import { A as require_react, k as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { T as updateProfile, s as findUserByUsername } from "./api-K9Bdh_wb.mjs";
import { t as Button } from "./button-PwNqyxv_.mjs";
import { n as Label, t as Input } from "./label-DDmitfqC.mjs";
import { t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { S as AtSign, f as LoaderCircle, o as Smartphone } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ProfileForm-RxYwnW9a.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ProfileForm({ userId, email, existing, onDone, submitLabel = "Save changes" }) {
	const [username, setUsername] = (0, import_react.useState)(existing.username ?? "");
	const [fullName, setFullName] = (0, import_react.useState)(existing.full_name ?? "");
	const [upiId, setUpiId] = (0, import_react.useState)(existing.upi_id ?? "");
	const mutation = useMutation({
		mutationFn: async () => {
			const cleanUsername = username.trim().toLowerCase();
			if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) throw new Error("Username must be 3–20 chars: letters, numbers, underscores.");
			if (!upiId.includes("@")) throw new Error("Enter a valid UPI ID (e.g. name@bank).");
			if (cleanUsername !== existing.username) {
				if (await findUserByUsername(cleanUsername)) throw new Error("That username is already taken.");
			}
			return updateProfile(userId, {
				username: cleanUsername,
				full_name: fullName.trim() || null,
				upi_id: upiId.trim()
			});
		},
		onSuccess: () => {
			toast.success("Profile updated!");
			onDone();
		},
		onError: (e) => toast.error(e.message)
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "space-y-4",
		onSubmit: (e) => {
			e.preventDefault();
			mutation.mutate();
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Full name (optional)" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: fullName,
					onChange: (e) => setFullName(e.target.value),
					placeholder: "Jane Doe"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Username" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AtSign, { className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						className: "pl-9",
						value: username,
						onChange: (e) => setUsername(e.target.value),
						placeholder: "janedoe",
						required: true
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "UPI ID" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, { className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						className: "pl-9",
						value: upiId,
						onChange: (e) => setUpiId(e.target.value),
						placeholder: "jane@okaxis",
						required: true
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				type: "submit",
				className: "w-full",
				disabled: mutation.isPending,
				children: [mutation.isPending && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mr-2 h-4 w-4 animate-spin" }), submitLabel]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-center text-xs text-muted-foreground",
				children: ["Signed in as ", email]
			})
		]
	});
}
//#endregion
export { ProfileForm as t };
