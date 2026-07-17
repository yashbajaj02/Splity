import { r as __toESM } from "../_runtime.mjs";
import { A as require_react, k as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { n as supabase, r as useAuth } from "./use-auth-BtUVOn94.mjs";
import { m as getProfile, p as getNotifications } from "./api-K9Bdh_wb.mjs";
import { r as cn, t as Button } from "./button-PwNqyxv_.mjs";
import { i as useQueryClient, n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { b as Bell, d as LogOut, f as LoaderCircle, n as Users, p as HandCoins, r as User } from "../_libs/lucide-react.mjs";
import { t as ProfileForm } from "./ProfileForm-RxYwnW9a.mjs";
import { t as AppLogo } from "./AppLogo-QYQAOHfr.mjs";
import { _ as useNavigate, f as Outlet, g as Link, l as useRouterState } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/app-C8Rp2DxA.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Onboarding({ userId, email, existing, onDone }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-app-gradient px-5 py-10",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-6 flex items-center justify-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppLogo, { className: "h-9 w-9" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-display text-lg font-bold",
					children: "Splity"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl border border-border bg-card p-6 shadow-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-display text-xl font-bold",
						children: "Set up your profile"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted-foreground",
						children: "Pick a unique username so friends can find you, and add your UPI ID so people can pay you back."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-6",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileForm, {
							userId,
							email,
							existing: existing ?? {
								id: userId,
								username: null,
								email,
								full_name: null,
								upi_id: null,
								avatar_url: null,
								created_at: "",
								updated_at: ""
							},
							onDone,
							submitLabel: "Continue"
						})
					})
				]
			})]
		})
	});
}
function AppLayout() {
	const { session, loading, signOut } = useAuth();
	const navigate = useNavigate();
	const userId = session?.user.id;
	const queryClient = useQueryClient();
	(0, import_react.useEffect)(() => {
		if (!loading && !session) navigate({ to: "/auth" });
	}, [
		loading,
		session,
		navigate
	]);
	const profileQuery = useQuery({
		queryKey: ["profile", userId],
		queryFn: () => getProfile(userId),
		enabled: !!userId
	});
	const notifQuery = useQuery({
		queryKey: ["notifications", userId],
		queryFn: () => getNotifications(userId),
		enabled: !!userId
	});
	(0, import_react.useEffect)(() => {
		if (!userId) return;
		const channel = supabase.channel(`app-sync-${userId}`).on("postgres_changes", {
			event: "*",
			schema: "public",
			table: "notifications",
			filter: `recipient_id=eq.${userId}`
		}, () => {
			queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
			queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
		}).on("postgres_changes", {
			event: "*",
			schema: "public",
			table: "expenses"
		}, () => {
			queryClient.invalidateQueries({ queryKey: ["settle", userId] });
			queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
		}).on("postgres_changes", {
			event: "*",
			schema: "public",
			table: "expense_splits"
		}, () => {
			queryClient.invalidateQueries({ queryKey: ["settle", userId] });
		}).on("postgres_changes", {
			event: "*",
			schema: "public",
			table: "group_members"
		}, () => {
			queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
			queryClient.invalidateQueries({ queryKey: ["settle", userId] });
		}).subscribe();
		return () => {
			supabase.removeChannel(channel);
		};
	}, [userId, queryClient]);
	if (loading || !session || profileQuery.isLoading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-6 w-6 animate-spin text-primary" })
	});
	if (profileQuery.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center px-5",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-sm text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-xl font-bold",
					children: "Profile could not load"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: profileQuery.error.message
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					className: "mt-5",
					variant: "outline",
					onClick: () => profileQuery.refetch(),
					children: "Try again"
				})
			]
		})
	});
	const profile = profileQuery.data;
	if (!profile || !profile.username || !profile.upi_id) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Onboarding, {
		userId,
		email: session.user.email ?? "",
		existing: profile ?? void 0,
		onDone: () => profileQuery.refetch()
	});
	const pendingCount = (notifQuery.data ?? []).filter((n) => n.status === "pending").length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen pb-24",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
				className: "sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto flex max-w-2xl items-center justify-between px-5 py-3.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/app",
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppLogo, { className: "h-8 w-8 rounded-lg" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-display text-base font-bold",
							children: "Splity"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/app/profile",
							className: "flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, { className: "h-4 w-4" }),
								"@",
								profile.username
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "icon",
							onClick: async () => {
								await signOut();
								navigate({ to: "/" });
							},
							"aria-label": "Sign out",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, { className: "h-4 w-4" })
						})]
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
				className: "mx-auto max-w-2xl px-5 py-6",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BottomNav, { pendingCount })
		]
	});
}
function BottomNav({ pendingCount }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
		className: "fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/90 backdrop-blur",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mx-auto flex max-w-2xl items-stretch justify-around px-2 py-1.5",
			children: [
				{
					to: "/app",
					label: "Groups",
					icon: Users,
					exact: true
				},
				{
					to: "/app/activity",
					label: "Activity",
					icon: Bell,
					badge: pendingCount
				},
				{
					to: "/app/settle",
					label: "Settle Up",
					icon: HandCoins
				}
			].map((item) => {
				const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
				const Icon = item.icon;
				const hasBadge = "badge" in item && !!item.badge;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: item.to,
					className: cn("flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-xs font-medium transition-colors", active ? "text-primary" : "text-muted-foreground hover:text-foreground", hasBadge && !active && "text-warning"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "relative inline-flex items-center justify-center",
						children: [
							hasBadge ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "pointer-events-none absolute -inset-1.5 rounded-full bg-warning/35 animate-bell-glow",
								"aria-hidden": true
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: cn("relative z-[1] h-5 w-5", hasBadge && "animate-bell-ring text-warning") }),
							hasBadge ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "absolute -right-2 -top-1.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground ring-2 ring-background",
								children: item.badge > 9 ? "9+" : item.badge
							}) : null
						]
					}), item.label]
				}, item.to);
			})
		})
	});
}
//#endregion
export { AppLayout as component };
