import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, CheckCircle2, Receipt, ShieldCheck } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  getMyGroups,
  getGroupExpenses,
  getSplitsForGroup,
  getProfilesByIds,
  parseExpenseDescription,
  getCleanMemberName,
} from "@/lib/api";
import type { AppNotification, Expense, ExpenseSplit, Profile } from "@/lib/app-types";


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
      
      const splitsArrays = await Promise.all(groups.map((g) => getSplitsForGroup(g.id)));
      const splits = splitsArrays.flat();
      
      const splitsByExpense: Record<string, ExpenseSplit[]> = {};
      for (const s of splits) {
        (splitsByExpense[s.expense_id] ??= []).push(s);
      }
      
      const allUserIds = Array.from(new Set([
        ...allExpenses.map(e => e.paid_by),
        ...allExpenses.map(e => e.created_by),
        ...splits.map(s => s.user_id),
      ]));
      const profiles = await getProfilesByIds(allUserIds);
      const profilesById: Record<string, Profile> = {};
      for (const p of profiles) {
        profilesById[p.id] = p;
      }
      
      return { allExpenses, splitsByExpense, profilesById };
    },
  });

  const { allExpenses = [], splitsByExpense = {}, profilesById = {} } = data ?? {};

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

  // Calculate items displaying the current user's share and member splits
  const items = displayExpenses.map((exp) => {
    const splits = splitsByExpense[exp.id] ?? [];
    const { cleanDescription, splitNotes } = parseExpenseDescription(exp.description);
    let userShare = 0;

    const selfSplit = splits.find((s) => s.user_id === currentUserId);
    const selfNote = selfSplit?.note || splitNotes[currentUserId] || null;

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

    const payerProfile = profilesById[exp.paid_by];
    const payerName = payerProfile?.full_name || payerProfile?.username?.replace(/^@/, "") || "Someone";

    const canViewAllNotes = exp.created_by === currentUserId;

    const memberSplits = splits.map((s) => {
      const p = profilesById[s.user_id];
      let name = s.user_id === currentUserId ? "You" : "Member";
      if (s.user_id !== currentUserId) {
        if (p?.full_name?.trim()) name = p.full_name.trim();
        else if (p?.username?.trim()) name = p.username.trim().replace(/^@/, "");
      }
      const canViewNote = canViewAllNotes || s.user_id === currentUserId;
      const note = canViewNote ? (s.note || splitNotes[s.user_id] || null) : null;
      return {
        userId: s.user_id,
        name,
        amount: Number(s.amount_owed),
        note,
      };
    });

    return {
      id: exp.id,
      title: cleanDescription,
      userShare: Math.max(0, userShare),
      selfNote,
      totalAmount: Number(exp.amount),
      createdAt: exp.created_at,
      payerName,
      splits: memberSplits,
    };
  });



  const isUpi = notification.message?.toLowerCase().includes("upi");
  const paymentMethod = isUpi ? "UPI" : "Cash";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-md w-full mx-auto max-h-[85vh] rounded-t-[24px]">
        <DrawerHeader className="px-4 sm:px-6 pt-3 pb-4 text-left border-b border-border/50">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <DrawerTitle className="font-display text-lg sm:text-xl font-bold truncate flex items-center gap-2">
                {isPayment ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                ) : (
                  <Receipt className="h-5 w-5 text-primary shrink-0" />
                )}
                <span className="truncate">
                  {isPayment
                    ? "Payment Details"
                    : isExpense
                      ? "Expense Details"
                      : "Pending Balance"}
                </span>
              </DrawerTitle>
              {groupName && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  Group • {groupName}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1 bg-secondary/60 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-medium text-muted-foreground shrink-0">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Private View
            </div>
          </div>
        </DrawerHeader>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No detailed breakdown available.
            </div>
          ) : (
            <div className="space-y-8 pb-4">
              {items.map((item) => (
                <div key={item.id} className="space-y-5">
                  {/* EXPENSE INFORMATION */}
                  <div>
                    <p className="font-semibold text-lg text-foreground truncate">
                      {item.title}
                    </p>
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground">Added by</p>
                      <p className="text-sm font-medium text-foreground">{item.payerName}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      {format(new Date(item.createdAt), "d MMM yyyy • h:mm a")}
                    </p>
                  </div>

                  {/* AMOUNT SECTION */}
                  <div className="p-4 rounded-xl border border-border/60 bg-card/60 space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium text-foreground">Your Share</p>
                      <p className="text-lg font-bold font-display text-foreground">
                        ₹{item.userShare.toFixed(2)}
                      </p>
                    </div>
                    {item.selfNote ? (
                      <div className="flex justify-between items-center text-xs">
                        <p className="text-muted-foreground">Your Note</p>
                        <p className="font-medium text-foreground">{item.selfNote}</p>
                      </div>
                    ) : null}
                    <div className="h-px w-full bg-border/50" />
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-muted-foreground">Total Amount</p>
                      <p className="text-sm font-semibold text-foreground">
                        ₹{item.totalAmount.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* MEMBER SPLIT BREAKDOWN */}
                  {item.splits && item.splits.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Split Details ({item.splits.length} {item.splits.length === 1 ? "member" : "members"})
                      </p>
                      <div className="divide-y divide-border/40 rounded-xl border border-border/60 bg-card overflow-hidden">
                        {item.splits.map((s) => {
                          const isSelf = s.userId === currentUserId;
                          return (
                            <div key={s.userId} className="p-3 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div
                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold uppercase ${
                                      isSelf
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-secondary text-foreground"
                                    }`}
                                  >
                                    {s.name.slice(0, 2).toUpperCase()}
                                  </div>
                                  <p className="text-sm font-medium text-foreground truncate">
                                    {s.name} {isSelf && <span className="text-xs text-primary font-normal">(You)</span>}
                                  </p>
                                </div>
                                <p className="text-sm font-bold font-display text-foreground">
                                  ₹{s.amount.toFixed(2)}
                                </p>
                              </div>
                              {s.note ? (
                                <div className="ml-9.5 flex items-start gap-1.5 rounded-lg bg-secondary/50 px-2.5 py-1 text-xs text-foreground border border-border/40">
                                  <span className="font-semibold text-muted-foreground shrink-0">Note:</span>
                                  <span className="break-words font-medium">{s.note}</span>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* OPTIONAL PAYMENT METHOD */}
              {isPayment && (
                <div className="p-4 rounded-xl border border-border/60 bg-card/60 flex justify-between items-center mt-2">
                  <p className="text-xs text-muted-foreground">Method</p>
                  <p className="text-sm font-medium text-foreground">{paymentMethod}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
