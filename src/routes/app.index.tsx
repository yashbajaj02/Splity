import { getCleanErrorMessage, cn, getOptimizedCloudinaryUrl } from "@/lib/utils";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, lazy, Suspense } from "react";
import { useCachedQuery } from "@/hooks/use-cached-query";
import {
  Plus,
  Search,
  Home,
  Compass,
  Briefcase,
  Calendar,
  GraduationCap,
  Users,
  Loader2,
  X,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useSettleBalances } from "@/hooks/use-settle-balances";
import { getMyGroups, getProfile } from "@/lib/api";
import type { Group } from "@/lib/app-types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BalanceCard } from "@/components/BalanceCard";
import { Button } from "@/components/ui/button";

const AddExpenseDialog = lazy(() =>
  import("@/components/AddExpenseDialog").then((m) => ({ default: m.AddExpenseDialog }))
);
const CreateGroupModal = lazy(() =>
  import("@/components/CreateGroupModal").then((m) => ({ default: m.CreateGroupModal }))
);

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return "Good Morning";
  if (h >= 12 && h < 17) return "Good Afternoon";
  if (h >= 17 && h < 21) return "Good Evening";
  return "Good Night";
}

export const Route = createFileRoute("/app/")({
  component: GroupsHome,
});

// Category squircle icons & palettes matching the reference mockup
const GROUP_PALETTES = [
  { icon: Home, bg: "bg-emerald-50 text-emerald-600" },
  { icon: Compass, bg: "bg-sky-50 text-sky-600" },
  { icon: Briefcase, bg: "bg-amber-50 text-amber-600" },
  { icon: Calendar, bg: "bg-rose-50 text-rose-600" },
  { icon: GraduationCap, bg: "bg-purple-50 text-purple-600" },
];

function GroupsHome() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? "";
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);

  // Profile query — cache-first so greeting name appears on warm loads
  const profileQuery = useCachedQuery(`profile:${userId}`, {
    queryKey: ["profile", userId] as const,
    queryFn: () => getProfile(userId!),
    enabled: !!userId,
    staleTime: 300_000,
  });

  const firstName = useMemo(() => {
    const fullName = profileQuery.data?.full_name ?? session?.user?.user_metadata?.full_name as string | undefined;
    if (fullName) return fullName.split(" ")[0];
    return profileQuery.data?.username?.replace(/^@/, "") ?? "";
  }, [profileQuery.data, session]);

  const greeting = getTimeGreeting();

  // Groups query — cache-first so list renders immediately on warm loads
  const groupsQuery = useCachedQuery(`groups:${userId}`, {
    queryKey: ["my-groups", userId] as const,
    queryFn: () => getMyGroups(userId),
    enabled: !!userId,
  });

  const settleQuery = useSettleBalances(userId, groupsQuery.data);
  const groups = groupsQuery.data ?? [];

  const totalOwe = useMemo(
    () => settleQuery.data?.iOwe.reduce((sum, b) => sum + b.amount, 0) ?? 0,
    [settleQuery.data],
  );

  const totalOwed = useMemo(
    () => settleQuery.data?.owedToMe.reduce((sum, b) => sum + b.amount, 0) ?? 0,
    [settleQuery.data],
  );

  const isBalanceLoading = settleQuery.isLoading && !settleQuery.data;

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, searchQuery]);

  return (
    <>
      <div className="space-y-5">
        {/* Greeting + Header Row */}
        <div className="pt-2">
          {firstName && (
            <p className="text-xs font-semibold text-emerald-700 animate-fade-in">
              {greeting}, {firstName}! 👋
            </p>
          )}
          <div className="flex items-center justify-between mt-1">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Groups
            </h1>
            <button
              type="button"
              onClick={() => {
                if (typeof navigator !== "undefined" && !navigator.onLine) {
                  toast.error("Requires internet to create a group");
                  return;
                }
                setCreateDialogOpen(true);
              }}
              title={typeof navigator !== "undefined" && !navigator.onLine ? "Requires internet" : "Create new group"}
              className={cn(
                "h-9 px-3.5 rounded-full text-white flex items-center gap-1.5 shadow-sm btn-tactile font-semibold text-xs",
                typeof navigator !== "undefined" && !navigator.onLine
                  ? "bg-slate-400 cursor-not-allowed"
                  : "bg-emerald-700 hover:bg-emerald-800",
              )}
              aria-label="Create new group"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>New Group</span>
            </button>
          </div>
        </div>

        {/* Interactive Balance Card with Wave & State Switcher */}
        <BalanceCard
          totalOwe={totalOwe}
          totalOwed={totalOwed}
          isLoading={isBalanceLoading}
        />

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search groups"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl py-2.5 pl-10 pr-9 text-sm text-slate-800 placeholder:text-slate-500 outline-none shadow-[var(--shadow-1)] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:shadow-[0_0_12px_rgba(16,185,129,0.18)] transition-all duration-150"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Group list — spinner only on genuine first-ever cold load (no cache) */}
        {groupsQuery.isLoading && !groupsQuery.isPlaceholderData ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          </div>
        ) : groupsQuery.isError ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-slate-800">Groups could not load</p>
            <p className="mt-1 text-xs text-slate-500">{(groupsQuery.error as Error).message}</p>
            <Button
              className="mt-4"
              size="sm"
              variant="outline"
              onClick={() => groupsQuery.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : filteredGroups.length === 0 && searchQuery ? (
          <div className="rounded-2xl bg-white border border-slate-100 p-8 text-center">
            <p className="text-sm font-semibold text-slate-800">No groups found</p>
            <p className="text-xs text-slate-400 mt-1">Try a different search term</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredGroups.map((g, idx) => {
              const palette = GROUP_PALETTES[idx % GROUP_PALETTES.length];
              const Icon = palette.icon;

              return (
                <Link
                  key={g.id}
                  to="/app/group/$groupId"
                  params={{ groupId: g.id }}
                  style={{ "--stagger": idx } as React.CSSProperties}
                  className="group flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100 shadow-[var(--shadow-1)] card-hover-green cursor-pointer animate-stagger-item"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {g.avatar_url ? (
                      <Avatar className="w-12 h-12 rounded-2xl shrink-0 transition-transform duration-200 group-hover:scale-110 shadow-2xs">
                        <AvatarImage src={getOptimizedCloudinaryUrl(g.avatar_url)} alt={g.name} />
                        <AvatarFallback className={`rounded-2xl ${palette.bg}`}>
                          <Icon className="w-5 h-5 stroke-[2.2]" />
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110 ${palette.bg}`}
                      >
                        <Icon className="w-5 h-5 stroke-[2.2]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-display font-bold text-slate-900 text-sm truncate">
                        {g.name}
                      </p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        {g.description ? g.description : "Split expenses"}
                      </p>
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 text-slate-400 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              );
            })}

            {/* Create New Group action card */}
            <button
              type="button"
              onClick={() => setCreateDialogOpen(true)}
              className="w-full text-left p-4 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/30 hover:bg-emerald-50/60 transition-all flex items-center gap-3.5 active:scale-[0.99] card-hover"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <p className="font-display font-bold text-sm text-emerald-800">
                  Create New Group
                </p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Start splitting with friends
                </p>
              </div>
            </button>
          </div>
        )}
      </div>

      {createDialogOpen && (
        <Suspense fallback={null}>
          <CreateGroupModal
            userId={userId}
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
          />
        </Suspense>
      )}

      {groups.length > 0 && (
        <button
          type="button"
          onClick={() => setAddExpenseOpen(true)}
          className="fixed bottom-20 right-4 z-20 flex h-12 items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 shadow-xl transition-all duration-150 active:scale-[0.98] hover:scale-[1.02] hover:shadow-2xl text-xs font-bold"
          aria-label="Add expense"
        >
          <Plus className="h-4 w-4 stroke-[3]" />
          <span>Add Expense</span>
        </button>
      )}

      {addExpenseOpen && (
        <Suspense fallback={null}>
          <AddExpenseDialog
            userId={userId}
            groups={groups.map((g) => ({ id: g.id, name: g.name }))}
            open={addExpenseOpen}
            onOpenChange={setAddExpenseOpen}
          />
        </Suspense>
      )}
    </>
  );
}

