import { getCleanErrorMessage } from "@/lib/utils";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { AppLogo } from "@/components/AppLogo";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const { session, loading: authLoading, isPasswordRecovery } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [isPasswordResetReturn] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("passwordUpdated"),
  );

  useEffect(() => {
    if (authLoading || !session) return;
    if (isPasswordRecovery) {
      navigate({ to: "/reset-password" });
      return;
    }
    if (!isPasswordResetReturn) navigate({ to: "/app" });
  }, [authLoading, session, isPasswordRecovery, navigate, isPasswordResetReturn]);

  const handleGoogleSignIn = async () => {
    if (busy || googleBusy) return;
    setGoogleBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth`,
        },
      });
      if (error) {
        toast.error(getCleanErrorMessage(error));
        setGoogleBusy(false);
      }
    } catch (err) {
      toast.error(getCleanErrorMessage(err));
      setGoogleBusy(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(getCleanErrorMessage(error));
      return;
    }
    toast.success("Welcome back!");
    navigate({ to: "/app" });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/app` },
    });
    setBusy(false);
    if (error) {
      toast.error(getCleanErrorMessage(error));
      return;
    }
    // If email confirmation is required, session will be null.
    if (data.session) {
      toast.success("Account created!");
      navigate({ to: "/app" });
    } else {
      setEmailSent(true);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetBusy(true);

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setResetBusy(false);

    if (error) {
      toast.error("We couldn't send a reset link right now. Please try again.");
      return;
    }

    toast.success("Password reset link has been sent to your email.");
    setResetOpen(false);
  };

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-gradient px-5">
        <div className="w-[calc(100vw-2rem)] sm:w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
            <MailCheck className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-xl font-bold">Check your inbox</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a confirmation link to <strong>{email}</strong>. Click it to verify your
            account, then come back and sign in.
          </p>
          <Button variant="outline" className="mt-6 w-full" onClick={() => setEmailSent(false)}>
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-gradient px-5 py-10">
      <div className="w-[calc(100vw-2rem)] sm:w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <AppLogo className="h-9 w-9" />
          <span className="font-display text-lg font-bold">Splity</span>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="mt-5 space-y-4">
                <Field
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@example.com"
                />
                <Field
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="-mt-2 block text-sm font-medium text-primary transition-colors hover:text-primary/80"
                  onClick={() => {
                    setResetEmail(email);
                    setResetOpen(true);
                  }}
                >
                  Forgot Password?
                </button>
                <Button type="submit" className="w-full" disabled={busy || googleBusy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
              </form>

              <GoogleSignInSection
                disabled={busy || googleBusy}
                busy={googleBusy}
                onGoogleSignIn={handleGoogleSignIn}
              />
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="mt-5 space-y-4">
                <Field
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@example.com"
                />
                <Field
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="At least 6 characters"
                />
                <Button type="submit" className="w-full" disabled={busy || googleBusy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create account
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  You'll get a confirmation email to verify it's really you.
                </p>
              </form>

              <GoogleSignInSection
                disabled={busy || googleBusy}
                busy={googleBusy}
                onGoogleSignIn={handleGoogleSignIn}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="mx-4 max-w-md rounded-2xl border-border bg-card p-0 gap-0 shadow-xl sm:mx-0">
          <DialogHeader className="px-6 py-4 border-b border-border/50 shrink-0">
            <DialogTitle className="font-display text-xl">Reset your password</DialogTitle>
            <DialogDescription>
              Enter your email address and we'll send you a password reset link.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResetRequest} className="space-y-4 p-6 flex-1 overflow-y-auto">
            <div className="space-y-1.5">
              <Label htmlFor="reset-email">Email Address</Label>
              <Input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetOpen(false)}
                disabled={resetBusy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={resetBusy}>
                {resetBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Link
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
      />
    </div>
  );
}

function GoogleSignInSection({
  disabled,
  busy,
  onGoogleSignIn,
}: {
  disabled: boolean;
  busy: boolean;
  onGoogleSignIn: () => void;
}) {
  return (
    <>
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground font-medium">Or</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={onGoogleSignIn}
        disabled={disabled}
      >
        {busy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon className="mr-2 h-4 w-4" />
        )}
        Continue with Google
      </Button>
    </>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

