import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { HandCoins, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogClose,
} from "@/components/ui/dialog";
import { getSplitsForGroup, getProfilesByIds, parseExpenseDescription } from "@/lib/api";
import type { Expense, ExpenseSplit, Profile } from "@/lib/app-types";
import { CountUpCurrency } from "@/components/CountUpCurrency";
import { cn } from "@/lib/utils";

interface PaymentDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: Expense | null;
  currentUserId: string;
}

export function PaymentDetailsModal({
  open,
  onOpenChange,
  expense,
  currentUserId,
}: PaymentDetailsModalProps) {
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
    const p = profiles.find((p) => p.id === id);
    return p?.full_name?.trim() || p?.username?.replace(/^@/, "").trim() || "Someone";
  };

  const { cleanDescription } = parseExpenseDescription(expense.description);
  const descLower = cleanDescription.toLowerCase();

  // Find counterparty
  const isPayer = expense.paid_by === currentUserId;
  let counterpartyId = "";
  if (isPayer) {
    // Current user paid. Counterparty is the one who owes.
    const otherSplit = splits.find((s) => s.user_id !== currentUserId);
    if (otherSplit) counterpartyId = otherSplit.user_id;
  } else {
    // Someone else paid. Counterparty is the payer.
    counterpartyId = expense.paid_by;
  }

  const counterpartyName = counterpartyId ? getProfileName(counterpartyId) : "Someone";
  const creatorName =
    expense.created_by === currentUserId ? "You" : getProfileName(expense.created_by);

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
            <h2 className="font-display text-lg font-bold">Payment Details</h2>
          </DialogHeader>

          <div className="px-5 py-6 flex-1 overflow-y-auto">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <HandCoins className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold leading-tight">
                  Payment with {counterpartyName}
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
                <p className="text-sm text-muted-foreground">Your amount</p>
                <p className="mt-0.5 font-display text-lg font-semibold text-primary">
                  <CountUpCurrency amount={Number(expense.amount)} />
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Recorded by</p>
                <p className="mt-0.5 font-medium">{creatorName}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Reason</p>
                <p className="mt-0.5 font-medium">{cleanDescription}</p>
              </div>

              {formattedDate && (
                <div>
                  <p className="text-sm text-muted-foreground">{formattedDate}</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
