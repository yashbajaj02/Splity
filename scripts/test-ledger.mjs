import { computePairwiseLedger } from "../src/lib/ledger.ts";
import assert from "assert";

console.log("--- RUNNING PAIRWISE LEDGER TESTS ---");

const USER_A = "user-a";
const USER_B = "user-b";

// Test 1: Partial Settlement (₹235.25 owed -> ₹200 paid -> ₹35.25 remaining)
{
  console.log("\nTest 1: Partial Settlement (₹235.25 owed -> ₹200 settled -> ₹35.25 remaining)");

  const allExpenses = [
    {
      id: "exp-1",
      group_id: "g1",
      created_by: USER_A,
      paid_by: USER_A,
      description: "Dinner",
      amount: 150,
      created_at: "2026-01-01T10:00:00Z",
    },
    {
      id: "exp-2",
      group_id: "g1",
      created_by: USER_A,
      paid_by: USER_A,
      description: "Cab ride",
      amount: 85.25,
      created_at: "2026-01-02T10:00:00Z",
    },
    {
      id: "set-1",
      group_id: "g1",
      created_by: USER_B,
      paid_by: USER_B,
      description: 'UPI settlement || {"settled":{"exp-1":150,"exp-2":50}}',
      amount: 200,
      created_at: "2026-01-03T10:00:00Z",
    },
  ];

  const splitsByExpense = {
    "exp-1": [{ id: "s1", expense_id: "exp-1", user_id: USER_B, amount_owed: 150 }],
    "exp-2": [{ id: "s2", expense_id: "exp-2", user_id: USER_B, amount_owed: 85.25 }],
    "set-1": [{ id: "s3", expense_id: "set-1", user_id: USER_A, amount_owed: 200 }],
  };

  const result = computePairwiseLedger(USER_A, USER_B, allExpenses, splitsByExpense);

  assert.strictEqual(
    result.items.length,
    3,
    "Ledger should retain all 3 items (2 expenses + 1 partial settlement)",
  );
  assert.strictEqual(result.currentNetBalance, 35.25, "Current net balance should be 35.25");
  assert.strictEqual(result.totalExpensesCount, 2, "2 non-settlement expenses");
  assert.strictEqual(result.totalSharedAmount, 235.25, "Total shared amount should be 235.25");

  // Sorting test: newest first
  assert.strictEqual(result.items[0].id, "set-1", "First item should be newest (settlement)");
  assert.strictEqual(result.items[1].id, "exp-2", "Second item should be exp-2");
  assert.strictEqual(result.items[2].id, "exp-1", "Third item should be exp-1 (oldest)");

  console.log("✓ Test 1 passed!");
}

// Test 2: ₹100 owed -> ₹90 paid -> ₹10 remaining
{
  console.log("\nTest 2: Partial Settlement (₹100 owed -> ₹90 paid -> ₹10 remaining)");

  const allExpenses = [
    {
      id: "exp-100",
      group_id: "g1",
      created_by: USER_B,
      paid_by: USER_B,
      description: "Team Lunch",
      amount: 100,
      created_at: "2026-01-01T12:00:00Z",
    },
    {
      id: "set-90",
      group_id: "g1",
      created_by: USER_A,
      paid_by: USER_A,
      description: "Cash settlement",
      amount: 90,
      created_at: "2026-01-02T12:00:00Z",
    },
  ];

  const splitsByExpense = {
    "exp-100": [{ id: "s1", expense_id: "exp-100", user_id: USER_A, amount_owed: 100 }],
    "set-90": [{ id: "s2", expense_id: "set-90", user_id: USER_B, amount_owed: 90 }],
  };

  const result = computePairwiseLedger(USER_A, USER_B, allExpenses, splitsByExpense);

  assert.strictEqual(
    result.items.length,
    2,
    "Ledger should retain both the expense and the settlement",
  );
  assert.strictEqual(
    result.currentNetBalance,
    -10,
    "Net balance from User A's perspective should be -10 (owes 10)",
  );
  assert.strictEqual(result.items[0].id, "set-90", "First item must be the settlement (newest)");
  assert.strictEqual(result.items[1].id, "exp-100", "Second item must be the expense");

  console.log("✓ Test 2 passed!");
}

// Test 3: Full Settlement (₹100 owed -> ₹100 paid -> ₹0 remaining => History Cleared)
{
  console.log("\nTest 3: Full Settlement (₹100 owed -> ₹100 paid -> ₹0 remaining)");

  const allExpenses = [
    {
      id: "exp-100",
      group_id: "g1",
      created_by: USER_B,
      paid_by: USER_B,
      description: "Team Lunch",
      amount: 100,
      created_at: "2026-01-01T12:00:00Z",
    },
    {
      id: "set-100",
      group_id: "g1",
      created_by: USER_A,
      paid_by: USER_A,
      description: "UPI settlement",
      amount: 100,
      created_at: "2026-01-02T12:00:00Z",
    },
  ];

  const splitsByExpense = {
    "exp-100": [{ id: "s1", expense_id: "exp-100", user_id: USER_A, amount_owed: 100 }],
    "set-100": [{ id: "s2", expense_id: "set-100", user_id: USER_B, amount_owed: 100 }],
  };

  const result = computePairwiseLedger(USER_A, USER_B, allExpenses, splitsByExpense);

  assert.strictEqual(
    result.items.length,
    0,
    "Ledger items should be empty since balance reached 0",
  );
  assert.strictEqual(result.currentNetBalance, 0, "Current balance is 0");
  assert.strictEqual(result.totalExpensesCount, 0, "0 active expenses");

  console.log("✓ Test 3 passed!");
}

// Test 4: New Expense After Full Settlement (₹100 owed -> ₹100 paid -> ₹50 new expense)
{
  console.log("\nTest 4: New Expense After Full Settlement");

  const allExpenses = [
    {
      id: "exp-old",
      group_id: "g1",
      created_by: USER_B,
      paid_by: USER_B,
      description: "Old Dinner",
      amount: 100,
      created_at: "2026-01-01T12:00:00Z",
    },
    {
      id: "set-full",
      group_id: "g1",
      created_by: USER_A,
      paid_by: USER_A,
      description: "Full UPI settlement",
      amount: 100,
      created_at: "2026-01-02T12:00:00Z",
    },
    {
      id: "exp-new",
      group_id: "g1",
      created_by: USER_A,
      paid_by: USER_A,
      description: "New Coffee",
      amount: 50,
      created_at: "2026-01-03T12:00:00Z",
    },
  ];

  const splitsByExpense = {
    "exp-old": [{ id: "s1", expense_id: "exp-old", user_id: USER_A, amount_owed: 100 }],
    "set-full": [{ id: "s2", expense_id: "set-full", user_id: USER_B, amount_owed: 100 }],
    "exp-new": [{ id: "s3", expense_id: "exp-new", user_id: USER_B, amount_owed: 25 }],
  };

  const result = computePairwiseLedger(USER_A, USER_B, allExpenses, splitsByExpense);

  assert.strictEqual(result.items.length, 1, "Only the new expense should be in the active ledger");
  assert.strictEqual(result.items[0].id, "exp-new", "Active item must be exp-new");
  assert.strictEqual(result.currentNetBalance, 25, "Current net balance is 25");

  console.log("✓ Test 4 passed!");
}

// Test 5: Multiple Partial Settlements
{
  console.log("\nTest 5: Multiple Partial Settlements");

  const allExpenses = [
    {
      id: "exp-200",
      group_id: "g1",
      created_by: USER_A,
      paid_by: USER_A,
      description: "Hotel Room",
      amount: 200,
      created_at: "2026-01-01T10:00:00Z",
    },
    {
      id: "set-part1",
      group_id: "g1",
      created_by: USER_B,
      paid_by: USER_B,
      description: "Part 1 Cash",
      amount: 50,
      created_at: "2026-01-02T10:00:00Z",
    },
    {
      id: "set-part2",
      group_id: "g1",
      created_by: USER_B,
      paid_by: USER_B,
      description: "Part 2 UPI",
      amount: 100,
      created_at: "2026-01-03T10:00:00Z",
    },
  ];

  const splitsByExpense = {
    "exp-200": [{ id: "s1", expense_id: "exp-200", user_id: USER_B, amount_owed: 200 }],
    "set-part1": [{ id: "s2", expense_id: "set-part1", user_id: USER_A, amount_owed: 50 }],
    "set-part2": [{ id: "s3", expense_id: "set-part2", user_id: USER_A, amount_owed: 100 }],
  };

  const result = computePairwiseLedger(USER_A, USER_B, allExpenses, splitsByExpense);

  assert.strictEqual(result.items.length, 3, "All 3 transactions should be visible");
  assert.strictEqual(result.currentNetBalance, 50, "Remaining balance is 50");
  assert.strictEqual(result.items[0].id, "set-part2", "Newest item is set-part2");
  assert.strictEqual(result.items[1].id, "set-part1", "Middle item is set-part1");
  assert.strictEqual(result.items[2].id, "exp-200", "Oldest item is exp-200");

  console.log("✓ Test 5 passed!");
}

// Test 6: Cross-direction expenses & precision test
{
  console.log("\nTest 6: Cross-direction expenses & fractional paise precision");

  const allExpenses = [
    {
      id: "exp-cross-1",
      group_id: "g1",
      created_by: USER_A,
      paid_by: USER_A,
      description: "Uber Ride",
      amount: 133.33,
      created_at: "2026-01-01T10:00:00Z",
    },
    {
      id: "exp-cross-2",
      group_id: "g1",
      created_by: USER_B,
      paid_by: USER_B,
      description: "Coffee",
      amount: 40.1,
      created_at: "2026-01-02T10:00:00Z",
    },
    {
      id: "set-cross-3",
      group_id: "g1",
      created_by: USER_B,
      paid_by: USER_B,
      description: "UPI partial payment",
      amount: 50.0,
      created_at: "2026-01-03T10:00:00Z",
    },
  ];

  const splitsByExpense = {
    "exp-cross-1": [{ id: "s1", expense_id: "exp-cross-1", user_id: USER_B, amount_owed: 133.33 }],
    "exp-cross-2": [{ id: "s2", expense_id: "exp-cross-2", user_id: USER_A, amount_owed: 40.1 }],
    "set-cross-3": [{ id: "s3", expense_id: "set-cross-3", user_id: USER_A, amount_owed: 50.0 }],
  };

  const result = computePairwiseLedger(USER_A, USER_B, allExpenses, splitsByExpense);

  // Initial: B owes A 133.33. Exp 2: A owes B 40.10 => Net: B owes A 93.23. Set 3: B pays A 50.00 => Net: B owes A 43.23
  assert.strictEqual(result.items.length, 3, "All 3 transactions should be visible");
  assert.strictEqual(result.currentNetBalance, 43.23, "Net balance should be 43.23");
  assert.strictEqual(result.items[0].id, "set-cross-3", "Newest is set-cross-3");

  console.log("✓ Test 6 passed!");
}

console.log("\nALL LEDGER TESTS PASSED SUCCESSFULLY! 🎉");
