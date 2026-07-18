import { supabase } from "./supabase";
import type {
  AppNotification,
  Expense,
  ExpenseSplit,
  Group,
  GroupMember,
  Profile,
} from "./app-types";

const EXPENSE_DELETE_WINDOW_MS = 5 * 60 * 60 * 1000;

function buildExpenseAddedMessage(opts: {
  description: string;
  groupName: string;
  paidByName: string;
}) {
  return `added "${opts.description}" in "${opts.groupName}" (paid by ${opts.paidByName})`;
}

/* ------------------------------- PROFILES ------------------------------- */

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, "username" | "upi_id" | "full_name" | "email">>,
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: userId, ...patch }, { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function findUserByUsername(username: string) {
  const { data, error } = await supabase.rpc("find_user_by_username", {
    _username: username.trim(),
  });
  if (error) throw error;
  const rows = (data ?? []) as {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  }[];
  return rows[0] ?? null;
}

/* -------------------------------- GROUPS -------------------------------- */

export async function getMyGroups(userId: string): Promise<Group[]> {
  const { data: memberships, error: mErr } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId)
    .eq("status", "accepted");
  if (mErr) throw mErr;
  const ids = (memberships ?? []).map((m) => m.group_id as string);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .in("id", ids)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Group[];
}

export async function createGroup(
  userId: string,
  name: string,
  description: string | null,
): Promise<Group> {
  const { data, error } = await supabase
    .from("groups")
    .insert({ name, description, created_by: userId })
    .select("*")
    .single();
  if (error) throw error;
  const group = data as Group;
  // Add creator as accepted admin member.
  const { error: memErr } = await supabase.from("group_members").insert({
    group_id: group.id,
    user_id: userId,
    status: "accepted",
    role: "admin",
  });
  if (memErr) throw memErr;
  return group;
}

export async function getGroup(groupId: string): Promise<Group | null> {
  const { data, error } = await supabase.from("groups").select("*").eq("id", groupId).maybeSingle();
  if (error) throw error;
  return data as Group | null;
}

export async function leaveGroup(groupId: string, userId: string) {
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteGroup(groupId: string) {
  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  if (error) throw error;
}

/* ---------------------------- GROUP MEMBERS ----------------------------- */

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase.from("group_members").select("*").eq("group_id", groupId);
  if (error) throw error;
  return (data ?? []) as GroupMember[];
}

export async function getProfilesByIds(ids: string[]): Promise<Profile[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("profiles").select("*").in("id", ids);
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function getNotificationSenderProfiles(senderIds: string[]): Promise<Profile[]> {
  if (senderIds.length === 0) return [];
  const { data, error } = await supabase.rpc("get_notification_sender_profiles", {
    _sender_ids: senderIds,
  });
  if (!error && data) {
    return (data as Pick<Profile, "id" | "username" | "full_name" | "upi_id">[]).map((p) => ({
      ...p,
      email: null,
      avatar_url: null,
      created_at: "",
      updated_at: "",
    }));
  }
  return getProfilesByIds(senderIds);
}

export async function inviteToGroup(opts: {
  groupId: string;
  groupName: string;
  targetUserId: string;
  inviterId: string;
}) {
  const inviter = await getProfile(opts.inviterId);

  const { error: memErr } = await supabase.from("group_members").insert({
    group_id: opts.groupId,
    user_id: opts.targetUserId,
    status: "pending",
    role: "member",
    invited_by: opts.inviterId,
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
    sender_upi: inviter?.upi_id ?? null,
  });
  if (notifErr && /sender_username|column/i.test(notifErr.message)) {
    const { error: retryErr } = await supabase.from("notifications").insert({
      recipient_id: opts.targetUserId,
      sender_id: opts.inviterId,
      type: "group_invite",
      status: "pending",
      group_id: opts.groupId,
      message: `invited you to join "${opts.groupName}"`,
    });
    if (retryErr) throw retryErr;
    return;
  }
  if (notifErr) throw notifErr;
}

export async function respondToInvite(opts: {
  notificationId: string;
  groupId: string;
  userId: string;
  accept: boolean;
}) {
  if (opts.accept) {
    const { error } = await supabase
      .from("group_members")
      .update({ status: "accepted" })
      .eq("group_id", opts.groupId)
      .eq("user_id", opts.userId);
    if (error) throw error;
  } else {
    // Decline: remove the pending membership row.
    await supabase
      .from("group_members")
      .delete()
      .eq("group_id", opts.groupId)
      .eq("user_id", opts.userId)
      .eq("status", "pending");
  }
  const { error: nErr } = await supabase
    .from("notifications")
    .update({ status: opts.accept ? "accepted" : "declined" })
    .eq("id", opts.notificationId);
  if (nErr) throw nErr;
}

/* ------------------------------- EXPENSES ------------------------------- */

export async function getGroupExpenses(groupId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Expense[];
}

export async function getExpense(expenseId: string): Promise<Expense | null> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", expenseId)
    .maybeSingle();
  if (error) throw error;
  return data as Expense | null;
}

export async function getSplitsForExpenses(expenseIds: string[]): Promise<ExpenseSplit[]> {
  if (expenseIds.length === 0) return [];
  const { data, error } = await supabase
    .from("expense_splits")
    .select("*")
    .in("expense_id", expenseIds);
  if (error) throw error;
  return (data ?? []) as ExpenseSplit[];
}

export async function addExpense(opts: {
  groupId: string;
  createdBy: string;
  description: string;
  amount: number;
  splits: { userId: string; amount: number }[];
}) {
  const [group, creator, members] = await Promise.all([
    getGroup(opts.groupId),
    getProfile(opts.createdBy),
    getGroupMembers(opts.groupId),
  ]);

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      group_id: opts.groupId,
      created_by: opts.createdBy,
      paid_by: opts.createdBy,  // always the authenticated user
      description: opts.description,
      amount: opts.amount,
    })
    .select("*")
    .single();
  if (error) throw error;
  const expense = data as Expense;

  const rows = opts.splits.map((s) => ({
    expense_id: expense.id,
    user_id: s.userId,
    amount_owed: s.amount,
  }));
  const { error: sErr } = await supabase.from("expense_splits").insert(rows);
  if (sErr) throw sErr;

  const involvedUserIds = new Set(opts.splits.map((s) => s.userId));
  const recipients = members
    .filter(
      (member) =>
        member.status === "accepted" &&
        member.user_id !== opts.createdBy &&
        involvedUserIds.has(member.user_id)
    )
    .map((member) => member.user_id);

  if (recipients.length > 0) {
    const paidByName = creator?.username
      ? `@${creator.username}`
      : "the sender";

    const notificationRows = recipients.map((recipientId) => ({
      recipient_id: recipientId,
      sender_id: opts.createdBy,
      type: "expense_added" as const,
      status: "pending" as const,
      group_id: opts.groupId,
      amount: opts.amount,
      message: buildExpenseAddedMessage({
        description: opts.description,
        groupName: group?.name ?? "your group",
        paidByName,
      }),
      sender_username: creator?.username ?? null,
      sender_upi: creator?.upi_id ?? null,
    }));

    let { error: notificationError } = await supabase
      .from("notifications")
      .insert(notificationRows);

    if (notificationError && /sender_username|column/i.test(notificationError.message)) {
      const fallbackRows = notificationRows.map(
        ({ recipient_id, sender_id, type, status, group_id, amount, message }) => ({
          recipient_id,
          sender_id,
          type,
          status,
          group_id,
          amount,
          message,
        }),
      );
      ({ error: notificationError } = await supabase.from("notifications").insert(fallbackRows));
    }
    if (notificationError) throw notificationError;
  }

  return expense;
}

export async function deleteExpense(expenseId: string, userId: string) {
  const expense = await getExpense(expenseId);
  if (!expense) throw new Error("Expense not found.");
  if (expense.created_by !== userId) {
    throw new Error("Only the person who added this expense can remove it.");
  }

  const ageMs = Date.now() - new Date(expense.created_at).getTime();
  if (ageMs > EXPENSE_DELETE_WINDOW_MS) {
    throw new Error("This expense can only be removed within 5 hours.");
  }

  const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
  if (error) throw error;
}

export function canDeleteExpense(expense: Expense, userId: string, now = Date.now()) {
  if (expense.created_by !== userId) return false;
  return now - new Date(expense.created_at).getTime() <= EXPENSE_DELETE_WINDOW_MS;
}

export async function settleByCash(opts: {
  groupId: string;
  payerId: string;
  payeeId: string;
  amount: number;
}) {
  const payer = await getProfile(opts.payerId);
  const expense = await addExpense({
    groupId: opts.groupId,
    createdBy: opts.payerId,
    description: "Cash settlement",
    amount: opts.amount,
    splits: [{ userId: opts.payeeId, amount: opts.amount }],
  });

  const row = {
    recipient_id: opts.payeeId,
    sender_id: opts.payerId,
    type: "settlement_confirmed" as const,
    status: "pending" as const,
    group_id: opts.groupId,
    amount: opts.amount,
    message: "paid you by cash",
    sender_username: payer?.username ?? null,
    sender_upi: payer?.upi_id ?? null,
  };
  let { error } = await supabase.from("notifications").insert(row);
  if (error && /sender_username|column/i.test(error.message)) {
    const { recipient_id, sender_id, type, status, group_id, amount, message } = row;
    ({ error } = await supabase.from("notifications").insert({
      recipient_id,
      sender_id,
      type,
      status,
      group_id,
      amount,
      message,
    }));
  }
  if (error) throw error;

  return expense;
}

export async function settleByUpi(opts: {
  groupId: string;
  payerId: string;
  payeeId: string;
  amount: number;
}) {
  const payer = await getProfile(opts.payerId);
  const expense = await addExpense({
    groupId: opts.groupId,
    createdBy: opts.payerId,
    description: "UPI settlement",
    amount: opts.amount,
    splits: [{ userId: opts.payeeId, amount: opts.amount }],
  });

  const row = {
    recipient_id: opts.payeeId,
    sender_id: opts.payerId,
    type: "settlement_confirmed" as const,
    status: "pending" as const,
    group_id: opts.groupId,
    amount: opts.amount,
    message: "paid you online via UPI",
    sender_username: payer?.username ?? null,
    sender_upi: payer?.upi_id ?? null,
  };
  let { error } = await supabase.from("notifications").insert(row);
  if (error && /sender_username|column/i.test(error.message)) {
    const { recipient_id, sender_id, type, status, group_id, amount, message } = row;
    ({ error } = await supabase.from("notifications").insert({
      recipient_id,
      sender_id,
      type,
      status,
      group_id,
      amount,
      message,
    }));
  }
  if (error) throw error;

  return expense;
}

/* ----------------------------- NOTIFICATIONS ---------------------------- */

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

export async function sendSettlementRequest(opts: {
  recipientId: string;
  senderId: string;
  amount: number;
  message: string;
}) {
  const sender = await getProfile(opts.senderId);
  const row = {
    recipient_id: opts.recipientId,
    sender_id: opts.senderId,
    type: "settlement_request" as const,
    status: "pending" as const,
    amount: opts.amount,
    message: opts.message,
    sender_username: sender?.username ?? null,
    sender_upi: sender?.upi_id ?? null,
  };
  let { error } = await supabase.from("notifications").insert(row);
  if (error && /sender_username|column/i.test(error.message)) {
    const { recipient_id, sender_id, type, status, amount, message } = row;
    ({ error } = await supabase.from("notifications").insert({
      recipient_id,
      sender_id,
      type,
      status,
      amount,
      message,
    }));
  }
  if (error) throw error;
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase.from("notifications").update({ status: "read" }).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ status: "read" })
    .eq("recipient_id", userId)
    .eq("status", "pending");
  if (error) throw error;
}

export async function dismissNotification(id: string) {
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) throw error;
}

export async function dismissAllNotifications(userId: string) {
  const { error } = await supabase.from("notifications").delete().eq("recipient_id", userId);
  if (error) throw error;
}
