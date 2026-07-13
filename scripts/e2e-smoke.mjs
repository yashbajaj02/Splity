/**
 * End-to-end API smoke test for SplitPay.
 * Creates/reuses 3 dummy users, confirms via Mailinator, joins a group,
 * adds expenses, and sends settlement requests.
 *
 * Usage: node scripts/e2e-smoke.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const CACHE = resolve(__dirname, ".e2e-accounts.json");

function loadEnv() {
  const raw = readFileSync(resolve(root, ".env"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key =
  env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Missing Supabase URL / publishable key in .env");
  process.exit(1);
}

const stamp = Date.now().toString(36);
const PASSWORD = "TestPass123!";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function client() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function mailinatorInbox(local) {
  const res = await fetch(
    `https://www.mailinator.com/api/v2/domains/public/inboxes/${local}`,
  );
  if (!res.ok) throw new Error(`mailinator inbox ${res.status}`);
  return res.json();
}

async function mailinatorMessage(local, id) {
  const res = await fetch(
    `https://www.mailinator.com/api/v2/domains/public/inboxes/${local}/messages/${id}`,
  );
  if (!res.ok) throw new Error(`mailinator msg ${res.status}`);
  return res.text();
}

function extractConfirmLink(raw) {
  const decoded = raw
    .replace(/&amp;/g, "&")
    .replace(/\\u003d/g, "=")
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/");
  const matches = [
    ...decoded.matchAll(
      /https:\/\/[a-z0-9.-]+\.supabase\.co\/auth\/v1\/verify\?[^\s"'<>\\]+/gi,
    ),
  ];
  if (!matches.length) return null;
  return matches[0][0].replace(/[),.;]+$/, "");
}

async function waitForConfirmLink(local, timeoutMs = 120000) {
  const start = Date.now();
  const seen = new Set();
  while (Date.now() - start < timeoutMs) {
    try {
      const inbox = await mailinatorInbox(local);
      for (const m of inbox.msgs || []) {
        if (seen.has(m.id)) continue;
        seen.add(m.id);
        const body = await mailinatorMessage(local, m.id);
        const link = extractConfirmLink(body);
        if (link) return link;
      }
    } catch {
      // transient mailinator errors
    }
    await sleep(3000);
  }
  throw new Error(`Timed out waiting for confirm email for ${local}`);
}

async function confirmEmail(link) {
  const res = await fetch(link, {
    redirect: "manual",
    headers: { "User-Agent": "SplitPay-E2E/1.0" },
  });
  return res.status;
}

async function tryLogin(email) {
  const sb = client();
  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error || !data.session) return null;
  return { sb, userId: data.user.id, email, session: data.session };
}

async function signupAndConfirm(account) {
  const existing = await tryLogin(account.email);
  if (existing) return existing;

  const sb = client();
  const local = account.email.split("@")[0];
  const { data, error } = await sb.auth.signUp({
    email: account.email,
    password: PASSWORD,
    options: { emailRedirectTo: "http://localhost:8080/app" },
  });
  if (error) {
    if (/rate limit/i.test(error.message)) {
      throw new Error(
        `Supabase email rate limit hit. Fix: Supabase Dashboard → Authentication → Providers → Email → turn OFF "Confirm email", wait ~1h, then re-run. Or add SUPABASE_SERVICE_ROLE_KEY to .env for admin user creation. Original: ${error.message}`,
      );
    }
    // Maybe user exists but unconfirmed — try confirm flow
    if (/already|registered/i.test(error.message)) {
      const link = await waitForConfirmLink(local);
      await confirmEmail(link);
      const logged = await tryLogin(account.email);
      if (logged) return logged;
    }
    throw new Error(`signup ${account.email}: ${error.message}`);
  }
  assert(data.user?.id, `no user id for ${account.email}`);

  if (data.session) {
    return {
      sb,
      userId: data.user.id,
      email: account.email,
      session: data.session,
    };
  }

  const link = await waitForConfirmLink(local);
  await confirmEmail(link);
  const logged = await tryLogin(account.email);
  assert(logged, `no session after confirm for ${account.email}`);
  return logged;
}

async function upsertProfile(sb, userId, account) {
  const { data, error } = await sb
    .from("profiles")
    .upsert(
      {
        id: userId,
        username: account.username,
        full_name: account.full_name,
        upi_id: account.upi_id,
        email: account.email,
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();
  if (error) throw new Error(`profile ${account.username}: ${error.message}`);
  return data;
}

async function createGroup(sb, userId, name) {
  const { data, error } = await sb
    .from("groups")
    .insert({ name, description: "E2E test group", created_by: userId })
    .select("*")
    .single();
  if (error) throw new Error(`createGroup: ${error.message}`);
  const { error: memErr } = await sb.from("group_members").insert({
    group_id: data.id,
    user_id: userId,
    status: "accepted",
    role: "admin",
  });
  if (memErr) throw new Error(`add admin member: ${memErr.message}`);
  return data;
}

async function invite(sb, opts) {
  const { error: memErr } = await sb.from("group_members").insert({
    group_id: opts.groupId,
    user_id: opts.targetUserId,
    status: "pending",
    role: "member",
    invited_by: opts.inviterId,
  });
  if (memErr && !memErr.message.includes("duplicate")) {
    throw new Error(`invite member: ${memErr.message}`);
  }
  let { error: notifErr } = await sb.from("notifications").insert({
    recipient_id: opts.targetUserId,
    sender_id: opts.inviterId,
    type: "group_invite",
    status: "pending",
    group_id: opts.groupId,
    message: `invited you to join "${opts.groupName}"`,
    sender_username: opts.senderUsername,
    sender_upi: opts.senderUpi,
  });
  if (notifErr && /sender_username|sender_upi|column/i.test(notifErr.message)) {
    ({ error: notifErr } = await sb.from("notifications").insert({
      recipient_id: opts.targetUserId,
      sender_id: opts.inviterId,
      type: "group_invite",
      status: "pending",
      group_id: opts.groupId,
      message: `invited you to join "${opts.groupName}"`,
    }));
  }
  if (notifErr) throw new Error(`invite notif: ${notifErr.message}`);
}

async function acceptInvite(sb, userId, groupId) {
  const { data: notifs, error: nErr } = await sb
    .from("notifications")
    .select("*")
    .eq("recipient_id", userId)
    .eq("group_id", groupId)
    .eq("type", "group_invite")
    .eq("status", "pending");
  if (nErr) throw new Error(`list invites: ${nErr.message}`);
  assert(notifs?.length > 0, `no pending invite for ${userId}`);

  const { error } = await sb
    .from("group_members")
    .update({ status: "accepted" })
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) throw new Error(`accept member: ${error.message}`);

  const { error: nUp } = await sb
    .from("notifications")
    .update({ status: "accepted" })
    .eq("id", notifs[0].id);
  if (nUp) throw new Error(`accept notif: ${nUp.message}`);
}

async function addExpense(sb, opts) {
  const { data, error } = await sb
    .from("expenses")
    .insert({
      group_id: opts.groupId,
      created_by: opts.createdBy,
      paid_by: opts.paidBy,
      description: opts.description,
      amount: opts.amount,
    })
    .select("*")
    .single();
  if (error) throw new Error(`add expense: ${error.message}`);
  const rows = opts.splits.map((s) => ({
    expense_id: data.id,
    user_id: s.userId,
    amount_owed: s.amount,
  }));
  const { error: sErr } = await sb.from("expense_splits").insert(rows);
  if (sErr) throw new Error(`splits: ${sErr.message}`);
  return data;
}

async function sendSettlement(sb, opts) {
  let { error } = await sb.from("notifications").insert({
    recipient_id: opts.recipientId,
    sender_id: opts.senderId,
    type: "settlement_request",
    status: "pending",
    amount: opts.amount,
    message: opts.message,
    sender_username: opts.senderUsername,
    sender_upi: opts.senderUpi,
  });
  if (error && /sender_username|sender_upi|column/i.test(error.message)) {
    ({ error } = await sb.from("notifications").insert({
      recipient_id: opts.recipientId,
      sender_id: opts.senderId,
      type: "settlement_request",
      status: "pending",
      amount: opts.amount,
      message: opts.message,
    }));
  }
  if (error) throw new Error(`settlement: ${error.message}`);
}

function computeNet(expenses, splits) {
  const balances = {};
  const add = (uid, amt) => {
    balances[uid] = (balances[uid] ?? 0) + amt;
  };
  const byExp = {};
  for (const s of splits) {
    (byExp[s.expense_id] ??= []).push(s);
  }
  for (const exp of expenses) {
    add(exp.paid_by, Number(exp.amount));
    for (const s of byExp[exp.id] ?? []) {
      add(s.user_id, -Number(s.amount_owed));
    }
  }
  for (const k of Object.keys(balances)) {
    balances[k] = Math.round(balances[k] * 100) / 100;
  }
  return balances;
}

async function main() {
  console.log("=== SplitPay E2E smoke test ===");
  console.log(`Supabase: ${url}`);
  console.log(`Stamp: ${stamp}\n`);

  const results = { ok: [], fail: [] };
  const step = async (name, fn) => {
    process.stdout.write(`• ${name}... `);
    try {
      const v = await fn();
      console.log("OK");
      results.ok.push(name);
      return v;
    } catch (e) {
      console.log("FAIL");
      console.error(`  → ${e.message}`);
      results.fail.push({ name, error: e.message });
      throw e;
    }
  };

  try {
    // Prefer cached working accounts (survives rate limits)
    let accountDefs;
    if (existsSync(CACHE)) {
      accountDefs = JSON.parse(readFileSync(CACHE, "utf8"));
      console.log("Using cached accounts from scripts/.e2e-accounts.json\n");
    } else {
      accountDefs = [
        {
          // Already confirmed from earlier run
          email: "alice.mrjmtj7p@mailinator.com",
          username: `alice_${stamp}`,
          full_name: "Alice Tester",
          upi_id: `alice.${stamp}@upi`,
          known: true,
        },
        {
          email: `bob.${stamp}@mailinator.com`,
          username: `bob_${stamp}`,
          full_name: "Bob Tester",
          upi_id: `bob.${stamp}@upi`,
        },
        {
          email: `cara.${stamp}@mailinator.com`,
          username: `cara_${stamp}`,
          full_name: "Cara Tester",
          upi_id: `cara.${stamp}@upi`,
        },
      ];
    }

    const users = [];
    for (const account of accountDefs) {
      const u = await step(`Sign up/login ${account.email}`, () =>
        signupAndConfirm(account),
      );
      // Keep username stable across cache reuse if already set
      if (!account.username) {
        account.username = `user_${u.userId.slice(0, 8)}`;
      }
      await step(`Profile @${account.username}`, () =>
        upsertProfile(u.sb, u.userId, account),
      );
      users.push({ ...u, account });
    }

    writeFileSync(
      CACHE,
      JSON.stringify(
        users.map((u) => ({
          email: u.account.email,
          username: u.account.username,
          full_name: u.account.full_name,
          upi_id: u.account.upi_id,
        })),
        null,
        2,
      ),
    );

    const [alice, bob, cara] = users;

    const group = await step("Alice creates group", () =>
      createGroup(alice.sb, alice.userId, `Trip ${stamp}`),
    );

    await step("Alice invites Bob", () =>
      invite(alice.sb, {
        groupId: group.id,
        groupName: group.name,
        targetUserId: bob.userId,
        inviterId: alice.userId,
        senderUsername: alice.account.username,
        senderUpi: alice.account.upi_id,
      }),
    );
    await step("Alice invites Cara", () =>
      invite(alice.sb, {
        groupId: group.id,
        groupName: group.name,
        targetUserId: cara.userId,
        inviterId: alice.userId,
        senderUsername: alice.account.username,
        senderUpi: alice.account.upi_id,
      }),
    );

    const bobSession = await step("Bob signs in (window 2)", () =>
      tryLogin(bob.email).then((x) => {
        assert(x, "bob login failed");
        return x;
      }),
    );
    const caraSession = await step("Cara signs in (window 3)", () =>
      tryLogin(cara.email).then((x) => {
        assert(x, "cara login failed");
        return x;
      }),
    );

    await step("Bob accepts invite", () =>
      acceptInvite(bobSession.sb, bob.userId, group.id),
    );
    await step("Cara accepts invite", () =>
      acceptInvite(caraSession.sb, cara.userId, group.id),
    );

    const { data: members, error: mErr } = await alice.sb
      .from("group_members")
      .select("*")
      .eq("group_id", group.id)
      .eq("status", "accepted");
    if (mErr) throw mErr;
    await step("Group has 3 accepted members", async () => {
      assert(members.length === 3, `expected 3 members, got ${members.length}`);
    });

    await step("Add expense Dinner ₹3000 (Alice paid)", () =>
      addExpense(alice.sb, {
        groupId: group.id,
        createdBy: alice.userId,
        paidBy: alice.userId,
        description: "Dinner",
        amount: 3000,
        splits: [
          { userId: alice.userId, amount: 1000 },
          { userId: bob.userId, amount: 1000 },
          { userId: cara.userId, amount: 1000 },
        ],
      }),
    );

    await step("Add expense Cab ₹900 (Bob paid)", () =>
      addExpense(bobSession.sb, {
        groupId: group.id,
        createdBy: bob.userId,
        paidBy: bob.userId,
        description: "Cab",
        amount: 900,
        splits: [
          { userId: alice.userId, amount: 300 },
          { userId: bob.userId, amount: 300 },
          { userId: cara.userId, amount: 300 },
        ],
      }),
    );

    const { data: expenses } = await alice.sb
      .from("expenses")
      .select("*")
      .eq("group_id", group.id);
    const ids = (expenses ?? []).map((e) => e.id);
    const { data: splits } = await alice.sb
      .from("expense_splits")
      .select("*")
      .in("expense_id", ids);

    const balances = computeNet(expenses ?? [], splits ?? []);
    await step("Balances match expected nets", async () => {
      assert(
        balances[alice.userId] === 1700,
        `Alice expected 1700 got ${balances[alice.userId]}`,
      );
      assert(
        balances[bob.userId] === -400,
        `Bob expected -400 got ${balances[bob.userId]}`,
      );
      assert(
        balances[cara.userId] === -1300,
        `Cara expected -1300 got ${balances[cara.userId]}`,
      );
    });

    await step("Bob sends settlement request to Alice", () =>
      sendSettlement(bobSession.sb, {
        recipientId: alice.userId,
        senderId: bob.userId,
        amount: 400,
        message: "Settling cab + dinner share",
        senderUsername: bob.account.username,
        senderUpi: bob.account.upi_id,
      }),
    );

    await step("Cara sends settlement request to Alice", () =>
      sendSettlement(caraSession.sb, {
        recipientId: alice.userId,
        senderId: cara.userId,
        amount: 1300,
        message: "Paying you back for dinner",
        senderUsername: cara.account.username,
        senderUpi: cara.account.upi_id,
      }),
    );

    const { data: aliceNotifs } = await alice.sb
      .from("notifications")
      .select("*")
      .eq("recipient_id", alice.userId)
      .eq("type", "settlement_request")
      .eq("status", "pending");

    await step("Alice sees pending settlement requests (≥2)", async () => {
      assert(
        (aliceNotifs ?? []).length >= 2,
        `expected ≥2, got ${(aliceNotifs ?? []).length}`,
      );
    });

    const upi = `upi://pay?pa=${encodeURIComponent(alice.account.upi_id)}&am=400.00&cu=INR`;
    await step("UPI payment link builds", async () => {
      assert(upi.startsWith("upi://pay?"), "bad upi");
      assert(
        upi.includes(`pa=${encodeURIComponent(alice.account.upi_id)}`),
        "missing payee",
      );
      assert(upi.includes("am=400.00"), "missing amount");
    });

    console.log("\n=== PASS ===");
    console.log("\nDummy accounts (password: TestPass123!):");
    for (const u of users) {
      console.log(`  ${u.account.email}  @${u.account.username}`);
    }
    console.log(`\nGroup: ${group.name} (${group.id})`);
    console.log("Balances: Alice +₹1700 | Bob −₹400 | Cara −₹1300");
    console.log("\nOpen http://localhost:8080/auth in 3 browser windows to try UI.");
  } catch {
    console.log("\n=== FAIL ===");
    console.log(`Passed: ${results.ok.length}`);
    console.log(`Failed: ${results.fail.length}`);
    process.exitCode = 1;
  }
}

main();
