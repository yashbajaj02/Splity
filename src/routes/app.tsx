import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Users, Bell, HandCoins, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useSupabaseRealtime } from "@/hooks/use-supabase-realtime";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { startBackgroundSync } from "@/lib/offline-db";
import { getProfile, getNotifications, executeSyncAction } from "@/lib/api";
import { useCachedQuery } from "@/hooks/use-cached-query";
import { Onboarding } from "@/components/Onboarding";
import { AppLogo } from "@/components/AppLogo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { motion, useReducedMotion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { cn, getInitials } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  const { session, loading, isPasswordRecovery, signOut } = useAuth();
  const navigate = useNavigate();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isOnline, pendingSyncCount } = useNetworkStatus();

  useEffect(() => {
    if (!loading && isPasswordRecovery) {
      navigate({ to: "/reset-password" });
      return;
    }
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, isPasswordRecovery, navigate]);

  // Initialize reduce-motion preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("splity-reduce-motion");
    if (saved === "true") {
      document.documentElement.classList.add("reduce-motion");
    } else {
      document.documentElement.classList.remove("reduce-motion");
    }
  }, []);

  // Background 30-second silent sync
  useEffect(() => {
    startBackgroundSync(executeSyncAction);
    const handleSynced = () => {
      queryClient.invalidateQueries();
    };
    window.addEventListener("splity:synced", handleSynced);
    return () => window.removeEventListener("splity:synced", handleSynced);
  }, [queryClient]);

  const profileQuery = useCachedQuery(`profile:${userId ?? ""}`, {
    queryKey: ["profile", userId] as const,
    queryFn: () => getProfile(userId!),
    enabled: !!userId && !isPasswordRecovery,
  });

  const notifQuery = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => getNotifications(userId!),
    enabled: !!userId && !isPasswordRecovery,
  });

  // Global realtime synchronization
  useSupabaseRealtime(userId && !isPasswordRecovery ? userId : undefined);

  // Block render only when we have no profile data at all (genuine cold start).
  // When placeholderData is served from IDB, isPlaceholderData=true and
  // isLoading=false, so we fall through immediately to the app shell.
  if (loading || isPasswordRecovery || !session || (profileQuery.isLoading && !profileQuery.isPlaceholderData)) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 px-5 py-3.5 header">
          <div className="mx-auto flex max-w-2xl items-center justify-between">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-5 py-6 space-y-6">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </main>
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
          <div className="mt-5 flex items-center justify-center gap-3">
            <Button variant="outline" onClick={() => profileQuery.refetch()}>
              Try again
            </Button>
            <Button variant="secondary" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const profile = profileQuery.data;
  const needsOnboarding = !profile || !profile.username || !profile.upi_id;

  if (needsOnboarding) {
    const userMeta = session.user.user_metadata;
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
  const userMeta = session.user.user_metadata;

  return (
    <div className="min-h-screen w-full bg-white text-foreground flex flex-col items-center">
      {!isOnline && (
        <div className="sticky top-0 z-50 w-full bg-slate-900 text-white text-xs font-semibold py-2 px-3 text-center flex items-center justify-center gap-2 shadow-md">
          <span>📡 Offline - Changes will sync</span>
          {pendingSyncCount > 0 && (
            <span className="bg-emerald-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
              {pendingSyncCount} queued
            </span>
          )}
        </div>
      )}
      <div className="w-full max-w-[480px] min-h-screen flex flex-col relative pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
        <main key={pathname} className="flex-1 px-4 sm:px-5 pt-4 animate-page-enter">
          <Outlet />
        </main>

        <BottomNav pendingCount={pendingCount} />
      </div>
    </div>
  );
}

function BottomNav({ pendingCount }: { pendingCount: number }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const shouldReduceMotion = useReducedMotion();

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
    { to: "/app/profile", label: "Profile", icon: User },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-center bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-[0_-2px_10px_rgba(0,0,0,0.03)] pb-safe bottom-nav">
      <div className="w-full max-w-[480px] h-16 flex items-center justify-around px-3">
        {items.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          const Icon = item.icon;
          const hasBadge = "badge" in item && !!item.badge;

          return (
            <Link
              key={item.to}
              to={item.to as "/app" | "/app/activity" | "/app/settle" | "/app/profile"}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-2xl text-[11px] font-semibold transition-colors duration-200 select-none active:scale-95",
                active ? "text-emerald-700" : "text-slate-400 hover:text-slate-600",
              )}
            >
              {active && (
                <motion.div
                  layoutId="bottomNavActivePill"
                  className="absolute inset-0 rounded-2xl bg-emerald-50/90 border border-emerald-200/60 shadow-[0_0_16px_rgba(16,185,129,0.25)] -z-10"
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : {
                          type: "spring",
                          stiffness: 350,
                          damping: 28,
                          duration: 0.25,
                        }
                  }
                />
              )}

              <div className="relative flex items-center justify-center w-7 h-7">
                <Icon
                  className={cn(
                    "h-5 w-5 stroke-[2.2] transition-transform duration-200",
                    active ? "text-emerald-700 scale-105" : "text-slate-400",
                  )}
                />
                {hasBadge && (
                  <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-xs">
                    {item.badge! > 9 ? "9+" : item.badge}
                  </span>
                )}
              </div>

              <span
                className={cn(
                  "tracking-tight transition-all duration-200",
                  active ? "font-bold text-emerald-700" : "font-medium text-slate-400",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
