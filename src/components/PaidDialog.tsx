import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle2 } from "lucide-react";
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

type PaymentMethod = "upi" | "cash";

export function PaidDialog({
  payeeName,
  amount,
  groupId,
  payeeId,
  payerId,
}: {
  payeeName: string;
  amount: number;
  groupId: string | null;
  payeeId: string;
  payerId: string;
}) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [paidAmount, setPaidAmount] = useState(amount.toFixed(2));
  const queryClient = useQueryClient();

  // Reset form each time dialog opens
  function handleOpenChange(next: boolean) {
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

  const upiMutation = useMutation({
    mutationFn: (v: { groupId: string; payeeId: string; amount: number }) =>
      settleByUpi({ groupId: v.groupId, payerId, payeeId: v.payeeId, amount: v.amount }),
    onSuccess: (_data, vars) => {
      toast.success(`Settled ₹${vars.amount.toFixed(2)} via UPI.`);
      invalidate();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
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
  });

  const busy = upiMutation.isPending || cashMutation.isPending;

  function handleConfirm() {
    const parsed = parseFloat(paidAmount);
    if (isNaN(parsed) || parsed <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }
    if (!groupId) {
      toast.error("No shared group found to record this payment.");
      return;
    }
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
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <DialogTitle className="font-display text-lg">
              I've Already Paid
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              to {payeeName}
            </p>
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
    </>
  );
}
