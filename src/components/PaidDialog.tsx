import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { settleByCash, settleByUpi } from "@/lib/api";
import { ExpenseBreakdownSheet } from "@/components/ExpenseBreakdownSheet";

type PaymentMethod = "upi" | "cash";

export function PaidDialog({
  payeeName,
  groupName,
  amount,
  groupId,
  payeeId,
  payerId,
}: {
  payeeName: string;
  groupName?: string | null;
  amount: number;
  groupId: string | null;
  payeeId: string;
  payerId: string;
}) {
  const [open, setOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [paidAmount, setPaidAmount] = useState(amount.toFixed(2));
  const isSubmittingRef = useRef(false);
  const queryClient = useQueryClient();

  const upiMutation = useMutation({
    mutationFn: (v: { groupId: string; payeeId: string; amount: number }) =>
      settleByUpi({ groupId: v.groupId, payerId, payeeId: v.payeeId, amount: v.amount }),
    onSuccess: (_data, vars) => {
      toast.success(`Settled ₹${vars.amount.toFixed(2)} via UPI.`);
      invalidate();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => {
      isSubmittingRef.current = false;
    },
  });

  const cashMutation = useMutation({
    mutationFn: (v: { groupId: string; payeeId: string; amount: number }) =>
      settleByCash({ groupId: v.groupId, payerId, payeeId: v.payeeId, amount: v.amount }),
    onSuccess: (_data, vars) => {
      toast.success(`Cash settlement of ₹${vars.amount.toFixed(2)} recorded.`);
      invalidate();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => {
      isSubmittingRef.current = false;
    },
  });

  const busy = upiMutation.isPending || cashMutation.isPending || isSubmittingRef.current;

  // Reset form each time dialog opens
  function handleOpenChange(next: boolean) {
    if (busy) return;
    if (next) {
      setMethod("upi");
      setPaidAmount(amount.toFixed(2));
    }
    setOpen(next);
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["settle", payerId] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  function handleConfirm() {
    if (busy || isSubmittingRef.current) return;

    const parsed = parseFloat(paidAmount);
    if (isNaN(parsed) || parsed <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }
    if (!groupId) {
      toast.error("No shared group found to record this payment.");
      return;
    }
    isSubmittingRef.current = true;
    const vars = { groupId, payeeId, amount: parsed };
    if (method === "upi") {
      upiMutation.mutate(vars);
    } else {
      cashMutation.mutate(vars);
    }
  }

  return (
    <>
      {/* ── Trigger ── */}
      <Button
        size="sm"
        id={`paid-trigger-${payeeName}`}
        variant="outline"
        onClick={() => handleOpenChange(true)}
      >
        <CheckCircle2 className="h-4 w-4 mr-1.5" />
        Paid
      </Button>

      {/* ── "I've Already Paid" Modal ── */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  You've Paid
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                  <span className="font-display font-bold text-lg text-foreground shrink-0">
                    {payeeName}
                  </span>
                  {groupName && (
                    <span className="text-sm text-muted-foreground truncate max-w-[120px] sm:max-w-[150px]">
                      ({groupName})
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Remaining Balance
                </p>
                <p className="text-base font-display font-bold text-primary mt-0.5">
                  ₹{amount.toFixed(2)}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="px-6 py-5 space-y-5">
            {/* Payment Method */}
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Payment Method
              </legend>

              <label
                htmlFor="method-upi"
                className={`flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-colors ${
                  method === "upi"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-secondary/50"
                }`}
              >
                <input
                  id="method-upi"
                  type="radio"
                  name="payment-method"
                  value="upi"
                  checked={method === "upi"}
                  onChange={() => setMethod("upi")}
                  className="accent-primary h-4 w-4"
                />
                <div>
                  <p className="text-sm font-semibold">UPI Paid</p>
                  <p className="text-xs text-muted-foreground">
                    GPay, PhonePe, Paytm, etc.
                  </p>
                </div>
              </label>

              <label
                htmlFor="method-cash"
                className={`flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-colors ${
                  method === "cash"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-secondary/50"
                }`}
              >
                <input
                  id="method-cash"
                  type="radio"
                  name="payment-method"
                  value="cash"
                  checked={method === "cash"}
                  onChange={() => setMethod("cash")}
                  className="accent-primary h-4 w-4"
                />
                <div>
                  <p className="text-sm font-semibold">Cash Settlement</p>
                  <p className="text-xs text-muted-foreground">
                    Paid in person
                  </p>
                </div>
              </label>
            </fieldset>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label htmlFor="paid-amount" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Amount Paid
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                  ₹
                </span>
                <Input
                  id="paid-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="pl-7 h-11 text-base font-semibold"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  disabled={busy}
                />
              </div>
              {parseFloat(paidAmount) < amount - 0.009 && (
                <p className="text-xs text-amber-500">
                  Partial payment — remaining balance will stay.
                </p>
              )}
            </div>

            {/* View Expense Breakdown Button */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-xs text-primary hover:text-primary/90 hover:bg-primary/5 gap-1 h-9 font-medium"
              onClick={() => setBreakdownOpen(true)}
            >
              View Expense Breakdown <ChevronRight className="h-3.5 w-3.5" />
            </Button>

            {/* Confirm */}
            <Button
              id="confirm-settle-button"
              className="w-full h-11 gap-2"
              onClick={handleConfirm}
              disabled={busy || !groupId}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Confirm &amp; Settle
            </Button>

            {!groupId && (
              <p className="text-xs text-center text-destructive">
                No shared group found. Settlement cannot be recorded.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ExpenseBreakdownSheet
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
        currentUserId={payerId}
        counterpartyId={payeeId}
        displayName={payeeName}
        groupName={groupName}
        balanceAmount={amount}
      />
    </>
  );
}
