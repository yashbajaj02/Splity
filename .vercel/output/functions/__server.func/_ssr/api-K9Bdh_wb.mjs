import { n as supabase } from "./use-auth-BtUVOn94.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/api-K9Bdh_wb.js
var EXPENSE_DELETE_WINDOW_MS = 300 * 60 * 1e3;
function buildExpenseAddedMessage(opts) {
	return `added "${opts.description}" in "${opts.groupName}" (paid by ${opts.paidByName})`;
}
async function getProfile(userId) {
	const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
	if (error) throw error;
	return data;
}
async function updateProfile(userId, patch) {
	const { data, error } = await supabase.from("profiles").upsert({
		id: userId,
		...patch
	}, { onConflict: "id" }).select("*").single();
	if (error) throw error;
	return data;
}
async function findUserByUsername(username) {
	const { data, error } = await supabase.rpc("find_user_by_username", { _username: username.trim() });
	if (error) throw error;
	return (data ?? [])[0] ?? null;
}
async function getMyGroups(userId) {
	const { data: memberships, error: mErr } = await supabase.from("group_members").select("group_id").eq("user_id", userId).eq("status", "accepted");
	if (mErr) throw mErr;
	const ids = (memberships ?? []).map((m) => m.group_id);
	if (ids.length === 0) return [];
	const { data, error } = await supabase.from("groups").select("*").in("id", ids).order("created_at", { ascending: false });
	if (error) throw error;
	return data ?? [];
}
async function createGroup(userId, name, description) {
	const { data, error } = await supabase.from("groups").insert({
		name,
		description,
		created_by: userId
	}).select("*").single();
	if (error) throw error;
	const group = data;
	const { error: memErr } = await supabase.from("group_members").insert({
		group_id: group.id,
		user_id: userId,
		status: "accepted",
		role: "admin"
	});
	if (memErr) throw memErr;
	return group;
}
async function getGroup(groupId) {
	const { data, error } = await supabase.from("groups").select("*").eq("id", groupId).maybeSingle();
	if (error) throw error;
	return data;
}
async function leaveGroup(groupId, userId) {
	const { error } = await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
	if (error) throw error;
}
async function deleteGroup(groupId) {
	const { error } = await supabase.from("groups").delete().eq("id", groupId);
	if (error) throw error;
}
async function getGroupMembers(groupId) {
	const { data, error } = await supabase.from("group_members").select("*").eq("group_id", groupId);
	if (error) throw error;
	return data ?? [];
}
async function getProfilesByIds(ids) {
	if (ids.length === 0) return [];
	const { data, error } = await supabase.from("profiles").select("*").in("id", ids);
	if (error) throw error;
	return data ?? [];
}
async function getNotificationSenderProfiles(senderIds) {
	if (senderIds.length === 0) return [];
	const { data, error } = await supabase.rpc("get_notification_sender_profiles", { _sender_ids: senderIds });
	if (!error && data) return data.map((p) => ({
		...p,
		email: null,
		avatar_url: null,
		created_at: "",
		updated_at: ""
	}));
	return getProfilesByIds(senderIds);
}
async function inviteToGroup(opts) {
	const inviter = await getProfile(opts.inviterId);
	const { error: memErr } = await supabase.from("group_members").insert({
		group_id: opts.groupId,
		user_id: opts.targetUserId,
		status: "pending",
		role: "member",
		invited_by: opts.inviterId
	});
	if (memErr && !memErr.message.includes("duplicate")) throw memErr;
	const { error: notifErr } = await supabase.from("notifications").insert({
		recipient_id: opts.targetUserId,
		sender_id: opts.inviterId,
		type: "group_invite",
		status: "pending",
		group_id: opts.groupId,
		message: `invited you to join "${opts.groupName}"`,
		sender_username: inviter?.username ?? null,
		sender_upi: inviter?.upi_id ?? null
	});
	if (notifErr && /sender_username|column/i.test(notifErr.message)) {
		const { error: retryErr } = await supabase.from("notifications").insert({
			recipient_id: opts.targetUserId,
			sender_id: opts.inviterId,
			type: "group_invite",
			status: "pending",
			group_id: opts.groupId,
			message: `invited you to join "${opts.groupName}"`
		});
		if (retryErr) throw retryErr;
		return;
	}
	if (notifErr) throw notifErr;
}
async function respondToInvite(opts) {
	if (opts.accept) {
		const { error } = await supabase.from("group_members").update({ status: "accepted" }).eq("group_id", opts.groupId).eq("user_id", opts.userId);
		if (error) throw error;
	} else await supabase.from("group_members").delete().eq("group_id", opts.groupId).eq("user_id", opts.userId).eq("status", "pending");
	const { error: nErr } = await supabase.from("notifications").update({ status: opts.accept ? "accepted" : "declined" }).eq("id", opts.notificationId);
	if (nErr) throw nErr;
}
async function getGroupExpenses(groupId) {
	const { data, error } = await supabase.from("expenses").select("*").eq("group_id", groupId).order("created_at", { ascending: false });
	if (error) throw error;
	return data ?? [];
}
async function getExpense(expenseId) {
	const { data, error } = await supabase.from("expenses").select("*").eq("id", expenseId).maybeSingle();
	if (error) throw error;
	return data;
}
async function getSplitsForExpenses(expenseIds) {
	if (expenseIds.length === 0) return [];
	const { data, error } = await supabase.from("expense_splits").select("*").in("expense_id", expenseIds);
	if (error) throw error;
	return data ?? [];
}
async function addExpense(opts) {
	const [group, creator, payer, members] = await Promise.all([
		getGroup(opts.groupId),
		getProfile(opts.createdBy),
		getProfile(opts.paidBy),
		getGroupMembers(opts.groupId)
	]);
	const { data, error } = await supabase.from("expenses").insert({
		group_id: opts.groupId,
		created_by: opts.createdBy,
		paid_by: opts.paidBy,
		description: opts.description,
		amount: opts.amount
	}).select("*").single();
	if (error) throw error;
	const expense = data;
	const rows = opts.splits.map((s) => ({
		expense_id: expense.id,
		user_id: s.userId,
		amount_owed: s.amount
	}));
	const { error: sErr } = await supabase.from("expense_splits").insert(rows);
	if (sErr) throw sErr;
	const recipients = members.filter((member) => member.status === "accepted" && member.user_id !== opts.createdBy).map((member) => member.user_id);
	if (recipients.length > 0) {
		const paidByName = opts.paidBy === opts.createdBy ? creator?.username ? `@${creator.username}` : "the sender" : payer?.username ? `@${payer.username}` : "someone else";
		const notificationRows = recipients.map((recipientId) => ({
			recipient_id: recipientId,
			sender_id: opts.createdBy,
			type: "expense_added",
			status: "pending",
			group_id: opts.groupId,
			amount: opts.amount,
			message: buildExpenseAddedMessage({
				description: opts.description,
				groupName: group?.name ?? "your group",
				paidByName
			}),
			sender_username: creator?.username ?? null,
			sender_upi: creator?.upi_id ?? null
		}));
		let { error: notificationError } = await supabase.from("notifications").insert(notificationRows);
		if (notificationError && /sender_username|column/i.test(notificationError.message)) {
			const fallbackRows = notificationRows.map(({ recipient_id, sender_id, type, status, group_id, amount, message }) => ({
				recipient_id,
				sender_id,
				type,
				status,
				group_id,
				amount,
				message
			}));
			({error: notificationError} = await supabase.from("notifications").insert(fallbackRows));
		}
		if (notificationError) throw notificationError;
	}
	return expense;
}
async function deleteExpense(expenseId, userId) {
	const expense = await getExpense(expenseId);
	if (!expense) throw new Error("Expense not found.");
	if (expense.created_by !== userId) throw new Error("Only the person who added this expense can remove it.");
	if (Date.now() - new Date(expense.created_at).getTime() > EXPENSE_DELETE_WINDOW_MS) throw new Error("This expense can only be removed within 5 hours.");
	const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
	if (error) throw error;
}
function canDeleteExpense(expense, userId, now = Date.now()) {
	if (expense.created_by !== userId) return false;
	return now - new Date(expense.created_at).getTime() <= EXPENSE_DELETE_WINDOW_MS;
}
async function settleByCash(opts) {
	const payer = await getProfile(opts.payerId);
	const expense = await addExpense({
		groupId: opts.groupId,
		createdBy: opts.payerId,
		paidBy: opts.payerId,
		description: "Cash settlement",
		amount: opts.amount,
		splits: [{
			userId: opts.payeeId,
			amount: opts.amount
		}]
	});
	const row = {
		recipient_id: opts.payeeId,
		sender_id: opts.payerId,
		type: "settlement_confirmed",
		status: "pending",
		group_id: opts.groupId,
		amount: opts.amount,
		message: "paid you by cash",
		sender_username: payer?.username ?? null,
		sender_upi: payer?.upi_id ?? null
	};
	let { error } = await supabase.from("notifications").insert(row);
	if (error && /sender_username|column/i.test(error.message)) {
		const { recipient_id, sender_id, type, status, group_id, amount, message } = row;
		({error} = await supabase.from("notifications").insert({
			recipient_id,
			sender_id,
			type,
			status,
			group_id,
			amount,
			message
		}));
	}
	if (error) throw error;
	return expense;
}
async function settleByUpi(opts) {
	const payer = await getProfile(opts.payerId);
	const expense = await addExpense({
		groupId: opts.groupId,
		createdBy: opts.payerId,
		paidBy: opts.payerId,
		description: "UPI settlement",
		amount: opts.amount,
		splits: [{
			userId: opts.payeeId,
			amount: opts.amount
		}]
	});
	const row = {
		recipient_id: opts.payeeId,
		sender_id: opts.payerId,
		type: "settlement_confirmed",
		status: "pending",
		group_id: opts.groupId,
		amount: opts.amount,
		message: "paid you online via UPI",
		sender_username: payer?.username ?? null,
		sender_upi: payer?.upi_id ?? null
	};
	let { error } = await supabase.from("notifications").insert(row);
	if (error && /sender_username|column/i.test(error.message)) {
		const { recipient_id, sender_id, type, status, group_id, amount, message } = row;
		({error} = await supabase.from("notifications").insert({
			recipient_id,
			sender_id,
			type,
			status,
			group_id,
			amount,
			message
		}));
	}
	if (error) throw error;
	return expense;
}
async function getNotifications(userId) {
	const { data, error } = await supabase.from("notifications").select("*").eq("recipient_id", userId).order("created_at", { ascending: false });
	if (error) throw error;
	return data ?? [];
}
async function sendSettlementRequest(opts) {
	const sender = await getProfile(opts.senderId);
	const row = {
		recipient_id: opts.recipientId,
		sender_id: opts.senderId,
		type: "settlement_request",
		status: "pending",
		amount: opts.amount,
		message: opts.message,
		sender_username: sender?.username ?? null,
		sender_upi: sender?.upi_id ?? null
	};
	let { error } = await supabase.from("notifications").insert(row);
	if (error && /sender_username|column/i.test(error.message)) {
		const { recipient_id, sender_id, type, status, amount, message } = row;
		({error} = await supabase.from("notifications").insert({
			recipient_id,
			sender_id,
			type,
			status,
			amount,
			message
		}));
	}
	if (error) throw error;
}
async function markNotificationRead(id) {
	const { error } = await supabase.from("notifications").update({ status: "read" }).eq("id", id);
	if (error) throw error;
}
async function markAllNotificationsRead(userId) {
	const { error } = await supabase.from("notifications").update({ status: "read" }).eq("recipient_id", userId).eq("status", "pending").eq("type", "settlement_request");
	if (error) throw error;
}
async function dismissNotification(id) {
	const { error } = await supabase.from("notifications").delete().eq("id", id);
	if (error) throw error;
}
//#endregion
export { settleByCash as C, sendSettlementRequest as S, updateProfile as T, inviteToGroup as _, deleteGroup as a, markNotificationRead as b, getGroup as c, getMyGroups as d, getNotificationSenderProfiles as f, getSplitsForExpenses as g, getProfilesByIds as h, deleteExpense as i, getGroupExpenses as l, getProfile as m, canDeleteExpense as n, dismissNotification as o, getNotifications as p, createGroup as r, findUserByUsername as s, addExpense as t, getGroupMembers as u, leaveGroup as v, settleByUpi as w, respondToInvite as x, markAllNotificationsRead as y };
