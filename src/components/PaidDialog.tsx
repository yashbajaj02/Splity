import { useRef, useState, useEffect, useMemo } from "react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { getMyGroups, getGroupExpenses, getSplitsForGroup } from "@/lib/api";
import { computeExpenseBreakdown } from "@/lib/breakdown";
import type { Expense, ExpenseSplit } from "@/lib/app-types";

type PaymentMethod = "upi" | "cash";

export function PaidDialog({
  payeeName,
  groupName,
  amount,
  groupId,
  payeeId,
  payerId,
  selectedExpenses,
  baseAmount,
  onSelectionChange,
}: {
  payeeName: string;
  groupName?: string | null;
  amount: number;
  groupId: string | null;
  payeeId: string;
  payerId: string;
  selectedExpenses?: Record<string, number>;
  baseAmount?: number;
  onSelectionChange?: (selected: Record<string, number> | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("upi");
  
  // Track manual input vs auto-calculated amount
  const [selectedState, setSelectedState] = useState<Record<string, number> | null>(
    selectedExpenses ?? null
  );

  useEffect(() => {
    if (selectedExpenses !== undefined) {
      setSelectedState(selectedExpenses);
    }
  }, [selectedExpenses]);

  const [manualAmount, setManualAmount] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const queryClient = useQueryClient();

  const { data: breakdownData } = useQuery({
    queryKey: ["qr-expense-breakdown", payerId, payeeId],
    enabled: open && !!payerId && !!payeeId,
    queryFn: async () => {
      const groups = await getMyGroups(payerId);
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
      return computeExpenseBreakdown(payerId, payeeId, allExpenses, splitsByExpense);
    },
  });

  const unsettledExpenses = (breakdownData ?? []).filter(e => e.remainingAmount > 0);
  const isAllSelected = selectedState === null;

  const selectedTotal = useMemo(() => {
    if (selectedState === null) {
      if (unsettledExpenses.length > 0) {
        return unsettledExpenses.reduce((sum, e) => sum + e.remainingAmount, 0);
      }
      return amount;
    }
    return Object.values(selectedState).reduce((sum, amt) => sum + amt, 0);
  }, [selectedState, unsettledExpenses, amount]);

  const displayAmount = manualAmount !== null ? manualAmount : selectedTotal.toFixed(2);
  const [paidAmount, setPaidAmount] = useState(displayAmount);

  useEffect(() => {
    if (manualAmount === null) {
      setPaidAmount(selectedTotal.toFixed(2));
    }
  }, [selectedTotal, manualAmount]);

  function toggleExpense(expenseId: string, remainingAmount: number) {
    let next: Record<string, number> | null;
    const currentMap = selectedState ?? unsettledExpenses.reduce((acc, curr) => {
      acc[curr.expense.id] = curr.remainingAmount;
      return acc;
    }, {} as Record<string, number>);

    const updated = { ...currentMap };
    if (updated[expenseId]) {
      delete updated[expenseId];
    } else {
      updated[expenseId] = remainingAmount;
    }

    if (Object.keys(updated).length === unsettledExpenses.length) {
      next = null;
      onSelectionChange?.(undefined);
    } else {
      next = updated;
      onSelectionChange?.(updated);
    }
    setSelectedState(next);
    setManualAmount(null); // Reset manual input when selection changes
  }

  function toggleAll() {
    if (isAllSelected) {
      setSelectedState({});
      onSelectionChange?.({});
    } else {
      setSelectedState(null);
      onSelectionChange?.(undefined);
    }
    setManualAmount(null); // Reset manual input when selection changes
  }

  const upiMutation = useMutation({
    mutationFn: (v: { groupId: string; payeeId: string; amount: number; settledExpenses?: Record<string, number> }) =>
      settleByUpi({ groupId: v.groupId, payerId, payeeId: v.payeeId, amount: v.amount, settledExpenses: v.settledExpenses }),
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
    mutationFn: (v: { groupId: string; payeeId: string; amount: number; settledExpenses?: Record<string, number> }) =>
      settleByCash({ groupId: v.groupId, payerId, payeeId: v.payeeId, amount: v.amount, settledExpenses: v.settledExpenses }),
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
    
    // Distribute parsed amount across selected expenses
    const selectedList = unsettledExpenses.filter(e => isAllSelected || !!selectedState?.[e.expense.id]);
    const settledToSave: Record<string, number> = {};
    let pool = parsed;
    for (const exp of selectedList) {
      if (pool <= 0) break;
      const take = Math.min(pool, exp.remainingAmount);
      settledToSave[exp.expense.id] = take;
      pool -= take;
    }

    const vars = { groupId, payeeId, amount: parsed, settledExpenses: settledToSave };
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
        onClick={() => {
          setManualAmount(null);
          setPaidAmount(amount.toFixed(2));
          handleOpenChange(true);
        }}
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
                  ₹{baseAmount !== undefined ? baseAmount.toFixed(2) : amount.toFixed(2)}
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
                  value={displayAmount}
                  onChange={(e) => {
                    setManualAmount(e.target.value);
                    setPaidAmount(e.target.value);
                  }}
                  disabled={busy}
                />
              </div>
              {parseFloat(paidAmount) < amount - 0.009 && (
                <p className="text-xs text-amber-500">
                  Partial payment — remaining balance will stay.
                </p>
              )}
            </div>

            {/* View Expense Breakdown (Collapsible) */}
            <Collapsible
                open={breakdownOpen}
                onOpenChange={setBreakdownOpen}
                className="w-full"
              >
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-primary hover:text-primary/90 hover:bg-primary/5 gap-1 h-9 font-medium"
                  >
                    View Expense Breakdown <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-2">
                  <div className="flex items-center space-x-2 px-1">
                    <Checkbox
                      id="paid-select-all"
                      checked={isAllSelected}
                      onCheckedChange={toggleAll}
                    />
                    <label
                      htmlFor="paid-select-all"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Select All
                    </label>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1 rounded-md border border-border/40 p-2">
                    {unsettledExpenses.length === 0 ? (
                      <p className="text-xs text-center text-muted-foreground py-4">
                        No pending expenses found.
                      </p>
                    ) : (
                      unsettledExpenses.map((e) => {
                        const isSelected = isAllSelected || !!selectedState?.[e.expense.id];
                        const isPaidByMe = e.expense.paid_by === payerId;
                        const cardStyle = isPaidByMe
                          ? "bg-[rgba(16,185,129,0.06)] border-[rgba(16,185,129,0.15)] hover:bg-[rgba(16,185,129,0.10)]"
                          : "bg-[rgba(239,68,68,0.06)] border-[rgba(239,68,68,0.15)] hover:bg-[rgba(239,68,68,0.10)]";
                        return (
                        <div
                          key={e.expense.id}
                          className={`flex items-start space-x-3 p-2 border rounded-lg transition-colors cursor-pointer ${cardStyle}`}
                          onClick={(evt) => {
                            if ((evt.target as HTMLElement).closest('button')) return;
                            toggleExpense(e.expense.id, e.remainingAmount);
                          }}
                        >
                          <Checkbox
                            id={`paid-exp-${e.expense.id}`}
                            checked={isSelected}
                            onCheckedChange={() => toggleExpense(e.expense.id, e.remainingAmount)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex justify-between items-start">
                              <p className="text-sm font-medium leading-none truncate">
                                {e.expense.description}
                              </p>
                              <p className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                {format(new Date(e.expense.created_at), "d MMM")}
                              </p>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                              <p className="text-xs text-muted-foreground">
                                Your Share: ₹{e.yourShare.toFixed(2)}
                              </p>
                              <p className={`text-xs font-medium ${isPaidByMe ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                                Pending: ₹{e.remainingAmount.toFixed(2)}
                              </p>
                            </div>
                            
                            {/* Payment History Entries */}
                            {e.payments && e.payments.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {e.payments.map((p, i) => (
                                  <div key={i} className="flex justify-between items-center px-2 py-1 rounded bg-secondary/60 border border-border/60">
                                    <p className="text-[10px] text-foreground/80 font-medium">
                                      Paid ₹{p.amount.toFixed(2)}
                                    </p>
                                    <p className="text-[9px] text-muted-foreground">
                                      {p.date ? format(new Date(p.date), "d MMM • h:mm a") : ""}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                          </div>
                        </div>
                      );
                    })
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

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
