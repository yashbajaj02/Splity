import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, CheckCircle2, Receipt, ShieldCheck } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import {
  getMyGroups,
  getGroupExpenses,
  getSplitsForExpenses,
} from "@/lib/api";
import type { AppNotification, Expense, ExpenseSplit } from "@/lib/app-types";
import { CountUpCurrency } from "@/components/CountUpCurrency";

interface ActivityDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  counterpartyId: string;
  notification: AppNotification;
  groupName?: string;
}

export function ActivityDetailsSheet({
  open,
  onOpenChange,
  currentUserId,
  counterpartyId,
  notification,
  groupName,
}: ActivityDetailsSheetProps) {
  const isPayment = notification.type === "settlement_confirmed";
  const isExpense = notification.type === "expense_added";

  const { data, isLoading } = useQuery({
    queryKey: [
      "activity-details-sheet",
      currentUserId,
      counterpartyId,
      notification.id,
      notification.group_id,
    ],
    enabled: open,
    queryFn: async () => {
      let groups = await getMyGroups(currentUserId);
      if (notification.group_id) {
        groups = groups.filter((g) => g.id === notification.group_id);
      }

      const expenseArrays = await Promise.all(
        groups.map((g) => getGroupExpenses(g.id)),
      );
      const allExpenses: Expense[] = expenseArrays.flat();
      const splits = await getSplitsForExpenses(allExpenses.map((e) => e.id));
      const splitsByExpense: Record<string, ExpenseSplit[]> = {};
      for (const s of splits) {
        (splitsByExpense[s.expense_id] ??= []).push(s);
      }
      return { allExpenses, splitsByExpense };
    },
  });

  const { allExpenses = [], splitsByExpense = {} } = data ?? {};

  // Filter relevant expenses for current user
  const relevantExpenses = allExpenses.filter((expense) => {
    const splits = splitsByExpense[expense.id] ?? [];
    const userIdsInSplits = new Set(splits.map((s) => s.user_id));
    userIdsInSplits.add(expense.paid_by);
    if (notification.group_id && expense.group_id !== notification.group_id) {
      return false;
    }
    return userIdsInSplits.has(currentUserId);
  });

  relevantExpenses.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  let displayExpenses = relevantExpenses;

  if (isPayment) {
    const notifTime = new Date(notification.created_at).getTime();
    displayExpenses = relevantExpenses.filter((exp) => {
      const isSet =
        exp.description.toLowerCase().includes("settlement") ||
        exp.description.toLowerCase().includes("paid");
      if (isSet) return false;
      const t = new Date(exp.created_at).getTime();
      return t <= notifTime;
    });

    if (displayExpenses.length === 0) {
      displayExpenses = relevantExpenses.filter((exp) => {
        const isSet =
          exp.description.toLowerCase().includes("settlement") ||
          exp.description.toLowerCase().includes("paid");
        return !isSet;
      });
    }
  } else if (isExpense) {
    const matched = relevantExpenses.find(
      (e) => e.description === notification.message,
    );
    if (matched) {
      displayExpenses = [matched];
    } else if (relevantExpenses.length > 0) {
      displayExpenses = [relevantExpenses[relevantExpenses.length - 1]];
    }
  } else {
    displayExpenses = relevantExpenses.filter((exp) => {
      const isSet =
        exp.description.toLowerCase().includes("settlement") ||
        exp.description.toLowerCase().includes("paid");
      return !isSet;
    });
  }

  // Calculate items displaying ONLY the current user's share
  const items = displayExpenses.map((exp) => {
    const splits = splitsByExpense[exp.id] ?? [];
    let userShare = 0;

    const selfSplit = splits.find((s) => s.user_id === currentUserId);
    if (selfSplit) {
      userShare = Number(selfSplit.amount_owed);
    } else if (exp.paid_by === currentUserId) {
      const othersOwed = splits
        .filter((s) => s.user_id !== currentUserId)
        .reduce((sum, s) => sum + Number(s.amount_owed), 0);
      userShare = Number(exp.amount) - othersOwed;
    } else {
      userShare = Number(exp.amount) / Math.max(1, splits.length);
    }

    const membersCount = new Set([
      exp.paid_by,
      ...splits.map((s) => s.user_id),
    ]).size;

    return {
      id: exp.id,
      title: exp.description,
      userShare: Math.max(0, userShare),
      totalAmount: Number(exp.amount),
      membersCount,
      createdAt: exp.created_at,
    };
  });

  const totalAmount =
    notification.amount != null
      ? Number(notification.amount)
      : items.reduce((sum, item) => sum + item.userShare, 0);

  const isUpi = notification.message?.toLowerCase().includes("upi");
  const paymentMethod = isUpi ? "UPI" : "Cash";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-md mx-auto max-h-[85vh] rounded-t-[24px]">
        <DrawerHeader className="px-6 pt-3 pb-4 text-left border-b border-border/50">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <DrawerTitle className="font-display text-xl font-bold truncate flex items-center gap-2">
                {isPayment ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                ) : (
                  <Receipt className="h-5 w-5 text-primary shrink-0" />
                )}
                {isPayment
                  ? "Payment Details"
                  : isExpense
                    ? "Expense Details"
                    : "Pending Balance"}
              </DrawerTitle>
              {groupName && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {groupName}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1 bg-secondary/60 px-2.5 py-1 rounded-full text-[11px] font-medium text-muted-foreground shrink-0">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Private View
            </div>
          </div>
        </DrawerHeader>

        <div className="p-6 overflow-y-auto space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No detailed breakdown available.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-card/60"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="font-semibold text-sm truncate text-foreground">
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.membersCount} Member{item.membersCount > 1 ? "s" : ""} •{" "}
                      {format(new Date(item.createdAt), "d MMM yyyy")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">Your Share</p>
                    <p className="text-sm font-bold font-display text-foreground mt-0.5">
                      ₹{item.userShare.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DrawerFooter className="border-t border-border/50 px-6 py-4 bg-card/40">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                {items.length} Expense{items.length !== 1 ? "s" : ""}{" "}
                {isPayment ? "Cleared" : ""}
              </p>
              {isPayment && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Method: <span className="font-medium text-foreground">{paymentMethod}</span>
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                {isPayment ? "Total Paid" : "Total Amount"}
              </p>
              <p className="text-xl font-bold font-display text-primary mt-0.5">
                <CountUpCurrency amount={totalAmount} />
              </p>
            </div>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
