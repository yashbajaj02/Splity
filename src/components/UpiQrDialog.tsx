import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Banknote, CheckCircle2, Loader2, QrCode, XCircle, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CountUpCurrency } from "@/components/CountUpCurrency";
import { buildUpiUri } from "@/lib/debt";

export function UpiQrDialog({
  payeeName,
  payeeUpiId,
  amount,
  note,
  trigger,
  onCashPaid,
  cashDisabled,
  cashBusy,
  onUpiPaid,
  upiBusy,
}: {
  payeeName: string;
  payeeUpiId: string | null;
  amount: number;
  note?: string;
  trigger?: React.ReactNode;
  onCashPaid?: (paidAmount: number) => void;
  cashDisabled?: boolean;
  cashBusy?: boolean;
  onUpiPaid?: (paidAmount: number) => void;
  upiBusy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(amount);
  const [amountError, setAmountError] = useState<string | null>(null);

  // Sync amount when prop changes or dialog reopens
  useEffect(() => {
    if (open) {
      setPaymentAmount(amount);
      setAmountError(null);
      setAwaitingConfirmation(false);
    }
  }, [open, amount]);

  const hasUpi = !!payeeUpiId;

  // Both QR and deep-link use the same URI — always in sync
  const uri = hasUpi
    ? buildUpiUri({ payeeUpiId: payeeUpiId!, payeeName, amount: paymentAmount, note })
    : "";

  const handleAmountChange = (raw: string) => {
    const val = parseFloat(raw);
    if (isNaN(val) || val <= 0) {
      setAmountError("Enter a valid amount greater than ₹0.");
      setPaymentAmount(0);
    } else if (val > amount) {
      setAmountError(`Cannot exceed ₹${amount.toFixed(2)}.`);
      setPaymentAmount(amount);
    } else {
      setAmountError(null);
      setPaymentAmount(Math.round(val * 100) / 100);
    }
  };

  const handlePayNow = () => {
    // Open UPI intent via anchor — most reliable cross-device method
    // The OS intercepts the upi:// scheme and hands it to installed UPI apps
    const anchor = document.createElement("a");
    anchor.href = uri;
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    // Show confirmation screen after launching app
    setTimeout(() => setAwaitingConfirmation(true), 1000);
  };

  const handlePaymentCompleted = () => {
    if (!onUpiPaid) return;
    onUpiPaid(paymentAmount);
  };

  const handlePaymentFailed = () => {
    setAwaitingConfirmation(false);
  };

  const handleCashPaid = () => {
    if (!onCashPaid) return;
    onCashPaid(paymentAmount);
  };

  const isAmountValid = paymentAmount > 0 && paymentAmount <= amount && !amountError;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <QrCode className="mr-1.5 h-4 w-4" /> Settle up
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="font-display text-lg">
            Pay {payeeName}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {hasUpi
              ? "Scan the QR code or tap Pay Now. Both use identical payment data."
              : `${payeeName} hasn't added a UPI ID yet.`}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5">
          {/* Amount input — always shown, allows partial settlement */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Amount (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                ₹
              </span>
              <input
                type="number"
                inputMode="decimal"
                min="1"
                max={amount}
                step="0.01"
                defaultValue={amount.toFixed(2)}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="w-full pl-7 pr-4 py-2.5 rounded-xl border border-border bg-background text-base font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              />
            </div>
            {amountError ? (
              <p className="text-xs text-destructive">{amountError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Full amount: <CountUpCurrency amount={amount} />. Edit for partial settlement.
              </p>
            )}
          </div>

          {hasUpi ? (
            <>
              {/* QR code — auto-updates with amount */}
              {!awaitingConfirmation && (
                <div className="flex flex-col items-center gap-3">
                  <div className="rounded-2xl bg-white p-4 shadow-sm border border-border">
                    <QRCodeSVG
                      value={isAmountValid ? uri : "upi://pay"}
                      size={180}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    to <span className="font-medium text-foreground">{payeeUpiId}</span>
                  </p>
                </div>
              )}

              {/* Confirmation screen after returning from UPI app */}
              {awaitingConfirmation ? (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-secondary/60 p-4 text-center space-y-1">
                    <p className="font-semibold text-base">Did you successfully complete the payment?</p>
                    <p className="text-sm text-muted-foreground">
                      ₹{paymentAmount.toFixed(2)} to {payeeName}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Button
                      className="w-full gap-2 h-11"
                      onClick={handlePaymentCompleted}
                      disabled={upiBusy}
                    >
                      {upiBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Payment Completed
                    </Button>
                    <Button
                      className="w-full gap-2 h-11"
                      variant="outline"
                      onClick={handlePaymentFailed}
                      disabled={upiBusy}
                    >
                      <XCircle className="h-4 w-4" />
                      Payment Failed
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Pay Now — anchor-based, OS handles UPI intent natively */}
                  <Button
                    className="w-full gap-2 h-11"
                    disabled={!isAmountValid}
                    onClick={handlePayNow}
                    asChild={false}
                  >
                    <Smartphone className="h-4 w-4" />
                    Pay Now ₹{isAmountValid ? paymentAmount.toFixed(2) : "—"}
                  </Button>

                  {/* Cash settlement */}
                  {onCashPaid && (
                    <Button
                      className="w-full gap-2 h-11"
                      variant="outline"
                      onClick={handleCashPaid}
                      disabled={cashDisabled || cashBusy || upiBusy || !isAmountValid}
                    >
                      {cashBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Banknote className="h-4 w-4" />
                      )}
                      Cash Settlement
                    </Button>
                  )}
                </div>
              )}
            </>
          ) : (
            /* No UPI ID — only show cash option */
            <div className="space-y-3">
              <div className="rounded-2xl bg-secondary/40 p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Ask {payeeName} to add their UPI ID in profile, then you can scan & pay.
                </p>
              </div>
              {onCashPaid && (
                <Button
                  className="w-full gap-2 h-11"
                  variant="outline"
                  onClick={handleCashPaid}
                  disabled={cashDisabled || cashBusy || !isAmountValid}
                >
                  {cashBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Banknote className="h-4 w-4" />
                  )}
                  Cash Settlement
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
