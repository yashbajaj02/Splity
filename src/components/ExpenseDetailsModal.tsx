import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  Receipt,
  Users,
  X,
  MessageSquareText,
} from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogPortal, DialogOverlay, DialogClose } from "@/components/ui/dialog";
import {
  getGroup,
  getSplitsForGroup,
  getProfilesByIds,
  parseExpenseDescription,
  getCleanMemberName,
} from "@/lib/api";
import type { Expense, ExpenseSplit, Profile } from "@/lib/app-types";
import { CountUpCurrency } from "@/components/CountUpCurrency";

interface ExpenseDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: Expense | null;
  currentUserId: string;
  groupName?: string;
  creatorDisplayName?: string;
  initialSplits?: ExpenseSplit[];
  acceptedMembers?: { id: string; name: string }[];
}

function getExpenseIcon(description: string): string {
  const desc = description.toLowerCase();
  if (
    desc.includes("pizza") ||
    desc.includes("food") ||
    desc.includes("lunch") ||
    desc.includes("dinner") ||
    desc.includes("restaurant") ||
    desc.includes("cafe")
  )
    return "🍕";
  if (
    desc.includes("milk") ||
    desc.includes("grocery") ||
    desc.includes("groceries") ||
    desc.includes("store")
  )
    return "🥛";
  if (
    desc.includes("coffee") ||
    desc.includes("tea") ||
    desc.includes("chai") ||
    desc.includes("starbucks")
  )
    return "☕";
  if (
    desc.includes("cab") ||
    desc.includes("uber") ||
    desc.includes("ola") ||
    desc.includes("taxi") ||
    desc.includes("auto") ||
    desc.includes("travel") ||
    desc.includes("bus") ||
    desc.includes("flight")
  )
    return "🚕";
  if (
    desc.includes("rent") ||
    desc.includes("flat") ||
    desc.includes("house") ||
    desc.includes("room") ||
    desc.includes("hostel")
  )
    return "🏠";
  if (
    desc.includes("bill") ||
    desc.includes("wifi") ||
    desc.includes("electricity") ||
    desc.includes("power") ||
    desc.includes("water") ||
    desc.includes("recharge")
  )
    return "⚡";
  if (
    desc.includes("movie") ||
    desc.includes("cinema") ||
    desc.includes("film") ||
    desc.includes("netflix") ||
    desc.includes("show")
  )
    return "🎬";
  if (
    desc.includes("beer") ||
    desc.includes("drink") ||
    desc.includes("pub") ||
    desc.includes("party")
  )
    return "🍺";
  return "🧾";
}

function formatFullDateTime(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  return format(d, "dd MMM yyyy • h:mm a");
}

export function ExpenseDetailsModal({
  open,
  onOpenChange,
  expense,
  currentUserId,
  groupName: propGroupName,
  creatorDisplayName: propCreatorDisplayName,
  initialSplits,
  acceptedMembers,
}: ExpenseDetailsModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["expense-modal-details", expense?.id],
    enabled: open && !!expense,
    queryFn: async () => {
      if (!expense) return null;

      // 1. Group Name
      let fetchedGroupName = propGroupName;
      if (!fetchedGroupName) {
        const grp = await getGroup(expense.group_id);
        fetchedGroupName = grp?.name ?? "Group";
      }

      // 2. Splits
      let splits = initialSplits;
      if (!splits || splits.length === 0) {
        const allSplits = await getSplitsForGroup(expense.group_id);
        splits = allSplits.filter((s) => s.expense_id === expense.id);
      }

      // 3. Member Profiles
      const memberIds = Array.from(
        new Set([expense.paid_by, expense.created_by, ...splits.map((s) => s.user_id)]),
      );

      const profiles = await getProfilesByIds(memberIds);
      const profileMap = new Map(profiles.map((p) => [p.id, p]));

      return {
        groupName: fetchedGroupName,
        splits,
        profileMap,
      };
    },
  });

  if (!expense) return null;

  const resolvedGroupName = data?.groupName ?? propGroupName ?? "Group";
  const splits = data?.splits ?? initialSplits ?? [];
  const profileMap = data?.profileMap ?? new Map<string, Profile>();

  const { cleanDescription, splitNotes } = parseExpenseDescription(expense.description);
  const descLower = cleanDescription.toLowerCase();
  const isSettlement = descLower.includes("settlement") || descLower.includes("paid");
  const isUpi = descLower.includes("upi") || descLower.includes("online");
  const paymentMethod = isUpi ? "UPI Payment" : "Cash Payment";

  // Paid by info
  const paidByProfile = profileMap.get(expense.paid_by);
  let paidByName = "User";
  if (expense.paid_by === currentUserId) {
    paidByName = "You";
  } else if (paidByProfile?.full_name?.trim()) {
    paidByName = paidByProfile.full_name.trim();
  } else if (paidByProfile?.username?.trim()) {
    paidByName = paidByProfile.username.trim().replace(/^@/, "");
  } else if (propCreatorDisplayName && expense.paid_by === expense.created_by) {
    paidByName = getCleanMemberName(propCreatorDisplayName);
  }

  const paidByUsername = paidByProfile?.username
    ? `@${paidByProfile.username.replace(/^@/, "")}`
    : null;

  // Created by info
  const createdByProfile = profileMap.get(expense.created_by);
  let createdByName = "User";
  if (expense.created_by === currentUserId) {
    createdByName = "You";
  } else if (createdByProfile?.full_name?.trim()) {
    createdByName = createdByProfile.full_name.trim();
  } else if (createdByProfile?.username?.trim()) {
    createdByName = createdByProfile.username.trim().replace(/^@/, "");
  } else if (propCreatorDisplayName) {
    createdByName = getCleanMemberName(propCreatorDisplayName);
  }

  // Your share
  let yourShare = 0;
  const selfSplit = splits.find((s) => s.user_id === currentUserId);
  if (selfSplit) {
    yourShare = Number(selfSplit.amount_owed);
  } else if (expense.paid_by === currentUserId) {
    const othersOwed = splits
      .filter((s) => s.user_id !== currentUserId)
      .reduce((sum, s) => sum + Number(s.amount_owed), 0);
    yourShare = Math.max(0, Number(expense.amount) - othersOwed);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200" />
        <DialogPrimitive.Content
          className="fixed z-50 bg-background shadow-2xl transition-all duration-200 
          data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95
          inset-x-0 bottom-0 top-10 rounded-t-3xl border-t border-x border-border p-0 flex flex-col overflow-hidden max-h-[calc(100vh-2.5rem)]
          sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg sm:rounded-2xl sm:border sm:max-h-[85vh] sm:h-auto"
        >
          <div className="flex flex-col h-full max-h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3.5 border-b border-border/60 bg-muted/20 shrink-0">
              <div className="flex items-center gap-3 min-w-0 pr-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl shadow-xs">
                  {getExpenseIcon(cleanDescription)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1 truncate max-w-[180px]">
                      <Building2 className="h-3 w-3 text-primary shrink-0" />
                      <span className="truncate">{resolvedGroupName}</span>
                    </span>
                    {isSettlement ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                        <CheckCircle2 className="h-3 w-3" />
                        Settlement
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary border border-primary/20 shrink-0">
                        <Receipt className="h-3 w-3" />
                        Expense
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>{formatFullDateTime(expense.created_at)}</span>
                  </p>
                </div>
              </div>

              <DialogClose className="rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring shrink-0 ml-4 -mt-1 -mr-1">
                <X className="h-5 w-5" />
                <span className="sr-only">Close</span>
              </DialogClose>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Full Title & Amount Hero */}
              <div className="space-y-3">
                <h2 className="font-display text-lg sm:text-xl font-bold text-foreground break-words leading-snug">
                  {cleanDescription}
                </h2>

                <div className="flex flex-wrap items-baseline justify-between gap-2 p-4 rounded-2xl bg-secondary/40 border border-border/60">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Total Amount
                    </p>
                    <p className="text-2xl sm:text-3xl font-display font-extrabold text-foreground mt-0.5">
                      <CountUpCurrency amount={Number(expense.amount)} />
                    </p>
                  </div>
                  {yourShare > 0 ? (
                    <div className="text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Your Share
                      </p>
                      <p className="text-base sm:text-lg font-display font-bold text-primary mt-0.5">
                        ₹{yourShare.toFixed(2)}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Paid By Section */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-primary" />
                  Paid By
                </h3>
                <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs uppercase">
                      {paidByName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{paidByName}</p>
                      {paidByUsername && (
                        <p className="text-xs text-muted-foreground truncate">{paidByUsername}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">Amount Paid</p>
                    <p className="text-sm font-bold font-display text-emerald-600 dark:text-emerald-400">
                      ₹{Number(expense.amount).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Split Details & Members Involved */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    Split Details ({splits.length} {splits.length === 1 ? "member" : "members"})
                  </h3>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {isSettlement ? paymentMethod : "Split details"}
                  </span>
                </div>

                {isLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : splits.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed text-center text-xs text-muted-foreground">
                    No split details available.
                  </div>
                ) : (
                  <div className="divide-y divide-border/40 rounded-xl border border-border/60 bg-card overflow-hidden">
                    {/* Header for desktop only */}
                    <div className="hidden sm:grid sm:grid-cols-3 sm:gap-4 p-3.5 bg-secondary/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <div>Name</div>
                      <div>Amount</div>
                      <div>Note</div>
                    </div>
                    {splits.map((split) => {
                      const memberProfile = profileMap.get(split.user_id);
                      const isMe = split.user_id === currentUserId;
                      let memberName = isMe ? "You" : "Member";
                      if (!isMe && memberProfile?.full_name?.trim()) {
                        memberName = memberProfile.full_name.trim();
                      } else if (!isMe && memberProfile?.username?.trim()) {
                        memberName = memberProfile.username.trim().replace(/^@/, "");
                      } else if (!isMe && acceptedMembers) {
                        const matched = acceptedMembers.find((m) => m.id === split.user_id);
                        if (matched) memberName = getCleanMemberName(matched.name);
                      }

                      const owedAmount = Number(split.amount_owed);
                      const canViewAllNotes = expense.created_by === currentUserId;
                      const canViewNote = canViewAllNotes || isMe;
                      const note = canViewNote
                        ? split.note || splitNotes[split.user_id] || null
                        : null;

                      return (
                        <div key={split.id || split.user_id} className="p-3.5">
                          {/* Desktop Layout (3-column) */}
                          <div className="hidden sm:grid sm:grid-cols-3 sm:gap-4 sm:items-center">
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase ${isMe ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}
                              >
                                {memberName.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-sm text-foreground truncate">
                                  {memberName}{" "}
                                  {isMe && (
                                    <span className="text-xs text-primary font-normal">(You)</span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-semibold font-display text-foreground">
                                ₹{owedAmount.toFixed(2)}
                              </p>
                            </div>
                            <div className="min-w-0">
                              {note ? (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1.5 rounded-full bg-secondary/50 hover:bg-secondary/80 border border-border/50 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors max-w-full"
                                    >
                                      <MessageSquareText className="h-3.5 w-3.5 shrink-0" />
                                      <span className="truncate">{note}</span>
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[280px] p-4 text-sm" align="start">
                                    <div className="space-y-2">
                                      <h4 className="font-medium text-foreground text-xs uppercase tracking-wider text-muted-foreground">
                                        Note for {memberName}
                                      </h4>
                                      <p className="text-muted-foreground break-words whitespace-pre-wrap">
                                        {note}
                                      </p>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              ) : (
                                <span className="text-sm text-muted-foreground/40 italic">-</span>
                              )}
                            </div>
                          </div>

                          {/* Mobile Layout (Stacked) */}
                          <div className="sm:hidden space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase ${isMe ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}
                                >
                                  {memberName.slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm text-foreground truncate">
                                    {memberName}{" "}
                                    {isMe && (
                                      <span className="text-xs text-primary font-normal">
                                        (You)
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-semibold font-display text-foreground">
                                  ₹{owedAmount.toFixed(2)}
                                </p>
                              </div>
                            </div>
                            {note ? (
                              <div className="ml-11">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1.5 rounded-xl bg-secondary/50 hover:bg-secondary/80 border border-border/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors max-w-full text-left"
                                    >
                                      <MessageSquareText className="h-3.5 w-3.5 shrink-0" />
                                      <span className="truncate">{note}</span>
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[280px] p-4 text-sm" align="start">
                                    <div className="space-y-2">
                                      <h4 className="font-medium text-foreground text-xs uppercase tracking-wider text-muted-foreground">
                                        Note for {memberName}
                                      </h4>
                                      <p className="text-muted-foreground break-words whitespace-pre-wrap">
                                        {note}
                                      </p>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Metadata & Status Footer */}
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/40 space-y-2 text-xs text-muted-foreground">
                <div className="flex justify-between items-center">
                  <span>Added by</span>
                  <span className="font-medium text-foreground">{createdByName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Date & Time</span>
                  <span className="font-medium text-foreground">
                    {formatFullDateTime(expense.created_at)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Settlement Status</span>
                  <span className="font-medium text-foreground">
                    {isSettlement ? "Settlement Completed" : "Pending Settlement"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
