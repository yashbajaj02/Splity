import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Receipt, X, MessageSquareText } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogClose,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  getSplitsForGroup,
  getProfilesByIds,
  parseExpenseDescription,
  getCleanMemberName,
} from "@/lib/api";
import type { Expense, Profile } from "@/lib/app-types";
import { CountUpCurrency } from "@/components/CountUpCurrency";
import { cn } from "@/lib/utils";

interface ActivityExpenseDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: Expense | null;
  currentUserId: string;
}

export function ActivityExpenseDetailsModal({
  open,
  onOpenChange,
  expense,
  currentUserId,
}: ActivityExpenseDetailsModalProps) {
  const splitsQuery = useQuery({
    queryKey: ["group-splits", expense?.group_id],
    queryFn: () => getSplitsForGroup(expense!.group_id),
    enabled: open && !!expense?.group_id,
  });

  const allUserIds = Array.from(
    new Set(
      [
        expense?.paid_by,
        expense?.created_by,
        ...(splitsQuery.data ?? [])
          .filter((s) => s.expense_id === expense?.id)
          .map((s) => s.user_id),
      ].filter(Boolean),
    ),
  ) as string[];

  const profilesQuery = useQuery({
    queryKey: ["profiles", allUserIds.sort().join(",")],
    queryFn: () => getProfilesByIds(allUserIds),
    enabled: open && allUserIds.length > 0,
  });

  if (!expense) return null;

  const splits = (splitsQuery.data ?? []).filter((s) => s.expense_id === expense.id);
  const profiles = profilesQuery.data ?? [];
  const getProfileName = (id: string) => {
    if (id === currentUserId) return "You";
    const p = profiles.find((p) => p.id === id);
    return p?.full_name?.trim() || p?.username?.replace(/^@/, "").trim() || "Someone";
  };

  const { cleanDescription, splitNotes } = parseExpenseDescription(expense.description);

  const creatorName = getProfileName(expense.created_by);

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

  // Your note
  const canViewAllNotes = expense.created_by === currentUserId;
  let yourNote = null;
  if (selfSplit) {
    yourNote = selfSplit.note || splitNotes[currentUserId] || null;
  }

  const dateObj = new Date(expense.created_at);
  const formattedDate = !isNaN(dateObj.getTime()) ? format(dateObj, "dd MMM yyyy • h:mm a") : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogContent
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-[calc(100vw-2rem)] sm:w-full max-w-sm translate-x-[-50%] translate-y-[-50%] gap-0 rounded-3xl bg-background p-0 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:max-w-md",
          )}
          aria-describedby={undefined}
        >
          <DialogHeader className="px-5 py-4 border-b border-border/50 shrink-0">
            <h2 className="font-display text-lg font-bold">Expense Activity</h2>
          </DialogHeader>

          <div className="px-5 py-6 flex-1 overflow-y-auto">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Receipt className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-semibold leading-tight truncate">
                  {cleanDescription}
                </h3>
              </div>
            </div>

            <div className="space-y-5 rounded-2xl border border-border/50 bg-secondary/20 p-5">
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="mt-0.5 font-display text-lg font-semibold">
                  <CountUpCurrency amount={Number(expense.amount)} />
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Added by</p>
                <p className="mt-0.5 font-medium">{creatorName}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Your share</p>
                <p className="mt-0.5 font-display text-lg font-semibold text-primary">
                  <CountUpCurrency amount={yourShare} />
                </p>
                {yourNote && (
                  <div className="mt-2">
                    <div className="inline-flex items-start gap-1.5 rounded-xl bg-secondary/50 border border-border/50 px-3 py-2 text-sm text-muted-foreground">
                      <MessageSquareText className="h-4 w-4 shrink-0 mt-0.5" />
                      <span className="break-words">{yourNote}</span>
                    </div>
                  </div>
                )}
              </div>

              {formattedDate && (
                <div>
                  <p className="text-sm text-muted-foreground">Date & Time</p>
                  <p className="mt-0.5 text-sm font-medium">{formattedDate}</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
