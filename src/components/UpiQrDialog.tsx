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
  onCashPaid?: (paidAmount: number) => void | Promise<void>;
  cashDisabled?: boolean;
  cashBusy?: boolean;
  onUpiPaid?: (paidAmount: number) => void | Promise<void>;
  upiBusy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  // Reset confirmation state when dialog opens
  useEffect(() => {
    if (open) {
      setAwaitingConfirmation(false);
    }
  }, [open]);

  const hasUpi = !!payeeUpiId;

  // The QR code URI uses the existing logic.
  const uri = hasUpi
    ? buildUpiUri({ payeeUpiId: payeeUpiId!, payeeName, amount, note })
    : "";

  // The deep link intent URI explicitly encodes spaces as %20.
  // URLSearchParams uses '+' for spaces, which fails in many UPI apps.
  const intentUri = hasUpi
    ? `upi://pay?pa=${encodeURIComponent(payeeUpiId!)}&pn=${encodeURIComponent(payeeName)}&am=${amount.toFixed(2)}&cu=INR${note ? `&tn=${encodeURIComponent(note)}` : ''}`
    : "";

  const handlePayNow = () => {
    const anchor = document.createElement("a");
    anchor.href = intentUri;
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    // Show confirmation screen after launching app
    setTimeout(() => setAwaitingConfirmation(true), 1000);
  };

  const handlePaymentCompleted = async () => {
    if (!onUpiPaid) return;
    try {
      await onUpiPaid(amount);
      setOpen(false);
    } catch (err) {
      // errors handled by mutation callbacks
    }
  };

  const handlePaymentFailed = () => {
    setAwaitingConfirmation(false);
  };

  const handleCashPaid = async () => {
    if (!onCashPaid) return;
    try {
      await onCashPaid(amount);
      setOpen(false);
    } catch (err) {
      // errors handled by mutation callbacks
    }
  };

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
              ? "Scan the QR code or tap Pay Now."
              : `${payeeName} hasn't added a UPI ID yet.`}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5">
          <div className="space-y-1.5 text-center">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Settlement Amount
            </p>
            <p className="font-display text-3xl font-bold text-foreground">
              <CountUpCurrency amount={amount} />
            </p>
          </div>

          {hasUpi ? (
            <>
              {!awaitingConfirmation && (
                <div className="flex flex-col items-center gap-3">
                  <div className="rounded-2xl bg-white p-4 shadow-sm border border-border">
                    <QRCodeSVG
                      value={uri}
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

              {awaitingConfirmation ? (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-secondary/60 p-4 text-center space-y-1">
                    <p className="font-semibold text-base">Did you successfully complete the payment?</p>
                    <p className="text-sm text-muted-foreground">
                      ₹{amount.toFixed(2)} to {payeeName}
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
                  <Button
                    className="w-full gap-2 h-11"
                    onClick={handlePayNow}
                    asChild={false}
                  >
                    <Smartphone className="h-4 w-4" />
                    Pay Now ₹{amount.toFixed(2)}
                  </Button>

                  {onCashPaid && (
                    <Button
                      className="w-full gap-2 h-11"
                      variant="outline"
                      onClick={handleCashPaid}
                      disabled={cashDisabled || cashBusy || upiBusy}
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
                  disabled={cashDisabled || cashBusy}
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
