import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { Camera, Download, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ─── helpers ────────────────────────────────────────────────────────────────

function buildUpiQrValue(payeeUpiId: string, amount: number, note?: string): string {
  const parts = [
    `pa=${payeeUpiId}`,
    `am=${amount.toFixed(2)}`,
    `cu=INR`,
  ];
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
  note,
}: {
  payeeName: string;
  payeeUpiId: string | null;
  amount: number;
  note?: string;
}) {
  const [open, setOpen] = useState(false);
  const [savedDialogOpen, setSavedDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const qrValue = payeeUpiId
    ? buildUpiQrValue(payeeUpiId, amount, note)
    : `splity:no-upi:${payeeName}`;

  const filename = `Splity_QR_${sanitizeFilename(payeeName.replace(/^@/, ""))}_${amount.toFixed(2)}.png`;

  async function handleSaveQr() {
    // Find the canvas element rendered by QRCodeCanvas
    const canvas = canvasRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) {
      toast.error("Could not generate QR image.");
      return;
    }
    setSaving(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
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
      {/* ── Trigger ── */}
      <Button
        size="sm"
        id={`qr-pay-trigger-${payeeName}`}
        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Camera className="h-4 w-4" />
        Pay
      </Button>

      {/* ── QR Payment Modal ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <DialogTitle className="font-display text-lg">
              Pay {payeeName}
            </DialogTitle>
            <p className="text-2xl font-display font-bold text-foreground mt-1">
              ₹{amount.toFixed(2)}
            </p>
          </DialogHeader>

          <div className="px-6 py-6 space-y-5">
            {/* QR Code */}
            <div className="flex flex-col items-center gap-3">
              {payeeUpiId ? (
                <>
                  <div
                    ref={canvasRef}
                    className="rounded-2xl bg-white p-4 shadow-sm border border-border"
                  >
                    <QRCodeCanvas
                      value={qrValue}
                      size={200}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    to{" "}
                    <span className="font-medium text-foreground">
                      {payeeUpiId}
                    </span>
                  </p>
                </>
              ) : (
                <div className="rounded-2xl bg-secondary/40 p-5 text-center w-full">
                  <p className="text-sm text-muted-foreground">
                    {payeeName} hasn't added a UPI ID yet. Ask them to add one
                    in their profile.
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
                <X className="h-4 w-4 mr-2" />
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
            <DialogTitle className="font-display text-lg">
              QR Saved Successfully
            </DialogTitle>
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
