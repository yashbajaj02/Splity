import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo, memo, lazy, Suspense } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Clock, HandCoins, Loader2, LogOut, Receipt, Search, Trash2, UserPlus, Users, ChevronDown, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  canDeleteExpense,
  deleteExpense,
  deleteGroup,
  findUserByUsername,
  getGroup,
  getGroupExpenses,
  getGroupMembers,
  getProfilesByIds,
  getSplitsForExpenses,
  inviteToGroup,
  leaveGroup,
} from "@/lib/api";
import type { Expense, ExpenseSplit, PairwiseDebt, Profile } from "@/lib/app-types";
import { computePairwiseDebts } from "@/lib/debt";
import { supabase } from "@/lib/supabase";
const AddExpenseDialog = lazy(() => import("@/components/AddExpenseDialog").then((m) => ({ default: m.AddExpenseDialog })));
import { CountUpCurrency } from "@/components/CountUpCurrency";
import { QrPayDialog } from "@/components/QrPayDialog";
import { PaidDialog } from "@/components/PaidDialog";
import { ExpenseBreakdownSheet } from "@/components/ExpenseBreakdownSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/app/group/$groupId")({
  component: GroupDetail,
});

function GroupDetail() {
  const { groupId } = Route.useParams();
  const { session } = useAuth();
  const userId = session!.user.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [visibleExpenseCount, setVisibleExpenseCount] = useState(5);
  const [activeDropdown, setActiveDropdown] = useState<"members" | "settlements" | null>(null);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [settlementSearchQuery, setSettlementSearchQuery] = useState("");

  // Derive fromDate / toDate from the current preset
  const { fromDate, toDate } = (() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const today = new Date();
    if (datePreset === "today") {
      const t = fmt(today);
      return { fromDate: t, toDate: t };
    }
    if (datePreset === "yesterday") {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      const yStr = fmt(y);
      return { fromDate: yStr, toDate: yStr };
    }
    if (datePreset === "last7") {
      const d = new Date(today); d.setDate(d.getDate() - 6);
      return { fromDate: fmt(d), toDate: fmt(today) };
    }
    if (datePreset === "thisMonth") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { fromDate: fmt(start), toDate: fmt(end) };
    }

    if (datePreset === "custom") {
      return { fromDate: customFrom, toDate: customTo };
    }
    return { fromDate: "", toDate: "" };
  })();

  const groupQuery = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => getGroup(groupId),
  });
  const membersQuery = useQuery({
    queryKey: ["group-members", groupId],
    queryFn: () => getGroupMembers(groupId),
  });
  const expensesQuery = useQuery({
    queryKey: ["group-expenses", groupId],
    queryFn: () => getGroupExpenses(groupId),
  });

  const memberIds = (membersQuery.data ?? []).map((member) => member.user_id);
  const profilesQuery = useQuery({
    queryKey: ["profiles", memberIds.sort().join(",")],
    queryFn: () => getProfilesByIds(memberIds),
    enabled: memberIds.length > 0,
  });

  const profileMap = useMemo(
    () => new Map<string, Profile>((profilesQuery.data ?? []).map((profile) => [profile.id, profile])),
    [profilesQuery.data],
  );

  const nameOfDisplay = (id: string) => {
    const profile = profileMap.get(id);
    if (id === userId) return "You";
    if (profile?.full_name?.trim()) return profile.full_name.trim();
    if (profile?.username?.trim()) return profile.username.trim();
    return "User";
  };

  const nameOf = (id: string) => {
    const profile = profileMap.get(id);
    if (id === userId) return `You${profile?.username ? ` (@${profile.username})` : ""}`;
    if (profile) {
      if (profile.full_name && profile.username) return `${profile.full_name} (@${profile.username})`;
      if (profile.full_name) return profile.full_name;
      if (profile.username) return `@${profile.username}`;
    }
    return "user";
  };

  const expenseIds = (expensesQuery.data ?? []).map((expense) => expense.id);
  const splitsQuery = useQuery({
    queryKey: ["group-splits", groupId, expenseIds.join(",")],
    queryFn: () => getSplitsForExpenses(expenseIds),
    enabled: expenseIds.length > 0,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`group-live-${groupId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses", filter: `group_id=eq.${groupId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["group-expenses", groupId] });
          queryClient.invalidateQueries({ queryKey: ["group-splits", groupId] });
          queryClient.invalidateQueries({ queryKey: ["settle", userId] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members", filter: `group_id=eq.${groupId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
          queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
          queryClient.invalidateQueries({ queryKey: ["settle", userId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, queryClient, userId]);

  const leaveMutation = useMutation({
    mutationFn: () => leaveGroup(groupId, userId),
    onSuccess: () => {
      toast.success("Left the group");
      queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
      navigate({ to: "/app" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteGroup(groupId),
    onSuccess: () => {
      toast.success("Group deleted");
      queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
      navigate({ to: "/app" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeExpenseMutation = useMutation({
    mutationFn: (expenseId: string) => deleteExpense(expenseId, userId),
    onSuccess: () => {
      toast.success("Expense removed");
      queryClient.invalidateQueries({ queryKey: ["group-expenses", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-splits", groupId] });
      queryClient.invalidateQueries({ queryKey: ["settle", userId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (groupQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (groupQuery.isError) {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-sm font-medium text-foreground">Could not load this group.</p>
        <p className="text-sm text-muted-foreground">{(groupQuery.error as Error).message}</p>
        <Button variant="outline" size="sm" onClick={() => groupQuery.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!groupQuery.data) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Group not found.</div>;
  }

  const group = groupQuery.data;
  const members = membersQuery.data ?? [];
  const acceptedMembers = members.filter((member) => member.status === "accepted");
  const pendingMembers = members.filter((member) => member.status === "pending");
  const expenses = expensesQuery.data ?? [];
  const filteredExpenses = expenses.filter((expense) => {
    const expenseDate = expense.created_at.slice(0, 10);
    if (fromDate && expenseDate < fromDate) return false;
    if (toDate && expenseDate > toDate) return false;
    return true;
  });
  const visibleExpenses = filteredExpenses.slice(0, visibleExpenseCount);
  const hasMoreExpenses = filteredExpenses.length > visibleExpenseCount;
  const splitsByExpense: Record<string, ExpenseSplit[]> = {};
  for (const split of splitsQuery.data ?? []) {
    (splitsByExpense[split.expense_id] ??= []).push(split);
  }
  const pairwiseDebts = computePairwiseDebts(expenses, splitsByExpense);
  const visibleDebts = pairwiseDebts.filter((debt) => debt.from === userId || debt.to === userId);
  const isCreator = group.created_by === userId;
  const isMember = acceptedMembers.some((member) => member.user_id === userId);

  // Client-side search filters
  const filteredAcceptedMembers = useMemo(() => {
    const q = memberSearchQuery.trim().toLowerCase().replace(/^@/, "");
    if (!q) return acceptedMembers;
    return acceptedMembers.filter((m) => {
      const p = profileMap.get(m.user_id);
      const dName = (p?.full_name ?? "").toLowerCase();
      const uName = (p?.username ?? "").toLowerCase();
      return dName.includes(q) || uName.includes(q);
    });
  }, [acceptedMembers, profileMap, memberSearchQuery]);

  const filteredPendingMembers = useMemo(() => {
    const q = memberSearchQuery.trim().toLowerCase().replace(/^@/, "");
    if (!q) return pendingMembers;
    return pendingMembers.filter((m) => {
      const p = profileMap.get(m.user_id);
      const dName = (p?.full_name ?? "").toLowerCase();
      const uName = (p?.username ?? "").toLowerCase();
      return dName.includes(q) || uName.includes(q);
    });
  }, [pendingMembers, profileMap, memberSearchQuery]);

  const filteredDebts = useMemo(() => {
    const q = settlementSearchQuery.trim().toLowerCase().replace(/^@/, "");
    if (!q) return visibleDebts;
    return visibleDebts.filter((d) => {
      const counterpartyId = d.to === userId ? d.from : d.to;
      const p = profileMap.get(counterpartyId);
      const dName = (p?.full_name ?? "").toLowerCase();
      const uName = (p?.username ?? "").toLowerCase();
      return dName.includes(q) || uName.includes(q);
    });
  }, [visibleDebts, profileMap, settlementSearchQuery, userId]);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          to="/app"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Groups
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold">{group.name}</h1>
            {group.description ? (
              <p className="text-sm text-muted-foreground">{group.description}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            {isMember && !isCreator ? (
              <LeaveGroupButton
                groupName={group.name}
                busy={leaveMutation.isPending}
                onLeave={() => leaveMutation.mutate()}
              />
            ) : null}
            {isCreator ? (
              <DeleteGroupButton
                groupName={group.name}
                busy={deleteMutation.isPending}
                onDelete={() => deleteMutation.mutate()}
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Top Row: Floating Dropdowns for Members & Pending Settlements ── */}
      <div className="grid grid-cols-2 gap-3 w-full relative">
        {/* Members Dropdown */}
        <Popover
          open={activeDropdown === "members"}
          onOpenChange={(open) => {
            setActiveDropdown(open ? "members" : null);
            if (!open) setMemberSearchQuery("");
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between h-11 px-4 rounded-2xl border-border/80 bg-card hover:bg-secondary/40 text-foreground font-medium shadow-sm transition-all active:scale-[0.98]"
            >
              <span className="flex items-center gap-2 font-display text-sm font-semibold truncate">
                <Users className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">Members ({acceptedMembers.length + pendingMembers.length})</span>
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                  activeDropdown === "members" ? "rotate-180 text-primary" : ""
                }`}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            side="bottom"
            sideOffset={6}
            className="z-50 w-[92vw] sm:w-[360px] rounded-2xl border border-border/80 bg-popover/95 backdrop-blur-md p-0 text-popover-foreground shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 duration-180 ease-out origin-top overflow-hidden"
          >
            {/* Header & Sticky Search Bar */}
            <div className="p-3.5 border-b border-border/60 bg-popover/80 backdrop-blur-sm sticky top-0 z-10 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Members ({acceptedMembers.length + pendingMembers.length})
                </h3>
                <InviteDialog groupId={groupId} groupName={group.name} inviterId={userId} />
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search member..."
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  className="pl-8 pr-8 h-9 text-xs rounded-xl bg-secondary/50 border-border/60 focus-visible:ring-primary/40"
                />
                {memberSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setMemberSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[320px] overflow-y-auto p-2 space-y-1">
              {filteredAcceptedMembers.length === 0 && filteredPendingMembers.length === 0 ? (
                <div className="p-6 text-center space-y-1.5">
                  <div className="text-2xl">🔍</div>
                  <p className="text-sm font-semibold text-foreground">No members found</p>
                  <p className="text-xs text-muted-foreground">Try another name or username.</p>
                </div>
              ) : (
                <>
                  {filteredAcceptedMembers.map((member, index) => {
                    const profile = profileMap.get(member.user_id);
                    const displayName = nameOfDisplay(member.user_id);
                    const username = profile?.username?.trim() ?? "";
                    const initials = displayName.slice(0, 2).toUpperCase();
                    const isYou = member.user_id === userId;
                    const isOwner = member.user_id === group.created_by;
                    return (
                      <div key={member.id}>
                        {index > 0 && <div className="h-px bg-border/40 my-1" />}
                        <div className="flex items-center gap-3 py-2 px-2.5 rounded-xl hover:bg-secondary/40 transition-colors">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs uppercase">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {displayName} {isYou && <span className="text-xs text-muted-foreground font-normal">(You)</span>}
                            </p>
                            {username && (
                              <p className="text-xs text-muted-foreground truncate">
                                @{username}
                              </p>
                            )}
                          </div>
                          {isOwner && (
                            <span className="text-[11px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-md shrink-0">
                              Admin
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {filteredPendingMembers.map((member, index) => {
                    const profile = profileMap.get(member.user_id);
                    const displayName = nameOfDisplay(member.user_id);
                    const username = profile?.username?.trim() ?? "";
                    const initials = displayName.slice(0, 2).toUpperCase();
                    return (
                      <div key={member.id}>
                        {(filteredAcceptedMembers.length > 0 || index > 0) && <div className="h-px bg-border/40 my-1" />}
                        <div className="flex items-center gap-3 py-2 px-2.5 rounded-xl hover:bg-secondary/40 transition-colors opacity-75">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground font-bold text-xs uppercase">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {displayName}
                            </p>
                            {username && (
                              <p className="text-xs text-muted-foreground truncate">
                                @{username}
                              </p>
                            )}
                          </div>
                          <span className="text-[11px] font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Pending
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Pending Settlements Dropdown */}
        <Popover
          open={activeDropdown === "settlements"}
          onOpenChange={(open) => {
            setActiveDropdown(open ? "settlements" : null);
            if (!open) setSettlementSearchQuery("");
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between h-11 px-4 rounded-2xl border-border/80 bg-card hover:bg-secondary/40 text-foreground font-medium shadow-sm transition-all active:scale-[0.98]"
            >
              <span className="flex items-center gap-2 font-display text-sm font-semibold truncate">
                <HandCoins className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">Pending Settlements ({visibleDebts.length})</span>
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                  activeDropdown === "settlements" ? "rotate-180 text-primary" : ""
                }`}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            side="bottom"
            sideOffset={6}
            className="z-50 w-[92vw] sm:w-[360px] rounded-2xl border border-border/80 bg-popover/95 backdrop-blur-md p-0 text-popover-foreground shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 duration-180 ease-out origin-top overflow-hidden"
          >
            {/* Header & Sticky Search Bar */}
            <div className="p-3.5 border-b border-border/60 bg-popover/80 backdrop-blur-sm sticky top-0 z-10 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold flex items-center gap-2">
                  <HandCoins className="h-4 w-4 text-primary" />
                  Pending Settlements ({visibleDebts.length})
                </h3>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search member or username..."
                  value={settlementSearchQuery}
                  onChange={(e) => setSettlementSearchQuery(e.target.value)}
                  className="pl-8 pr-8 h-9 text-xs rounded-xl bg-secondary/50 border-border/60 focus-visible:ring-primary/40"
                />
                {settlementSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setSettlementSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[320px] overflow-y-auto p-2 space-y-1">
              {visibleDebts.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  Everyone's settled up!
                </p>
              ) : filteredDebts.length === 0 ? (
                <div className="p-6 text-center space-y-1.5">
                  <div className="text-2xl">🔍</div>
                  <p className="text-sm font-semibold text-foreground">No members found</p>
                  <p className="text-xs text-muted-foreground">Try another name or username.</p>
                </div>
              ) : (
                filteredDebts.map((debt, index) => {
                  const isOwed = debt.to === userId;
                  const counterpartyId = isOwed ? debt.from : debt.to;
                  const counterpartyName = nameOfDisplay(counterpartyId);
                  const counterpartyUsername = profileMap.get(counterpartyId)?.username ?? null;
                  const counterpartyInitials = counterpartyName.slice(0, 2).toUpperCase();
                  const payeeUpiId = profileMap.get(debt.to)?.upi_id ?? null;

                  return (
                    <div key={`${debt.from}-${debt.to}`}>
                      {index > 0 && <div className="h-px bg-border/40 my-1" />}
                      <PendingSettlementDropdownRow
                        debt={debt}
                        userId={userId}
                        counterpartyName={counterpartyName}
                        counterpartyUsername={counterpartyUsername}
                        counterpartyInitials={counterpartyInitials}
                        groupName={group.name}
                        payeeUpiId={payeeUpiId}
                        groupId={groupId}
                        counterpartyId={counterpartyId}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-muted-foreground">Expenses</h2>
          <Suspense fallback={<Button size="sm" disabled>Loading...</Button>}>
            <AddExpenseDialog
              groupId={groupId}
              userId={userId}
              members={acceptedMembers.map((member) => ({
                id: member.user_id,
                name: nameOf(member.user_id),
              }))}
              trigger={<Button size="sm">Add expense</Button>}
            />
          </Suspense>
        </div>
        <DateRangeFilter
          preset={datePreset}
          customFrom={customFrom}
          customTo={customTo}
          fromDate={fromDate}
          toDate={toDate}
          onPresetChange={(p) => {
            setDatePreset(p);
            setVisibleExpenseCount(5);
          }}
          onCustomFromChange={(v) => {
            setCustomFrom(v);
            setVisibleExpenseCount(5);
          }}
          onCustomToChange={(v) => {
            setCustomTo(v);
            setVisibleExpenseCount(5);
          }}
        />
        {filteredExpenses.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/50 p-4 text-center text-sm text-muted-foreground">
            {expenses.length === 0
              ? "No expenses yet. Add the first one!"
              : "No expenses found for this date range."}
          </p>
        ) : (
          <div className="space-y-2">
            {visibleExpenses.map((expense) => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                currentUserId={userId}
                creatorDisplayName={nameOfDisplay(expense.created_by)}
                canRemove={canDeleteExpense(expense, userId)}
                removeBusy={removeExpenseMutation.isPending}
                onRemove={() => removeExpenseMutation.mutate(expense.id)}
              />
            ))}
            {hasMoreExpenses ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setVisibleExpenseCount((count) => count + 5)}
              >
                Load more
              </Button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DateRangeFilter — modern preset-based date filter
// ─────────────────────────────────────────────────────────────────────────────
type DatePreset = "all" | "today" | "yesterday" | "last7" | "thisMonth" | "custom";

const PRESET_LABELS: Record<DatePreset, string> = {
  all: "All time",
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 days",
  thisMonth: "This month",
  custom: "Custom range",
};

const PRESETS: DatePreset[] = ["all", "today", "yesterday", "last7", "thisMonth", "custom"];

function formatDisplayDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function DateRangeFilter({
  preset,
  customFrom,
  customTo,
  fromDate,
  toDate,
  onPresetChange,
  onCustomFromChange,
  onCustomToChange,
}: {
  preset: DatePreset;
  customFrom: string;
  customTo: string;
  fromDate: string;
  toDate: string;
  onPresetChange: (p: DatePreset) => void;
  onCustomFromChange: (v: string) => void;
  onCustomToChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const hasActiveFilter = preset !== "all";
  const rangeLabel =
    fromDate && toDate && fromDate === toDate
      ? formatDisplayDate(fromDate)
      : fromDate && toDate
        ? `${formatDisplayDate(fromDate)} – ${formatDisplayDate(toDate)}`
        : fromDate
          ? `From ${formatDisplayDate(fromDate)}`
          : toDate
            ? `Until ${formatDisplayDate(toDate)}`
            : null;
  return (
    <div className="space-y-3">
      {/* Pills container */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap mr-1 flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          Date range
        </span>
        {PRESETS.map((p) => {
          const isActive = preset === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPresetChange(p)}
              className={[
                "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors border",
                isActive
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-foreground hover:bg-secondary/60",
              ].join(" ")}
            >
              {PRESET_LABELS[p]}
            </button>
          );
        })}
      </div>

      {/* Custom range inputs */}
      {preset === "custom" && (
        <div className="grid grid-cols-2 gap-3 p-3 rounded-xl border border-border bg-card">
          <div className="space-y-1.5">
            <label htmlFor="custom-from-date" className="text-xs font-medium text-muted-foreground">From</label>
            <Input
              id="custom-from-date"
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => onCustomFromChange(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="custom-to-date" className="text-xs font-medium text-muted-foreground">To</label>
            <Input
              id="custom-to-date"
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => onCustomToChange(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>
      )}

      {/* Active range label */}
      {hasActiveFilter && rangeLabel && (
        <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            <span className="font-medium">{rangeLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => onPresetChange("all")}
            className="flex items-center gap-1 text-xs font-semibold hover:text-primary/80"
          >
            Clear <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

const PendingSettlementDropdownRow = memo(function PendingSettlementDropdownRow({
  debt,
  userId,
  counterpartyName,
  counterpartyUsername,
  counterpartyInitials,
  groupName,
  payeeUpiId,
  groupId,
  counterpartyId,
}: {
  debt: PairwiseDebt;
  userId: string;
  counterpartyName: string;
  counterpartyUsername?: string | null;
  counterpartyInitials: string;
  groupName: string;
  payeeUpiId: string | null;
  groupId: string;
  counterpartyId: string;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const isYouOwe = debt.from === userId;

  return (
    <>
      <div
        onClick={() => setSheetOpen(true)}
        className="flex items-center gap-3 py-2 px-2.5 rounded-xl hover:bg-secondary/50 transition-colors cursor-pointer group select-none"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary text-xs font-bold uppercase group-hover:scale-105 transition-transform">
          {counterpartyInitials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center min-w-0 gap-1.5">
            <span className="text-sm font-semibold text-foreground shrink-0 group-hover:text-primary transition-colors">
              {counterpartyName}
            </span>
            <span className="text-xs text-muted-foreground truncate max-w-[90px] sm:max-w-[120px]">
              ({groupName})
            </span>
          </div>
          {counterpartyUsername ? (
            <p className="text-xs text-muted-foreground truncate">
              @{counterpartyUsername}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {isYouOwe ? "You owe" : "Owes you"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-sm font-display font-bold ${isYouOwe ? "text-destructive" : "text-primary"}`}>
            ₹{debt.amount.toFixed(2)}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
      </div>

      <ExpenseBreakdownSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        currentUserId={userId}
        counterpartyId={counterpartyId}
        displayName={counterpartyName}
        groupName={groupName}
        balanceAmount={debt.amount}
      />
    </>
  );
});

const DebtRow = memo(function DebtRow({
  debt,
  userId,
  nameOf,
  payeeUpiId,
  groupId,
}: {
  debt: PairwiseDebt;
  userId: string;
  nameOf: (id: string) => string;
  payeeUpiId: string | null;
  groupId: string;
}) {
  const debtText =
    debt.from === userId
      ? `You owe ${nameOf(debt.to)}`
      : debt.to === userId
        ? `${nameOf(debt.from)} owes you`
        : `${nameOf(debt.from)} owes ${nameOf(debt.to)}`;

  const amountColor =
    debt.from === userId
      ? "text-red-500"
      : debt.to === userId
        ? "text-primary"
        : "text-muted-foreground";

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">{debtText}</span>
        <span className={`ml-1 font-display font-bold ${amountColor}`}>
          <CountUpCurrency amount={debt.amount} />
        </span>
      </div>
      {debt.from === userId ? (
        <div className="flex gap-2">
          <QrPayDialog
            payeeName={nameOf(debt.to)}
            payeeUpiId={payeeUpiId}
            amount={debt.amount}
            note={`Splity settlement`}
          />
          <PaidDialog
            payeeName={nameOf(debt.to)}
            amount={debt.amount}
            groupId={groupId}
            payeeId={debt.to}
            payerId={userId}
          />
        </div>
      ) : null}
    </div>
  );
});

function formatCardDate(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  const day = d.getDate();
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;

  return `${day} ${month} ${year} • ${hours}:${minutes} ${ampm}`;
}

const ExpenseRow = memo(function ExpenseRow({
  expense,
  currentUserId,
  creatorDisplayName,
  canRemove,
  removeBusy,
  onRemove,
}: {
  expense: Expense;
  currentUserId: string;
  creatorDisplayName: string;
  canRemove: boolean;
  removeBusy: boolean;
  onRemove: () => void;
}) {
  const canShowRemove = expense.created_by === currentUserId && canRemove;
  const descLower = expense.description.toLowerCase();
  const isSettlement = descLower.includes("settlement") || descLower.includes("paid");

  let title = expense.description;
  let secondLine = "";
  let paymentMethod = "";

  if (isSettlement) {
    const isUpi = descLower.includes("upi") || descLower.includes("online");
    title = isUpi ? "UPI Settlement" : "Cash Settlement";
    paymentMethod = isUpi ? "UPI" : "Cash";

    if (expense.created_by === currentUserId) {
      secondLine = "Settled by You";
    } else {
      secondLine = `Settled with ${creatorDisplayName}`;
    }
  } else {
    if (expense.created_by === currentUserId) {
      secondLine = "Added by You";
    } else {
      secondLine = `Added by ${creatorDisplayName}`;
    }
  }

  const thirdLine = formatCardDate(expense.created_at);

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
        <Receipt className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{secondLine}</p>
        <p className="text-xs text-muted-foreground">{thirdLine}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <p className="font-display font-bold">
            <CountUpCurrency amount={Number(expense.amount)} />
          </p>
          {isSettlement ? (
            <p className="text-xs text-muted-foreground">{paymentMethod}</p>
          ) : null}
        </div>
        {canShowRemove ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" disabled={removeBusy} aria-label="Remove expense">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove this expense?</AlertDialogTitle>
                <AlertDialogDescription>
                  You can remove an expense only within 5 hours of adding it.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onRemove} disabled={removeBusy}>
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    </div>
  );
});

function LeaveGroupButton({
  groupName,
  busy,
  onLeave,
}: {
  groupName: string;
  busy: boolean;
  onLeave: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <LogOut className="mr-1.5 h-4 w-4" /> Leave
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave this group?</AlertDialogTitle>
          <AlertDialogDescription>
            You won't see expenses or balances for "{groupName}" anymore. You can be re-invited
            later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onLeave} disabled={busy}>
            Leave
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteGroupButton({
  groupName,
  busy,
  onDelete,
}: {
  groupName: string;
  busy: boolean;
  onDelete: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="mr-1.5 h-4 w-4" /> Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{groupName}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the group, all expenses, and member data. This cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onDelete}
            disabled={busy}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function InviteDialog({
  groupId,
  groupName,
  inviterId,
}: {
  groupId: string;
  groupName: string;
  inviterId: string;
}) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const user = await findUserByUsername(username.trim().toLowerCase());
      if (!user) throw new Error("No user found with that username.");
      if (user.id === inviterId) throw new Error("You're already in this group.");
      await inviteToGroup({
        groupId,
        groupName,
        targetUserId: user.id,
        inviterId,
      });
    },
    onSuccess: () => {
      toast.success("Invite sent!");
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
      setOpen(false);
      setUsername("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus className="mr-1 h-4 w-4" /> Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite by username</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!username.trim()) return;
            mutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Username</Label>
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="friend_username"
              autoCapitalize="none"
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
