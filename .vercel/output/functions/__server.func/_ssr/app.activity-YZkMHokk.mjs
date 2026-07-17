import { k as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { r as useAuth } from "./use-auth-BtUVOn94.mjs";
import { b as markNotificationRead, f as getNotificationSenderProfiles, o as dismissNotification, p as getNotifications, x as respondToInvite, y as markAllNotificationsRead } from "./api-K9Bdh_wb.mjs";
import { t as Button } from "./button-PwNqyxv_.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { b as Bell, f as LoaderCircle, i as UserPlus, p as HandCoins, t as X, v as Check, y as CheckCheck } from "../_libs/lucide-react.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as CountUpCurrency } from "./CountUpCurrency-CAkKtbv2.mjs";
import { t as UpiQrDialog } from "./UpiQrDialog-C_jX33Y0.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/app.activity-YZkMHokk.js
var import_jsx_runtime = require_jsx_runtime();
function ActivityPage() {
	const { session } = useAuth();
	const userId = session.user.id;
	const queryClient = useQueryClient();
	const notifQuery = useQuery({
		queryKey: ["notifications", userId],
		queryFn: () => getNotifications(userId)
	});
	const senderIds = Array.from(new Set((notifQuery.data ?? []).map((notification) => notification.sender_id).filter(Boolean)));
	const profilesQuery = useQuery({
		queryKey: ["notification-senders", senderIds.sort().join(",")],
		queryFn: () => getNotificationSenderProfiles(senderIds),
		enabled: senderIds.length > 0
	});
	const profileMap = new Map((profilesQuery.data ?? []).map((profile) => [profile.id, profile]));
	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
		queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
		queryClient.invalidateQueries({ queryKey: ["settle", userId] });
	};
	const respond = useMutation({
		mutationFn: (values) => respondToInvite({
			notificationId: values.notificationId,
			groupId: values.groupId,
			userId,
			accept: values.accept
		}),
		onSuccess: (_data, values) => {
			toast.success(values.accept ? "Joined the group!" : "Invite declined");
			invalidate();
		},
		onError: (error) => toast.error(error.message)
	});
	const dismiss = useMutation({
		mutationFn: (notificationId) => dismissNotification(notificationId),
		onSuccess: invalidate
	});
	const markRead = useMutation({
		mutationFn: (notificationId) => markNotificationRead(notificationId),
		onSuccess: () => {
			toast.success("Marked as read");
			invalidate();
		},
		onError: (error) => toast.error(error.message)
	});
	const markAllRead = useMutation({
		mutationFn: () => markAllNotificationsRead(userId),
		onSuccess: () => {
			toast.success("All marked as read");
			invalidate();
		},
		onError: (error) => toast.error(error.message)
	});
	const notifications = notifQuery.data ?? [];
	const pendingSettlementCount = notifications.filter((notification) => notification.status === "pending" && notification.type === "settlement_request").length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-2xl font-bold",
				children: "Activity"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: "Group invites, expense updates, and settlement requests."
			})] }), pendingSettlementCount > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				size: "sm",
				variant: "outline",
				disabled: markAllRead.isPending,
				onClick: () => markAllRead.mutate(),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckCheck, { className: "mr-1.5 h-4 w-4" }), "Mark requests read"]
			}) : null]
		}), notifQuery.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex justify-center py-16",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-6 w-6 animate-spin text-primary" })
		}) : notifQuery.isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "h-6 w-6" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "mt-4 font-display text-base font-semibold",
					children: "Activity could not load"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted-foreground",
					children: notifQuery.error.message
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					className: "mt-5",
					size: "sm",
					variant: "outline",
					onClick: () => notifQuery.refetch(),
					children: "Try again"
				})
			]
		}) : notifications.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "h-6 w-6" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "mt-4 font-display text-base font-semibold",
					children: "You're all caught up"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted-foreground",
					children: "Notifications will show up here."
				})
			]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "space-y-3",
			children: notifications.map((notification) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NotificationCard, {
				notification,
				sender: notification.sender_id ? profileMap.get(notification.sender_id) : void 0,
				onAccept: () => respond.mutate({
					notificationId: notification.id,
					groupId: notification.group_id,
					accept: true
				}),
				onDecline: () => respond.mutate({
					notificationId: notification.id,
					groupId: notification.group_id,
					accept: false
				}),
				onDismiss: () => dismiss.mutate(notification.id),
				onMarkRead: () => markRead.mutate(notification.id),
				busy: respond.isPending || dismiss.isPending || markRead.isPending
			}, notification.id))
		})]
	});
}
function resolveSender(notification, profile) {
	const username = profile?.username ?? notification.sender_username;
	const upiId = profile?.upi_id ?? notification.sender_upi;
	return {
		name: username ? `@${username}` : profile?.full_name?.trim() || notification.sender_username || "Someone",
		upiId
	};
}
function NotificationCard({ notification, sender, onAccept, onDecline, onDismiss, onMarkRead, busy }) {
	const { name: senderName, upiId: senderUpi } = resolveSender(notification, sender);
	const isInvite = notification.type === "group_invite";
	const isSettlement = notification.type === "settlement_request";
	const isSettlementConfirmed = notification.type === "settlement_confirmed";
	const isExpenseAdded = notification.type === "expense_added";
	const pending = notification.status === "pending";
	const canOpenGroup = isInvite && !!notification.group_id && notification.status === "accepted";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "rounded-2xl border border-border bg-card p-4 shadow-sm",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: `flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isInvite ? "bg-secondary text-primary" : "bg-accent/30 text-accent-foreground"}`,
				children: isInvite ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserPlus, { className: "h-5 w-5" }) : isExpenseAdded ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "h-5 w-5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HandCoins, { className: "h-5 w-5" })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-semibold",
								children: senderName
							}),
							" ",
							isSettlement && notification.amount != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								"requested",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CountUpCurrency, { amount: Number(notification.amount) }) }),
								notification.message ? ` - ${notification.message}` : ""
							] }) : isSettlementConfirmed && notification.amount != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								"confirmed",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CountUpCurrency, { amount: Number(notification.amount) }) }),
								" ",
								notification.message ?? "as paid."
							] }) : notification.message
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-0.5 text-xs text-muted-foreground",
						children: [new Date(notification.created_at).toLocaleString(), !pending ? ` · ${notification.status}` : ""]
					}),
					isInvite && pending ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							onClick: onAccept,
							disabled: busy,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "mr-1 h-4 w-4" }), " Accept"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							variant: "outline",
							onClick: onDecline,
							disabled: busy,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "mr-1 h-4 w-4" }), " Decline"]
						})]
					}) : null,
					canOpenGroup ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex flex-wrap gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							asChild: true,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/app/group/$groupId",
								params: { groupId: notification.group_id },
								children: "Open group"
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "outline",
							onClick: onDismiss,
							disabled: busy,
							children: "Dismiss"
						})]
					}) : null,
					isSettlement && pending ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex flex-wrap gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UpiQrDialog, {
							payeeName: senderName,
							payeeUpiId: senderUpi,
							amount: Number(notification.amount ?? 0),
							note: "SplitPay settlement",
							trigger: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								size: "sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HandCoins, { className: "mr-1 h-4 w-4" }), " Settle up"]
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							variant: "outline",
							onClick: onMarkRead,
							disabled: busy,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckCheck, { className: "mr-1 h-4 w-4" }), " Mark as read"]
						})]
					}) : null,
					(isSettlementConfirmed || isExpenseAdded) && pending ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex flex-wrap gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							variant: "outline",
							onClick: onMarkRead,
							disabled: busy,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckCheck, { className: "mr-1 h-4 w-4" }), " Mark as read"]
						}), isExpenseAdded && notification.group_id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							asChild: true,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/app/group/$groupId",
								params: { groupId: notification.group_id },
								children: "Open group"
							})
						}) : null]
					}) : null,
					!pending && !isInvite ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "ghost",
							onClick: onDismiss,
							disabled: busy,
							children: "Dismiss"
						})
					}) : null,
					isInvite && notification.status === "declined" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "ghost",
							onClick: onDismiss,
							disabled: busy,
							children: "Dismiss"
						})
					}) : null
				]
			})]
		})
	});
}
//#endregion
export { ActivityPage as component };
