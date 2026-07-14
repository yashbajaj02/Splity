import { QRCodeSVG } from "qrcode.react";
import { Banknote, Loader2, QrCode } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
}: {
  payeeName: string;
  payeeUpiId: string | null;
  amount: number;
  note?: string;
  trigger?: React.ReactNode;
  onCashPaid?: () => void;
  cashDisabled?: boolean;
  cashBusy?: boolean;
}) {
  const hasUpi = !!payeeUpiId;
  const uri = hasUpi ? buildUpiUri({ payeeUpiId: payeeUpiId!, payeeName, amount, note }) : "";

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <QrCode className="mr-1.5 h-4 w-4" /> Settle up
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Pay {payeeName}</DialogTitle>
          <DialogDescription>
            Scan with any UPI app (GPay, PhonePe, Paytm) to pay{" "}
            <strong>
              <CountUpCurrency amount={amount} />
            </strong>
            .
          </DialogDescription>
        </DialogHeader>

        {hasUpi ? (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <QRCodeSVG value={uri} size={200} level="M" />
            </div>
            <div className="text-center">
              <p className="font-display text-2xl font-bold text-primary">
                <CountUpCurrency amount={amount} />
              </p>
              <p className="text-sm text-muted-foreground">to {payeeUpiId}</p>
            </div>
            <a href={uri} className="w-full">
              <Button className="w-full">Open in UPI app</Button>
            </a>
            {onCashPaid && (
              <Button
                className="w-full"
                variant="outline"
                onClick={onCashPaid}
                disabled={cashDisabled || cashBusy}
              >
                {cashBusy ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Banknote className="mr-1.5 h-4 w-4" />
                )}
                Paid by cash
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-6">
            <p className="text-center text-sm text-muted-foreground">
              {payeeName} hasn't added a UPI ID yet. Ask them to update their profile, or mark it
              paid if you settled directly.
            </p>
            {onCashPaid && (
              <Button
                className="w-full"
                variant="outline"
                onClick={onCashPaid}
                disabled={cashDisabled || cashBusy}
              >
                {cashBusy ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Banknote className="mr-1.5 h-4 w-4" />
                )}
                Paid by cash
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
