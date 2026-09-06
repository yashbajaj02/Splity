import { supabase } from "./supabase";
import type {
  AppNotification,
  Expense,
  ExpenseSplit,
  Friend,
  FriendRequest,
  FriendRequestStatus,
  Group,
  GroupMember,
  MemberStatus,
  Profile,
  GroupMessage,
  UserSearchResult,
} from "./app-types";
import {
  getCachedData,
  setCachedData,
  enqueueSyncAction,
  type SyncQueueItem,
} from "./offline-db";

// ─────────────────────────────────────────────────────────────────────────────
// CLOUDINARY UPLOAD HELPER
// ─────────────────────────────────────────────────────────────────────────────
export async function uploadToCloudinary(file: File, folder: string): Promise<string> {
  const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/atc7jukt/image/upload";
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "splity_upload");
  formData.append("folder", folder);

  const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to upload image.");
  }
  const data = await res.json();
  return data.secure_url;
}

import { computePairwiseDebts } from "./debt";

const EXPENSE_DELETE_WINDOW_MS = 5 * 60 * 60 * 1000;

export function getCleanExpenseDescription(rawDescription: string): string {
  if (!rawDescription) return "";
  let clean = rawDescription.replace(/\n?<!--SPLIT_NOTES:.*?-->/s, "");
  // Remove settlement metadata appended with || {"settled": ...}
  clean = clean.replace(/\s*\|\|\s*\{.*\}\s*$/s, "");
  return clean.trim();
}

export function parseExpenseDescription(rawDescription: string): {
  cleanDescription: string;
  splitNotes: Record<string, string>;
} {
  return { cleanDescription: getCleanExpenseDescription(rawDescription), splitNotes: {} };
}

export function getCleanMemberName(name: string): string {
  if (!name) return "Member";
  return (
    name
      .replace(/\s*\(@[a-zA-Z0-9._-]+\)/g, "")
      .replace(/^@/, "")
      .trim() || name
  );
}

function buildExpenseAddedMessage(opts: {
  description: string;
  groupName: string;
  paidByName: string;
}) {
  return `added "${opts.description}" in "${opts.groupName}" (paid by ${opts.paidByName})`;
}

/* ------------------------------- PROFILES ------------------------------- */

export async function getProfile(userId: string): Promise<Profile | null> {
  const cacheKey = `profile:${userId}`;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    if (data) setCachedData(cacheKey, data).catch(() => {});
    return data as Profile | null;
  } catch (err) {
    const cached = await getCachedData<Profile>(cacheKey);
    if (cached) return cached;
    throw err;
  }
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, "username" | "upi_id" | "full_name" | "email" | "avatar_url">>,
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: userId, ...patch }, { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw error;
  if (data) setCachedData(`profile:${userId}`, data).catch(() => {});
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
  const cacheKey = `groups:${userId}`;
  try {
    const { data, error } = await supabase
      .from("groups")
      .select("*, group_members!inner(user_id, status)")
      .eq("group_members.user_id", userId)
      .eq("group_members.status", "accepted")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const groups = (data ?? []).map((g: any) => {
      const { group_members, ...rest } = g;
      return rest;
    }) as Group[];
    setCachedData(cacheKey, groups).catch(() => {});
    return groups;
  } catch (err) {
    const cached = await getCachedData<Group[]>(cacheKey);
    if (cached) return cached;
    throw err;
  }
}

export async function createGroup(
  userId: string,
  name: string,
  description: string | null,
  avatar_url?: string | null,
): Promise<Group> {
  const { data, error } = await supabase
    .from("groups")
    .insert({ name, description, avatar_url: avatar_url || null, created_by: userId })
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
  const cacheKey = `group:${groupId}`;
  try {
    const { data, error } = await supabase.from("groups").select("*").eq("id", groupId).maybeSingle();
    if (error) throw error;
    if (data) setCachedData(cacheKey, data).catch(() => {});
    return data as Group | null;
  } catch (err) {
    const cached = await getCachedData<Group>(cacheKey);
    if (cached) return cached;
    throw err;
  }
}

export async function updateGroupAvatar(groupId: string, avatar_url: string | null): Promise<void> {
  const { error } = await supabase.from("groups").update({ avatar_url }).eq("id", groupId);
  if (error) throw error;
}

export async function updateGroupName(groupId: string, name: string): Promise<void> {
  const { error } = await supabase.from("groups").update({ name }).eq("id", groupId);
  if (error) throw error;
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
  const cacheKey = `group-members:${groupId}`;
  try {
    const { data, error } = await supabase.from("group_members").select("*").eq("group_id", groupId);
    if (error) throw error;
    const members = (data ?? []) as GroupMember[];
    setCachedData(cacheKey, members).catch(() => {});
    return members;
  } catch (err) {
    const cached = await getCachedData<GroupMember[]>(cacheKey);
    if (cached) return cached;
    throw err;
  }
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
  const cacheKey = `expenses:${groupId}`;
  try {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const expenses = (data ?? []).map((e) => ({
      ...e,
      description: getCleanExpenseDescription(e.description),
    })) as Expense[];
    setCachedData(cacheKey, expenses).catch(() => {});
    return expenses;
  } catch (err) {
    const cached = await getCachedData<Expense[]>(cacheKey);
    if (cached) return cached;
    throw err;
  }
}

export async function getAllMyExpenses(userId: string): Promise<Expense[]> {
  const cacheKey = `all_my_expenses:${userId}`;
  try {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const expenses = (data ?? []).map((e) => ({
      ...e,
      description: getCleanExpenseDescription(e.description),
    })) as Expense[];
    setCachedData(cacheKey, expenses).catch(() => {});
    return expenses;
  } catch (err) {
    const cached = await getCachedData<Expense[]>(cacheKey);
    if (cached) return cached;
    throw err;
  }
}

export async function getExpense(expenseId: string): Promise<Expense | null> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", expenseId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, description: getCleanExpenseDescription(data.description) } as Expense;
}

export async function getSplitsForGroup(groupId: string): Promise<ExpenseSplit[]> {
  const cacheKey = `splits:${groupId}`;
  try {
    const session = await supabase.auth.getSession();
    const currentUserId = session.data.session?.user?.id;

    // 1. Fetch splits without notes (public to group)
    const { data: splitsData, error: splitsError } = await supabase
      .from("expense_splits")
      .select(
        "id, expense_id, user_id, amount_owed, expenses!inner(group_id, description, created_by)",
      )
      .eq("expenses.group_id", groupId);

    if (splitsError) throw splitsError;

    // 2. Fetch notes in parallel for authorized rows (my splits + expenses I created)
    const notesMap: Record<string, string> = {};

    if (currentUserId && splitsData && splitsData.length > 0) {
      const myOwnedExpenses = Array.from(
        new Set(
          splitsData
            .filter((s) => (s.expenses as any).created_by === currentUserId)
            .map((s) => s.expense_id),
        ),
      );

      const myNotesPromise = supabase
        .from("expense_splits")
        .select("id, note, expenses!inner(group_id)")
        .eq("expenses.group_id", groupId)
        .eq("user_id", currentUserId)
        .not("note", "is", null);

      const ownedNotesPromise =
        myOwnedExpenses.length > 0
          ? Promise.all(
              Array.from({ length: Math.ceil(myOwnedExpenses.length / 100) }, (_, i) => {
                const chunk = myOwnedExpenses.slice(i * 100, (i + 1) * 100);
                return supabase
                  .from("expense_splits")
                  .select("id, note")
                  .in("expense_id", chunk)
                  .not("note", "is", null);
              }),
            )
          : Promise.resolve([]);

      const [{ data: myNotes }, ownedResults] = await Promise.all([
        myNotesPromise,
        ownedNotesPromise,
      ]);

      if (myNotes) {
        for (const n of myNotes) {
          if (n.note) notesMap[n.id] = n.note;
        }
      }

      for (const res of ownedResults) {
        if (res.data) {
          for (const n of res.data) {
            if (n.note) notesMap[n.id] = n.note;
          }
        }
      }
    }

    const splits = (splitsData ?? []).map((d: any) => {
      const { expenses, ...split } = d;
      const legacyNotes = expenses?.description
        ? parseExpenseDescription(expenses.description).splitNotes
        : {};

      return {
        ...split,
        note: notesMap[split.id] || legacyNotes[split.user_id] || null,
      };
    }) as ExpenseSplit[];

    setCachedData(cacheKey, splits).catch(() => {});
    return splits;
  } catch (err) {
    const cached = await getCachedData<ExpenseSplit[]>(cacheKey);
    if (cached) return cached;
    throw err;
  }
}

export async function addExpense(opts: {
  groupId: string;
  createdBy: string;
  description: string;
  amount: number;
  splits: { userId: string; amount: number; note?: string }[];
}) {
  const cleanDescription = getCleanExpenseDescription(opts.description);

  // Offline queue support: if offline, store in sync queue and return optimistic record
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueueSyncAction("add_expense", opts);
    const mockExpense: Expense = {
      id: `temp_exp_${Date.now()}`,
      group_id: opts.groupId,
      created_by: opts.createdBy,
      paid_by: opts.createdBy,
      description: cleanDescription,
      amount: opts.amount,
      created_at: new Date().toISOString(),
    };
    const cached = (await getCachedData<Expense[]>(`expenses:${opts.groupId}`)) || [];
    await setCachedData(`expenses:${opts.groupId}`, [mockExpense, ...cached]);
    return mockExpense;
  }

  // 1. Insert expense with clean description immediately
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      group_id: opts.groupId,
      created_by: opts.createdBy,
      paid_by: opts.createdBy, // always the authenticated user
      description: cleanDescription,
      amount: opts.amount,
    })
    .select("*")
    .single();
  if (error) throw error;
  const expense = data as Expense;

  // 2. Insert splits with person-specific notes in expense_splits table
  const rows = opts.splits.map((s) => ({
    expense_id: expense.id,
    user_id: s.userId,
    amount_owed: s.amount,
    ...(s.note?.trim() ? { note: s.note.trim() } : {}),
  }));
  const { error: sErr } = await supabase.from("expense_splits").insert(rows);
  if (sErr) {
    if (/note|column/i.test(sErr.message)) {
      throw new Error(
        "Database schema error: 'note' column is missing in 'expense_splits' table. Please run the migration script in Supabase SQL Editor: ALTER TABLE public.expense_splits ADD COLUMN IF NOT EXISTS note TEXT;",
      );
    }
    throw sErr;
  }

  // 3. Send notifications asynchronously without failing the expense operation
  if (!cleanDescription.toLowerCase().includes("settlement")) {
    Promise.all([getGroup(opts.groupId), getProfile(opts.createdBy), getGroupMembers(opts.groupId)])
      .then(async ([group, creator, members]) => {
        const involvedUserIds = new Set(opts.splits.map((s) => s.userId));
        const recipients = members
          .filter(
            (member) =>
              member.status === "accepted" &&
              member.user_id !== opts.createdBy &&
              involvedUserIds.has(member.user_id),
          )
          .map((member) => member.user_id);

        if (recipients.length > 0) {
          const paidByName = creator?.username
            ? `@${creator.username}`
            : (creator?.full_name ?? "the sender");
          const notificationRows = recipients.map((recipientId) => {
            const recipientSplit = opts.splits.find((s) => s.userId === recipientId);
            const recipientAmount = recipientSplit ? recipientSplit.amount : opts.amount;

            return {
              recipient_id: recipientId,
              sender_id: opts.createdBy,
              type: "expense_added" as const,
              status: "pending" as const,
              group_id: opts.groupId,
              amount: recipientAmount,
              message: buildExpenseAddedMessage({
                description: cleanDescription,
                groupName: group?.name ?? "your group",
                paidByName,
              }),
              sender_username: creator?.username ?? null,
              sender_upi: creator?.upi_id ?? null,
            };
          });

          const { error: notificationError } = await supabase
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
            await supabase.from("notifications").insert(fallbackRows);
          }
        }
      })
      .catch((err) => {
        console.error("Non-fatal notification dispatch error:", err);
      });
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

export function canEditExpense(expense: Expense, userId: string, now = Date.now()) {
  return canDeleteExpense(expense, userId, now);
}

export async function updateExpense(opts: {
  expenseId: string;
  userId: string;
  description: string;
  amount: number;
  splits: { userId: string; amount: number; note?: string }[];
}) {
  const expense = await getExpense(opts.expenseId);
  if (!expense) throw new Error("Expense not found.");
  if (expense.created_by !== opts.userId) {
    throw new Error("Only the person who added this expense can edit it.");
  }

  const ageMs = Date.now() - new Date(expense.created_at).getTime();
  if (ageMs > EXPENSE_DELETE_WINDOW_MS) {
    throw new Error("This expense can only be edited within 5 hours.");
  }

  const cleanDescription = getCleanExpenseDescription(opts.description);

  const { data, error } = await supabase
    .from("expenses")
    .update({
      description: cleanDescription,
      amount: opts.amount,
    })
    .eq("id", opts.expenseId)
    .select("*")
    .single();
  if (error) throw error;

  const { error: delSplitsErr } = await supabase
    .from("expense_splits")
    .delete()
    .eq("expense_id", opts.expenseId);
  if (delSplitsErr) throw delSplitsErr;

  const rows = opts.splits.map((s) => ({
    expense_id: opts.expenseId,
    user_id: s.userId,
    amount_owed: s.amount,
    ...(s.note?.trim() ? { note: s.note.trim() } : {}),
  }));
  const { error: sErr } = await supabase.from("expense_splits").insert(rows);
  if (sErr) {
    if (/note|column/i.test(sErr.message)) {
      throw new Error(
        "Database schema error: 'note' column is missing in 'expense_splits' table. Please run the migration script in Supabase SQL Editor: ALTER TABLE public.expense_splits ADD COLUMN IF NOT EXISTS note TEXT;",
      );
    }
    throw sErr;
  }

  return data as Expense;
}

const getSettlementLocks = () => {
  if (typeof window === "undefined") {
    return { has: () => false, add: () => {}, delete: () => {} } as unknown as Set<string>;
  }
  if (!(window as any).__settlementLocks) {
    (window as any).__settlementLocks = new Set<string>();
  }
  return (window as any).__settlementLocks as Set<string>;
};

async function getRemainingDebt(
  payerId: string,
  payeeId: string,
  groupId?: string,
): Promise<number> {
  const groups = groupId
    ? [{ id: groupId, name: "", description: null, created_by: "", created_at: "" }]
    : await getMyGroups(payerId);
  if (groups.length === 0) return 0;
  const expenseArrays = await Promise.all(groups.map((g) => getGroupExpenses(g.id)));
  const allExpenses: Expense[] = expenseArrays.flat();
  if (allExpenses.length === 0) return 0;

  const splitsArrays = await Promise.all(groups.map((g) => getSplitsForGroup(g.id)));
  const splits = splitsArrays.flat();

  const splitsByExpense: Record<string, ExpenseSplit[]> = {};
  for (const s of splits) {
    (splitsByExpense[s.expense_id] ??= []).push(s);
  }
  const pairwiseDebts = computePairwiseDebts(allExpenses, splitsByExpense);
  const debt = pairwiseDebts.find((d) => d.from === payerId && d.to === payeeId);
  return debt ? debt.amount : 0;
}

export async function settleByCash(opts: {
  groupId: string;
  payerId: string;
  payeeId: string;
  amount: number;
  settledExpenses?: Record<string, number>;
}) {
  const lockKey = `${opts.payerId}->${opts.payeeId}`;
  const locks = getSettlementLocks();
  if (locks.has(lockKey)) {
    throw new Error("Already Settled");
  }
  locks.add(lockKey);

  try {
    const remaining = await getRemainingDebt(opts.payerId, opts.payeeId, opts.groupId);
    if (remaining <= 0) {
      throw new Error("Already Settled");
    }

    const payer = await getProfile(opts.payerId);
    const expense = await addExpense({
      groupId: opts.groupId,
      createdBy: opts.payerId,
      description: opts.settledExpenses
        ? `Cash settlement || ${JSON.stringify({ settled: opts.settledExpenses })}`
        : "Cash settlement",
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
    try {
      const { error } = await supabase.from("notifications").insert(row);
      if (error && /sender_username|column/i.test(error.message)) {
        const { recipient_id, sender_id, type, status, group_id, amount, message } = row;
        await supabase.from("notifications").insert({
          recipient_id,
          sender_id,
          type,
          status,
          group_id,
          amount,
          message,
        });
      }
    } catch (e) {
      console.error("Non-fatal notification insertion error in settleByCash:", e);
    }

    return expense;
  } finally {
    locks.delete(lockKey);
  }
}

export async function settleByUpi(opts: {
  groupId: string;
  payerId: string;
  payeeId: string;
  amount: number;
  settledExpenses?: Record<string, number>;
}) {
  const lockKey = `${opts.payerId}->${opts.payeeId}`;
  const locks = getSettlementLocks();
  if (locks.has(lockKey)) {
    throw new Error("Already Settled");
  }
  locks.add(lockKey);

  try {
    const remaining = await getRemainingDebt(opts.payerId, opts.payeeId, opts.groupId);
    if (remaining <= 0) {
      throw new Error("Already Settled");
    }

    const payer = await getProfile(opts.payerId);
    const expense = await addExpense({
      groupId: opts.groupId,
      createdBy: opts.payerId,
      description: opts.settledExpenses
        ? `UPI settlement || ${JSON.stringify({ settled: opts.settledExpenses })}`
        : "UPI settlement",
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
    try {
      const { error } = await supabase.from("notifications").insert(row);
      if (error && /sender_username|column/i.test(error.message)) {
        const { recipient_id, sender_id, type, status, group_id, amount, message } = row;
        await supabase.from("notifications").insert({
          recipient_id,
          sender_id,
          type,
          status,
          group_id,
          amount,
          message,
        });
      }
    } catch (e) {
      console.error("Non-fatal notification insertion error in settleByUpi:", e);
    }
  } finally {
    locks.delete(lockKey);
  }
}

/* ----------------------------- NOTIFICATIONS ---------------------------- */

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  const cacheKey = `notifications:${userId}`;
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const notifications = (data ?? []).map((notif) => ({
      ...notif,
      message: notif.message ? getCleanExpenseDescription(notif.message) : notif.message,
    })) as AppNotification[];
    setCachedData(cacheKey, notifications).catch(() => {});
    return notifications;
  } catch (err) {
    const cached = await getCachedData<AppNotification[]>(cacheKey);
    if (cached) return cached;
    throw err;
  }
}

export async function sendSettlementRequest(opts: {
  recipientId: string;
  senderId: string;
  amount: number;
  message: string;
}) {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: recentNotifs } = await supabase
    .from("notifications")
    .select("id")
    .eq("sender_id", opts.senderId)
    .eq("recipient_id", opts.recipientId)
    .eq("type", "settlement_request")
    .gte("created_at", fiveMinutesAgo)
    .limit(1);

  if (recentNotifs && recentNotifs.length > 0) {
    throw new Error("Please wait 5 minutes before sending another reminder.");
  }

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

export async function getGroupMessages(
  groupId: string,
  limit = 50,
  beforeCreatedAt?: string,
): Promise<GroupMessage[]> {
  const cacheKey = `chat:${groupId}`;
  try {
    let query = supabase
      .from("group_messages")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (beforeCreatedAt) {
      query = query.lt("created_at", beforeCreatedAt);
    }

    const { data, error } = await query;
    if (error) {
      console.warn("Could not fetch group messages:", error.message);
      const cached = await getCachedData<GroupMessage[]>(cacheKey);
      return cached || [];
    }
    const msgs = ((data as GroupMessage[]) ?? []).reverse();
    setCachedData(cacheKey, msgs).catch(() => {});
    return msgs;
  } catch (err) {
    console.warn("Error fetching group messages:", err);
    const cached = await getCachedData<GroupMessage[]>(cacheKey);
    return cached || [];
  }
}

export async function sendGroupMessage(params: {
  groupId: string;
  senderId: string;
  messageText: string;
  mentionedUserId?: string | null;
  mentionedAll?: boolean;
}): Promise<GroupMessage> {
  const isMentionUser = !!params.mentionedUserId;
  const isMentionAll = !!params.mentionedAll;

  // Retention: 24 hours for @user, 7 days for normal or @all
  const retentionMs = isMentionUser ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + retentionMs).toISOString();

  // Offline queue support
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueueSyncAction("send_message", params);
    const mockMsg: GroupMessage = {
      id: `temp_msg_${Date.now()}`,
      group_id: params.groupId,
      sender_id: params.senderId,
      message_text: params.messageText.trim(),
      mentioned_user_id: params.mentionedUserId ?? null,
      mentioned_all: isMentionAll,
      is_edited: false,
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
    };
    const cached = (await getCachedData<GroupMessage[]>(`chat:${params.groupId}`)) || [];
    await setCachedData(`chat:${params.groupId}`, [...cached, mockMsg]);
    return mockMsg;
  }

  const row = {
    group_id: params.groupId,
    sender_id: params.senderId,
    message_text: params.messageText.trim(),
    mentioned_user_id: params.mentionedUserId ?? null,
    mentioned_all: isMentionAll,
    is_edited: false,
    expires_at: expiresAt,
  };

  const { data, error } = await supabase
    .from("group_messages")
    .insert(row)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data as GroupMessage;
}

export async function editGroupMessage(
  messageId: string,
  newMessageText: string,
): Promise<GroupMessage> {
  const { data, error } = await supabase
    .from("group_messages")
    .update({
      message_text: newMessageText.trim(),
      is_edited: true,
      edited_at: new Date().toISOString(),
    })
    .eq("id", messageId)
    .select()
    .single();

  if (error) throw error;
  return data as GroupMessage;
}

export async function deleteGroupMessage(messageId: string): Promise<void> {
  const { error } = await supabase.from("group_messages").delete().eq("id", messageId);
  if (error) throw error;
}

/* ─────────────────────────────────────────────────────────────────────────────
   FRIENDS
──────────────────────────────────────────────────────────────────────────── */

/** Search profiles by name or username (excludes current user). */
export async function searchUsersByName(query: string): Promise<UserSearchResult[]> {
  if (!query.trim()) return [];
  try {
    const { data, error } = await supabase.rpc("search_profiles_by_name", {
      _query: query.trim(),
      _limit: 15,
    });
    if (error) throw error;
    return (data ?? []) as UserSearchResult[];
  } catch (err: any) {
    console.warn("search_profiles_by_name RPC error, falling back to direct query:", err?.message || err);
    try {
      const { data: fallbackData } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .or(`username.ilike.%${query.trim()}%,full_name.ilike.%${query.trim()}%`)
        .limit(15);
      if (fallbackData) {
        const { data: authData } = await supabase.auth.getUser();
        const myId = authData?.user?.id;
        return fallbackData
          .filter((u) => u.id !== myId)
          .map((u) => ({
            id: u.id,
            username: u.username ?? "",
            full_name: u.full_name ?? "",
            avatar_url: u.avatar_url ?? null,
          }));
      }
    } catch {
      // ignore fallback error
    }
    return [];
  }
}

/** Send a friend request from currentUserId to targetUserId. */
export async function sendFriendRequest(
  senderId: string,
  recipientId: string,
): Promise<void> {
  // Upsert so re-requesting after a decline works.
  const { error: frErr } = await supabase.from("friend_requests").upsert(
    { sender_id: senderId, recipient_id: recipientId, status: "pending" },
    { onConflict: "sender_id,recipient_id" },
  );
  if (frErr) throw frErr;

  // Create a notification for the recipient.
  const sender = await getProfile(senderId);
  const { error: notifErr } = await supabase.from("notifications").insert({
    recipient_id: recipientId,
    sender_id: senderId,
    type: "friend_request",
    status: "pending",
    message: `sent you a friend request`,
    sender_username: sender?.username ?? null,
    sender_upi: sender?.upi_id ?? null,
  });
  // Notification failures are non-fatal; log and continue.
  if (notifErr) console.warn("Friend request notification failed:", notifErr.message);
}

/** Accept or decline a friend request. */
export async function respondToFriendRequest(opts: {
  notificationId: string;
  senderId: string;
  recipientId: string; // current user
  accept: boolean;
}): Promise<void> {
  if (opts.accept) {
    // Insert symmetric friendship rows.
    const { error: f1 } = await supabase
      .from("friends")
      .upsert({ user_id: opts.recipientId, friend_id: opts.senderId }, { onConflict: "user_id,friend_id" });
    if (f1) throw f1;
    const { error: f2 } = await supabase
      .from("friends")
      .upsert({ user_id: opts.senderId, friend_id: opts.recipientId }, { onConflict: "user_id,friend_id" });
    if (f2) throw f2;

    // Mark request as accepted.
    await supabase
      .from("friend_requests")
      .update({ status: "accepted" })
      .eq("sender_id", opts.senderId)
      .eq("recipient_id", opts.recipientId);

    // Notify the original sender that their request was accepted.
    const acceptor = await getProfile(opts.recipientId);
    await supabase.from("notifications").insert({
      recipient_id: opts.senderId,
      sender_id: opts.recipientId,
      type: "friend_request",
      status: "accepted",
      message: `accepted your friend request`,
      sender_username: acceptor?.username ?? null,
    });
  } else {
    // Declined: delete the friend request row.
    await supabase
      .from("friend_requests")
      .delete()
      .eq("sender_id", opts.senderId)
      .eq("recipient_id", opts.recipientId);
  }

  // Update the notification status.
  const { error: nErr } = await supabase
    .from("notifications")
    .update({ status: opts.accept ? "accepted" : "declined" })
    .eq("id", opts.notificationId);
  if (nErr) console.warn("Could not update friend request notification:", nErr.message);
}

/** Get the current user's friends with their profile data. */
export async function getFriends(userId: string): Promise<Friend[]> {
  const cacheKey = `friends:${userId}`;
  try {
    const { data, error } = await supabase
      .from("friends")
      .select("id, user_id, friend_id, created_at, profiles:friend_id(id, username, full_name, avatar_url)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const friends = (data ?? []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      friend_id: row.friend_id,
      created_at: row.created_at,
      profile: row.profiles ?? undefined,
    })) as Friend[];
    setCachedData(cacheKey, friends).catch(() => {});
    return friends;
  } catch (err) {
    const cached = await getCachedData<Friend[]>(cacheKey);
    if (cached) return cached;
    throw err;
  }
}

/** Background sync item executor */
export async function executeSyncAction(item: SyncQueueItem): Promise<boolean> {
  try {
    if (item.action === "add_expense") {
      await addExpense(item.payload);
      return true;
    }
    if (item.action === "send_message") {
      await sendGroupMessage(item.payload);
      return true;
    }
    if (item.action === "mark_paid") {
      if (item.payload.type === "cash") {
        await settleByCash(item.payload);
      } else {
        await settleByUpi(item.payload);
      }
      return true;
    }
    return true;
  } catch (err) {
    console.warn("[Sync] Error processing queued action:", item.action, err);
    return false;
  }
}

/** Get the friend request status between the current user and another user. */
export async function getFriendRequestStatus(
  currentUserId: string,
  targetUserId: string,
): Promise<FriendRequestStatus> {
  // Check if already friends.
  const { data: friendRow } = await supabase
    .from("friends")
    .select("id")
    .eq("user_id", currentUserId)
    .eq("friend_id", targetUserId)
    .maybeSingle();
  if (friendRow) return "friends";

  // Check outgoing request.
  const { data: sentRow } = await supabase
    .from("friend_requests")
    .select("id")
    .eq("sender_id", currentUserId)
    .eq("recipient_id", targetUserId)
    .eq("status", "pending")
    .maybeSingle();
  if (sentRow) return "pending_sent";

  // Check incoming request.
  const { data: receivedRow } = await supabase
    .from("friend_requests")
    .select("id")
    .eq("sender_id", targetUserId)
    .eq("recipient_id", currentUserId)
    .eq("status", "pending")
    .maybeSingle();
  if (receivedRow) return "pending_received";

  return "none";
}

/** Remove a friend (deletes both symmetric rows). */
export async function removeFriend(userId: string, friendId: string): Promise<void> {
  await supabase.from("friends").delete().eq("user_id", userId).eq("friend_id", friendId);
  await supabase.from("friends").delete().eq("user_id", friendId).eq("friend_id", userId);
  // Also clean up any accepted friend_request rows.
  await supabase
    .from("friend_requests")
    .delete()
    .or(`and(sender_id.eq.${userId},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${userId})`);
}

/** Get a user's friends that are NOT yet in a specific group — for the invite dialog. */
export async function getFriendsNotInGroup(
  userId: string,
  groupId: string,
): Promise<Friend[]> {
  const allFriends = await getFriends(userId);
  const { data: members } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("status", "accepted");
  const memberSet = new Set((members ?? []).map((m: any) => m.user_id));
  return allFriends.filter((f) => !memberSet.has(f.friend_id));
}
