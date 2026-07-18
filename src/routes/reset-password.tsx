import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppLogo } from "@/components/AppLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPasswordPage,
});

const MIN_PASSWORD_LENGTH = 6;

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { session, loading, isPasswordRecovery, clearPasswordRecovery } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);

  const passwordError = useMemo(() => {
    if (!passwordTouched && !password) return "";
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    return "";
  }, [password, passwordTouched]);

  const confirmError = useMemo(() => {
    if (!confirmTouched && !confirmPassword) return "";
    if (password !== confirmPassword) return "Passwords do not match.";
    return "";
  }, [confirmPassword, confirmTouched, password]);

  const isValid =
    password.length >= MIN_PASSWORD_LENGTH && password === confirmPassword;

  const linkExpired = !loading && (!session || !isPasswordRecovery);

  useEffect(() => {
    if (!loading && session && !isPasswordRecovery) {
      navigate({ to: "/app" });
    }
  }, [loading, session, isPasswordRecovery, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordTouched(true);
    setConfirmTouched(true);

    if (!isValid) return;

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    clearPasswordRecovery();
    setComplete(true);
    toast.success("Password updated successfully.");
    window.setTimeout(() => {
      window.location.assign("/auth?passwordUpdated=1");
    }, 1600);
  };

  const handleCancel = () => {
    clearPasswordRecovery();
    navigate({ to: "/auth" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-gradient px-5 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <AppLogo className="h-9 w-9" />
          <span className="font-display text-lg font-bold">Splity</span>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : linkExpired ? (
            <div className="py-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h1 className="mt-4 font-display text-xl font-bold">
                Recovery link expired.
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Request another password reset.
              </p>
              <Button className="mt-6 w-full" onClick={() => navigate({ to: "/auth" })}>
                Back to Login
              </Button>
            </div>
          ) : complete ? (
            <div className="py-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h1 className="mt-4 font-display text-xl font-bold">
                Password updated successfully.
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Taking you back to sign in.
              </p>
            </div>
          ) : (
            <>
              <div className="text-center">
                <h1 className="font-display text-xl font-bold">Reset Password</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Choose a new password for your account.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <PasswordField
                  id="new-password"
                  label="New Password"
                  value={password}
                  onChange={setPassword}
                  onBlur={() => setPasswordTouched(true)}
                  error={passwordError}
                />
                <PasswordField
                  id="confirm-password"
                  label="Confirm Password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  onBlur={() => setConfirmTouched(true)}
                  error={confirmError}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" variant="outline" onClick={handleCancel} disabled={busy}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={busy || !isValid}>
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update Password
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder="At least 6 characters"
        required
        autoComplete="new-password"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
