/**
 * Solo smoke: proves core APIs work with the confirmed Alice account
 * while signup email rate-limit blocks creating Bob/Cara.
 *
 * Usage: node scripts/e2e-alice-solo.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function loadEnv() {
  const env = {};
  for (const line of readFileSync(resolve(root, ".env"), "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const EMAIL = "alice.mrjmtj7p@mailinator.com";
const PASSWORD = "TestPass123!";
const stamp = Date.now().toString(36);

function assert(c, m) {
  if (!c) throw new Error(m);
}

async function main() {
  console.log("=== Alice solo smoke ===\n");
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: auth, error: aErr } = await sb.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (aErr) throw aErr;
  const userId = auth.user.id;
  console.log("• Login OK", userId);

  const { error: pErr } = await sb.from("profiles").upsert({
    id: userId,
    username: `alice_solo_${stamp}`,
    full_name: "Alice Solo",
    upi_id: `alice.solo.${stamp}@upi`,
    email: EMAIL,
  });
  if (pErr) throw pErr;
  console.log("• Profile upsert OK");

  const { data: group, error: gErr } = await sb
    .from("groups")
    .insert({
      name: `Solo ${stamp}`,
      description: "solo smoke",
      created_by: userId,
    })
    .select("*")
    .single();
  if (gErr) throw gErr;

  const { error: mErr } = await sb.from("group_members").insert({
    group_id: group.id,
    user_id: userId,
    status: "accepted",
    role: "admin",
  });
  if (mErr) throw mErr;
  console.log("• Create group + membership OK", group.id);

  const { data: expense, error: eErr } = await sb
    .from("expenses")
    .insert({
      group_id: group.id,
      created_by: userId,
      paid_by: userId,
      description: "Coffee",
      amount: 120,
    })
    .select("*")
    .single();
  if (eErr) throw eErr;

  const { error: sErr } = await sb.from("expense_splits").insert({
    expense_id: expense.id,
    user_id: userId,
    amount_owed: 120,
  });
  if (sErr) throw sErr;
  console.log("• Add expense + split OK", expense.id);

  const { data: groups } = await sb
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId)
    .eq("status", "accepted");
  assert((groups?.length ?? 0) > 0, "expected memberships");
  console.log("• List memberships OK", groups.length);

  // Cleanup test group
  await sb.from("groups").delete().eq("id", group.id);
  console.log("• Cleanup OK");
  console.log("\n=== PASS ===");
  console.log(`Sign in at http://localhost:8080/auth`);
  console.log(`  email: ${EMAIL}`);
  console.log(`  password: ${PASSWORD}`);
}

main().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
