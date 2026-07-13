import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, QrCode, Users, Bell, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { AppLogo } from "@/components/AppLogo";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/app" });
  }, [loading, session, navigate]);

  return (
    <div className="min-h-screen bg-app-gradient">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <AppLogo className="h-9 w-9" />
          <span className="font-display text-lg font-bold">Splity</span>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-5">
        <section className="pt-10 pb-14 text-center sm:pt-16">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Settle up instantly with UPI
          </span>
          <h1 className="mx-auto mt-6 max-w-2xl font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Split expenses with friends.{" "}
            <span className="text-primary">Settle in seconds.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
            Track shared bills across groups, see exactly who owes whom, and
            pay back instantly by scanning a UPI QR code — GPay, PhonePe, any app.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/auth">
                Get started free <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 pb-20 sm:grid-cols-3">
          <FeatureCard
            icon={<Users className="h-5 w-5" />}
            title="Groups & friends"
            desc="Create groups and invite friends by their unique username."
          />
          <FeatureCard
            icon={<Bell className="h-5 w-5" />}
            title="Smart balances"
            desc="Debts are simplified automatically so you settle with fewer payments."
          />
          <FeatureCard
            icon={<QrCode className="h-5 w-5" />}
            title="UPI QR settle"
            desc="Generate a UPI QR and pay back directly from your phone."
          />
        </section>
      </main>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 text-left shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-base font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
