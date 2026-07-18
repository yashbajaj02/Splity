import { useMemo, useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MIN_PASSWORD_LENGTH = 8;

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newTouched, setNewTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  const newPasswordError = useMemo(() => {
    if (!newTouched && !newPassword) return "";
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    return "";
  }, [newPassword, newTouched]);

  const confirmPasswordError = useMemo(() => {
    if (!confirmTouched && !confirmPassword) return "";
    if (newPassword !== confirmPassword) return "Passwords do not match.";
    return "";
  }, [confirmPassword, confirmTouched, newPassword]);

  const isValid =
    newPassword.length >= MIN_PASSWORD_LENGTH && newPassword === confirmPassword;

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setNewTouched(false);
    setConfirmTouched(false);
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setSuccess(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !busy) resetForm();
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewTouched(true);
    setConfirmTouched(true);

    if (!isValid) return;

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setSuccess(true);
    toast.success("Password updated successfully.");
    window.setTimeout(() => {
      resetForm();
      onOpenChange(false);
    }, 900);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="mx-4 max-w-md rounded-2xl border-border bg-card p-6 shadow-xl sm:mx-0">
        {success ? (
          <div className="py-7 text-center">
            <div className="mx-auto flex h-16 w-16 animate-in zoom-in-50 duration-300 items-center justify-center rounded-full bg-secondary text-primary">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="mt-4 font-display text-xl font-bold">
              Password updated successfully.
            </h2>
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-primary sm:mx-0">
                <KeyRound className="h-5 w-5" />
              </div>
              <DialogTitle className="font-display text-xl">
                Change Password
              </DialogTitle>
              <DialogDescription>
                Update the password for your signed-in account.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <PasswordInput
                id="current-password"
                label="Current Password (optional)"
                value={currentPassword}
                onChange={setCurrentPassword}
                visible={showCurrent}
                onToggleVisible={() => setShowCurrent((value) => !value)}
                autoComplete="current-password"
              />
              <PasswordInput
                id="new-password"
                label="New Password"
                value={newPassword}
                onChange={setNewPassword}
                onBlur={() => setNewTouched(true)}
                visible={showNew}
                onToggleVisible={() => setShowNew((value) => !value)}
                autoComplete="new-password"
                error={newPasswordError}
                required
              />
              <PasswordInput
                id="confirm-new-password"
                label="Confirm New Password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                onBlur={() => setConfirmTouched(true)}
                visible={showConfirm}
                onToggleVisible={() => setShowConfirm((value) => !value)}
                autoComplete="new-password"
                error={confirmPasswordError}
                required
              />

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={busy || !isValid}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Password
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  onBlur,
  visible,
  onToggleVisible,
  autoComplete,
  error = "",
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  visible: boolean;
  onToggleVisible: () => void;
  autoComplete: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="pr-10"
          required={required}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          onClick={onToggleVisible}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
