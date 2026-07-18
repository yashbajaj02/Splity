import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Users, Bell, HandCoins, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getProfile, getNotifications } from "@/lib/api";
import { Onboarding } from "@/components/Onboarding";
import { AppLogo } from "@/components/AppLogo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  const { session, loading, isPasswordRecovery } = useAuth();
  const navigate = useNavigate();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && isPasswordRecovery) {
      navigate({ to: "/reset-password" });
      return;
    }
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, isPasswordRecovery, navigate]);

  const profileQuery = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getProfile(userId!),
    enabled: !!userId && !isPasswordRecovery,
  });

  const notifQuery = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => getNotifications(userId!),
    enabled: !!userId && !isPasswordRecovery,
  });

  // Realtime: refetch notifications & related data on any change to my notifications.
  useEffect(() => {
    if (!userId || isPasswordRecovery) return;
    const channel = supabase
      .channel(`app-sync-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
          queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "expenses",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["settle", userId] });
          queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "expense_splits",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["settle", userId] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_members",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
          queryClient.invalidateQueries({ queryKey: ["settle", userId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, isPasswordRecovery, queryClient]);

  if (loading || isPasswordRecovery || !session || profileQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (profileQuery.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-xl font-bold">Profile could not load</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {(profileQuery.error as Error).message}
          </p>
          <Button className="mt-5" variant="outline" onClick={() => profileQuery.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const profile = profileQuery.data;
  const needsOnboarding = !profile || !profile.username || !profile.upi_id;

  if (needsOnboarding) {
    return (
      <Onboarding
        userId={userId!}
        email={session.user.email ?? ""}
        existing={profile ?? undefined}
        onDone={() => profileQuery.refetch()}
      />
    );
  }

  const pendingCount = (notifQuery.data ?? []).filter((n) => n.status === "pending").length;

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3.5">
          <Link to="/app" className="flex items-center gap-2">
            <AppLogo className="h-8 w-8 rounded-lg" />
            <span className="font-display text-base font-bold">Splity</span>
          </Link>
          <Link
            to="/app/profile"
            className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 text-sm font-medium transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Avatar className="h-6 w-6 border-border">
              <AvatarImage src={profile.avatar_url ?? undefined} />
              <AvatarFallback className="text-[10px] bg-secondary text-primary">
                {getInitials(
                  profile.full_name ?? session.user.user_metadata.full_name ?? session.user.user_metadata.name ?? "",
                  session.user.email ?? ""
                )}
              </AvatarFallback>
            </Avatar>
            Profile
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-6">
        <Outlet />
      </main>

      <BottomNav pendingCount={pendingCount} />
    </div>
  );
}

function BottomNav({ pendingCount }: { pendingCount: number }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items: {
    to: string;
    label: string;
    icon: LucideIcon;
    exact?: boolean;
    badge?: number;
  }[] = [
    { to: "/app", label: "Groups", icon: Users, exact: true },
    { to: "/app/activity", label: "Activity", icon: Bell, badge: pendingCount },
    { to: "/app/settle", label: "Settle Up", icon: HandCoins },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around px-2 py-1.5">
        {items.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          const Icon = item.icon;
          const hasBadge = "badge" in item && !!item.badge;
          return (
            <Link
              key={item.to}
              to={item.to as "/app" | "/app/activity" | "/app/settle"}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-xs font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                hasBadge && !active && "text-warning",
              )}
            >
              <span className="relative inline-flex items-center justify-center">
                {hasBadge ? (
                  <span
                    className="pointer-events-none absolute -inset-1.5 rounded-full bg-warning/35 animate-bell-glow"
                    aria-hidden
                  />
                ) : null}
                <Icon
                  className={cn(
                    "relative z-[1] h-5 w-5",
                    hasBadge && "animate-bell-ring text-warning",
                  )}
                />
                {hasBadge ? (
                  <span className="absolute -right-2 -top-1.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground ring-2 ring-background">
                    {item.badge! > 9 ? "9+" : item.badge}
                  </span>
                ) : null}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function getInitials(name: string, email: string) {
  const source = name.trim() || email.trim();
  if (!source) return "SP";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
