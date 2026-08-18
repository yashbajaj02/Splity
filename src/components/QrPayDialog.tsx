import { useRef, useState, useMemo } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { Camera, Download, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  getMyGroups,
  getGroupExpenses,
  getSplitsForGroup,
  getCleanExpenseDescription,
} from "@/lib/api";
import { computeExpenseBreakdown } from "@/lib/breakdown";
import type { Expense, ExpenseSplit } from "@/lib/app-types";

// ─── helpers ────────────────────────────────────────────────────────────────

function buildUpiQrValue(payeeUpiId: string, amount: number, note?: string): string {
  const parts = [`pa=${payeeUpiId}`, `am=${amount.toFixed(2)}`, `cu=INR`];
  if (note) parts.push(`tn=${encodeURIComponent(note)}`);
  return `upi://pay?${parts.join("&")}`;
}

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// ─── component ───────────────────────────────────────────────────────────────

export function QrPayDialog({
  payeeName,
  payeeUpiId,
  amount,
  baseAmount,
  note,
  currentUserId,
  counterpartyId,
  groupId,
  onSelectionChange,
}: {
  payeeName: string;
  payeeUpiId: string | null;
  amount: number;
  baseAmount?: number;
  note?: string;
  currentUserId?: string;
  counterpartyId?: string;
  groupId?: string;
  onSelectionChange?: (selected: Record<string, number> | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [savedDialogOpen, setSavedDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  // Track selected expense IDs to their FULL remaining amount
  // null means "Select All" is implicitly active
  const [selectedState, setSelectedState] = useState<Record<string, number> | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);

  const { data: breakdownData } = useQuery({
    queryKey: ["qr-expense-breakdown", currentUserId, counterpartyId],
    enabled: open && !!currentUserId && !!counterpartyId,
    queryFn: async () => {
      const groups = await getMyGroups(currentUserId!);
      const expenseArrays = await Promise.all(groups.map((g) => getGroupExpenses(g.id)));
      const allExpenses: Expense[] = expenseArrays.flat();

      const splitsArrays = await Promise.all(groups.map((g) => getSplitsForGroup(g.id)));
      const splits = splitsArrays.flat();

      const splitsByExpense: Record<string, ExpenseSplit[]> = {};
      for (const s of splits) {
        (splitsByExpense[s.expense_id] ??= []).push(s);
      }
      return computeExpenseBreakdown(currentUserId!, counterpartyId!, allExpenses, splitsByExpense);
    },
  });

  const unsettledExpenses = (breakdownData ?? []).filter((e) => e.remainingAmount > 0);

  // If no selection explicitly made, all are selected
  const isAllSelected = selectedState === null;
  const currentSelections =
    selectedState ??
    unsettledExpenses.reduce(
      (acc, curr) => {
        acc[curr.expense.id] = curr.remainingAmount;
        return acc;
      },
      {} as Record<string, number>,
    );

  function toggleExpense(expenseId: string, remainingAmount: number) {
    let next: Record<string, number>;
    if (selectedState === null) {
      // Create explicit state from all unsettled, then toggle one off
      next = unsettledExpenses.reduce(
        (acc, curr) => {
          acc[curr.expense.id] = curr.remainingAmount;
          return acc;
        },
        {} as Record<string, number>,
      );
      delete next[expenseId];
    } else {
      next = { ...selectedState };
      if (next[expenseId]) {
        delete next[expenseId];
      } else {
        next[expenseId] = remainingAmount;
      }
    }

    // Check if everything is selected again
    if (Object.keys(next).length === unsettledExpenses.length) {
      setSelectedState(null);
      onSelectionChange?.(undefined);
    } else {
      setSelectedState(next);
      onSelectionChange?.(next);
    }
  }

  function toggleAll() {
    if (isAllSelected) {
      setSelectedState({});
      onSelectionChange?.({});
    } else {
      setSelectedState(null);
      onSelectionChange?.(undefined);
    }
  }

  const currentAmount = amount;

  const qrValue = payeeUpiId
    ? buildUpiQrValue(payeeUpiId, currentAmount, note)
    : `splity:no-upi:${payeeName}`;

  const filename = `Splity_QR_${sanitizeFilename(payeeName.replace(/^@/, ""))}_${currentAmount.toFixed(2)}.png`;

  async function handleSaveQr() {
    // Find the canvas element rendered by QRCodeCanvas
    const canvas = canvasRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) {
      toast.error("Could not generate QR image.");
      return;
    }
    setSaving(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("QR image generation failed.");

      const file = new File([blob], filename, { type: "image/png" });

      if (
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({ files: [file], title: "Splity QR Code" });
      } else {
        // Desktop fallback — trigger download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      toast.success("✔ QR saved to Gallery");
      setSavedDialogOpen(true);
    } catch (err: unknown) {
      // User cancelled share sheet — not an error worth showing
      if (err instanceof Error && err.name !== "AbortError") {
        toast.error("Could not save QR. Try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        id={`qr-pay-trigger-${payeeName}`}
        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Camera className="h-4 w-4" />
        Pay
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-border/50 shrink-0">
            <DialogTitle className="font-display text-lg">Pay {payeeName}</DialogTitle>
            <p className="text-2xl font-display font-bold text-foreground mt-1">
              ₹{currentAmount.toFixed(2)}
            </p>
          </DialogHeader>

          <div className="px-6 py-6 space-y-5 flex-1 overflow-y-auto">
            <Collapsible
              open={breakdownOpen}
              onOpenChange={setBreakdownOpen}
              className="w-full space-y-2"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">View Expense Breakdown</h4>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    {breakdownOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="space-y-3">
                <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1 rounded-md border border-border/40 p-2">
                  {unsettledExpenses.length === 0 ? (
                    <p className="text-xs text-center text-muted-foreground py-4">
                      No pending expenses found.
                    </p>
                  ) : (
                    unsettledExpenses.map((e) => {
                      const isSelected = isAllSelected || !!selectedState?.[e.expense.id];
                      const isPaidByMe = e.expense.paid_by === currentUserId;
                      const cardStyle = isPaidByMe
                        ? "bg-[rgba(16,185,129,0.06)] border-[rgba(16,185,129,0.15)] hover:bg-[rgba(16,185,129,0.10)]"
                        : "bg-[rgba(239,68,68,0.06)] border-[rgba(239,68,68,0.15)] hover:bg-[rgba(239,68,68,0.10)]";
                      return (
                        <div
                          key={e.expense.id}
                          className={`flex items-start space-x-3 p-2 border rounded-lg transition-colors cursor-pointer ${cardStyle}`}
                          onClick={(evt) => {
                            // Don't toggle twice if they click the actual checkbox
                            if ((evt.target as HTMLElement).closest("button")) return;
                            toggleExpense(e.expense.id, e.remainingAmount);
                          }}
                        >
                          <Checkbox
                            id={`exp-${e.expense.id}`}
                            checked={isSelected}
                            onCheckedChange={() => toggleExpense(e.expense.id, e.remainingAmount)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex justify-between items-start">
                              <p className="text-sm font-medium leading-none truncate">
                                {getCleanExpenseDescription(e.expense.description)}
                              </p>
                              <p className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                {format(new Date(e.expense.created_at), "d MMM")}
                              </p>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                              <p className="text-xs text-muted-foreground">
                                Your Share: ₹{e.yourShare.toFixed(2)}
                              </p>
                              <p
                                className={`text-xs font-medium ${isPaidByMe ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}
                              >
                                Pending: ₹{e.remainingAmount.toFixed(2)}
                              </p>
                            </div>

                            {/* Payment History Entries */}
                            {e.payments && e.payments.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {e.payments.map((p, i) => (
                                  <div
                                    key={i}
                                    className="flex justify-between items-center px-2 py-1 rounded bg-secondary/60 border border-border/60"
                                  >
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

            {/* QR Code */}
            <div className="flex flex-col items-center gap-3">
              {payeeUpiId ? (
                <>
                  <div
                    ref={canvasRef}
                    className="rounded-2xl bg-white p-4 shadow-sm border border-border"
                  >
                    <QRCodeCanvas value={qrValue} size={200} level="M" includeMargin={false} />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    to <span className="font-medium text-foreground">{payeeUpiId}</span>
                  </p>
                </>
              ) : (
                <div className="rounded-2xl bg-secondary/40 p-5 text-center w-full">
                  <p className="text-sm text-muted-foreground">
                    {payeeName} hasn't added a UPI ID yet. Ask them to add one in their profile.
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2">
              {payeeUpiId && (
                <Button
                  id="save-qr-button"
                  className="w-full gap-2 h-11"
                  onClick={handleSaveQr}
                  disabled={saving}
                >
                  <Download className="h-4 w-4" />
                  {saving ? "Saving…" : "Save QR to Gallery"}
                </Button>
              )}
              <Button
                id="qr-pay-back-button"
                className="w-full h-11"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── "QR Saved Successfully" instruction dialog ── */}
      <Dialog open={savedDialogOpen} onOpenChange={setSavedDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">QR Saved Successfully</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Go to your favourite UPI app and follow these steps:
            </p>
            <ol className="space-y-2 text-sm">
              {[
                "Open your UPI app (GPay, PhonePe, Paytm, etc.)",
                'Tap "Scan QR"',
                "Choose from Gallery",
                "Select the saved Splity QR",
                "Complete your payment",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {i + 1}
                  </span>
                  <span className="text-foreground">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <Button
            id="qr-saved-done-button"
            className="w-full mt-2"
            onClick={() => setSavedDialogOpen(false)}
          >
            Done
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
