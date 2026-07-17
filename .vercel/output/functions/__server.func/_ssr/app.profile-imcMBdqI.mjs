import { k as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { r as useAuth } from "./use-auth-BtUVOn94.mjs";
import { m as getProfile } from "./api-K9Bdh_wb.mjs";
import { i as useQueryClient, n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { f as LoaderCircle, w as ArrowLeft } from "../_libs/lucide-react.mjs";
import { t as ProfileForm } from "./ProfileForm-RxYwnW9a.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/app.profile-imcMBdqI.js
var import_jsx_runtime = require_jsx_runtime();
function ProfilePage() {
	const { session } = useAuth();
	const userId = session.user.id;
	const queryClient = useQueryClient();
	const profileQuery = useQuery({
		queryKey: ["profile", userId],
		queryFn: () => getProfile(userId)
	});
	if (profileQuery.isLoading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex justify-center py-16",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-6 w-6 animate-spin text-primary" })
	});
	if (profileQuery.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3 py-16 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-xl font-bold",
				children: "Profile could not load"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: profileQuery.error.message
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
				onClick: () => profileQuery.refetch(),
				children: "Try again"
			})
		]
	});
	const profile = profileQuery.data;
	if (!profile) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-center text-sm text-muted-foreground",
		children: "Profile not found."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: "/app",
				className: "inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "h-4 w-4" }), " Back"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-2 font-display text-2xl font-bold",
				children: "Edit profile"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: "Update your username and UPI ID."
			})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "rounded-2xl border border-border bg-card p-6 shadow-sm",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileForm, {
				userId,
				email: session.user.email ?? "",
				existing: profile,
				onDone: () => queryClient.invalidateQueries({ queryKey: ["profile", userId] })
			})
		})]
	});
}
//#endregion
export { ProfilePage as component };
