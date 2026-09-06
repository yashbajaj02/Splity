import { getCleanErrorMessage, cn } from "@/lib/utils";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useRef, memo, lazy, Suspense } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCachedQuery } from "@/hooks/use-cached-query";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Clock,
  HandCoins,
  Loader2,
  LogOut,
  Pencil,
  Receipt,
  Search,
  Trash2,
  UserPlus,
  Users,
  ChevronDown,
  ChevronRight,
  X,
  Plus,
  Camera,
  MessageSquare,
  Utensils,
  Zap,
  ShoppingBag,
  Car,
  Film,
  Package,
  ArrowLeftRight,
  Settings,
  Check,
  ImagePlus,
} from "lucide-react";
import { motion } from "framer-motion";
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
  getSplitsForGroup,
  inviteToGroup,
  leaveGroup,
  updateGroupAvatar,
  updateGroupName,
  uploadToCloudinary,
  getFriendsNotInGroup,
  getFriends,
  sendFriendRequest,
  searchUsersByName,
} from "@/lib/api";
import { parseExpenseDescription } from "@/lib/api";
import { CategoryIcon } from "@/components/CategoryIcon";
import type { Expense, ExpenseSplit, PairwiseDebt, Profile, Group, GroupMember, Friend, UserSearchResult } from "@/lib/app-types";
import { computePairwiseDebts } from "@/lib/debt";
import { getInitials } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { AddExpenseDialog } from "@/components/AddExpenseDialog";
import { CountUpCurrency } from "@/components/CountUpCurrency";
import { QrPayDialog } from "@/components/QrPayDialog";
import { PaidDialog } from "@/components/PaidDialog";
import { ExpenseBreakdownSheet } from "@/components/ExpenseBreakdownSheet";
import { ExpenseDetailsSheet } from "@/components/ExpenseDetailsSheet";
import { GroupChatPage } from "@/components/GroupChatPage";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

export type DatePreset = "all" | "today" | "yesterday" | "last7" | "thisMonth" | "custom";

export const PRESETS: { id: DatePreset; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7 days" },
  { id: "custom", label: "Custom →" },
];

export const Route = createFileRoute("/app/group/$groupId")({
  component: GroupDetail,
});

function GroupDetail() {
  const { groupId } = Route.useParams();
  const { session } = useAuth();
  const userId = session?.user?.id ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [visibleExpenseCount, setVisibleExpenseCount] = useState(6);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settlePopoverOpen, setSettlePopoverOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"expenses" | "activity" | "chat">("expenses");
  
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [memberBalancesOpen, setMemberBalancesOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [membersListOpen, setMembersListOpen] = useState(false);
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [rangePopoverOpen, setRangePopoverOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);

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
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const yStr = fmt(y);
      return { fromDate: yStr, toDate: yStr };
    }
    if (datePreset === "last7") {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
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

  // Group header — cache-first so group name/avatar render on warm loads
  const groupQuery = useCachedQuery(`group:${groupId}`, {
    queryKey: ["group", groupId] as const,
    queryFn: () => getGroup(groupId),
  });
  const membersQuery = useCachedQuery(`group-members:${groupId}`, {
    queryKey: ["group-members", groupId] as const,
    queryFn: () => getGroupMembers(groupId),
  });

  const friendsQuery = useQuery({
    queryKey: ["my-friends", userId],
    queryFn: () => getFriends(userId),
    enabled: !!userId,
  });

  const [requestedUserIds, setRequestedUserIds] = useState<Set<string>>(new Set());

  const addFriendMutation = useMutation({
    mutationFn: (friendId: string) => sendFriendRequest(userId, friendId),
    onSuccess: (_, friendId) => {
      toast.success("Friend request sent");
      setRequestedUserIds((prev) => {
        const next = new Set(prev);
        next.add(friendId);
        return next;
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to send friend request");
    },
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingAvatar(true);
      const url = await uploadToCloudinary(file, "splity/groups");
      await updateGroupAvatar(groupId, url);
      toast.success("Group avatar updated");
      queryClient.invalidateQueries({ queryKey: ["group", groupId] });
      queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
    } catch (err: any) {
      toast.error(err.message || "Avatar upload failed");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setIsUploadingAvatar(true);
    setAvatarMenuOpen(false);
    try {
      await updateGroupAvatar(groupId, null);
      toast.success("Group avatar removed");
      queryClient.invalidateQueries({ queryKey: ["group", groupId] });
      queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to remove group avatar");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleUpdateGroupName = async () => {
    const trimmed = newGroupName.trim();
    if (!trimmed || trimmed === group?.name) return;
    setIsUpdatingName(true);
    try {
      await updateGroupName(groupId, trimmed);
      await queryClient.invalidateQueries({ queryKey: ["group", groupId] });
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
      await queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
      toast.success("Group name updated! 🎉");
      setEditNameOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update group name");
    } finally {
      setIsUpdatingName(false);
    }
  };
  const expensesQuery = useCachedQuery(`expenses:${groupId}`, {
    queryKey: ["group-expenses", groupId] as const,
    queryFn: () => getGroupExpenses(groupId),
  });

  const memberIds = (membersQuery.data ?? []).map((member) => member.user_id);
  const profilesQuery = useQuery({
    queryKey: ["profiles", memberIds.sort().join(",")],
    queryFn: () => getProfilesByIds(memberIds),
    enabled: memberIds.length > 0,
  });

  const profileMap = useMemo(
    () =>
      new Map<string, Profile>((profilesQuery.data ?? []).map((profile) => [profile.id, profile])),
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
      if (profile.full_name && profile.username)
        return `${profile.full_name} (@${profile.username})`;
      if (profile.full_name) return profile.full_name;
      if (profile.username) return `@${profile.username}`;
    }
    return "user";
  };

  const splitsQuery = useCachedQuery(`splits:${groupId}`, {
    queryKey: ["group-splits", groupId] as const,
    queryFn: () => getSplitsForGroup(groupId),
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
    onError: (error: Error) => toast.error(getCleanErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteGroup(groupId),
    onSuccess: () => {
      toast.success("Group deleted");
      queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
      navigate({ to: "/app" });
    },
    onError: (error: Error) => toast.error(getCleanErrorMessage(error)),
  });

  const removeExpenseMutation = useMutation({
    mutationFn: (expenseId: string) => deleteExpense(expenseId, userId),
    onSuccess: () => {
      toast.success("Expense removed");
      queryClient.invalidateQueries({ queryKey: ["group-expenses", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-splits", groupId] });
      queryClient.invalidateQueries({ queryKey: ["settle", userId] });
    },
    onError: (error: Error) => toast.error(getCleanErrorMessage(error)),
  });

  const group = groupQuery.data ?? null;
  const members = membersQuery.data ?? [];
  const acceptedMembers = members.filter((member) => member.status === "accepted");
  const pendingMembers = members.filter((member) => member.status === "pending");
  const expenses = expensesQuery.data ?? [];

  const filteredExpenses = expenses.filter((expense) => {
    const { cleanDescription } = parseExpenseDescription(expense.description);
    const descLower = cleanDescription.toLowerCase();
    const isSettlement = descLower.includes("settlement") || descLower.includes("paid");
    if (isSettlement) return false;

    const expenseDate = expense.created_at.slice(0, 10);
    if (fromDate && expenseDate < fromDate) return false;
    if (toDate && expenseDate > toDate) return false;
    return true;
  });

  const visibleExpenses = filteredExpenses.slice(0, visibleExpenseCount);
  const hasMoreExpenses = filteredExpenses.length > visibleExpenseCount;

  const groupedExpenses = useMemo(() => {
    const today: typeof visibleExpenses = [];
    const yesterday: typeof visibleExpenses = [];
    const earlier: typeof visibleExpenses = [];

    const now = new Date();
    // Use local date strings for comparison to avoid timezone issues
    const pad = (n: number) => n.toString().padStart(2, "0");
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    
    const yDate = new Date(now);
    yDate.setDate(yDate.getDate() - 1);
    const yesterdayStr = `${yDate.getFullYear()}-${pad(yDate.getMonth() + 1)}-${pad(yDate.getDate())}`;

    for (const item of visibleExpenses) {
      // item.created_at is UTC, convert to local date for comparison
      const itemDate = new Date(item.created_at);
      const itemDateStr = `${itemDate.getFullYear()}-${pad(itemDate.getMonth() + 1)}-${pad(itemDate.getDate())}`;
      
      if (itemDateStr === todayStr) {
        today.push(item);
      } else if (itemDateStr === yesterdayStr) {
        yesterday.push(item);
      } else {
        earlier.push(item);
      }
    }
    return { today, yesterday, earlier };
  }, [visibleExpenses]);

  const splitsByExpense: Record<string, ExpenseSplit[]> = {};
  for (const split of splitsQuery.data ?? []) {
    (splitsByExpense[split.expense_id] ??= []).push(split);
  }

  const pairwiseDebts = computePairwiseDebts(expenses, splitsByExpense);
  const visibleDebts = pairwiseDebts.filter((debt) => debt.from === userId || debt.to === userId);
  const isCreator = group ? group.created_by === userId : false;
  const isMember = acceptedMembers.some((member) => member.user_id === userId);

  const groupTotalOwe = useMemo(() => {
    return visibleDebts
      .filter((d) => d.from === userId)
      .reduce((sum, d) => sum + d.amount, 0);
  }, [visibleDebts, userId]);

  const groupTotalOwed = useMemo(() => {
    return visibleDebts
      .filter((d) => d.to === userId)
      .reduce((sum, d) => sum + d.amount, 0);
  }, [visibleDebts, userId]);

  // Show spinner only on genuine first-ever cold load (no IDB cache available).
  // When useCachedQuery provides placeholder data, isLoading=false and
  // isPlaceholderData=true, so we fall through to render the cached group.
  if (groupQuery.isLoading && !groupQuery.isPlaceholderData) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (groupQuery.isError || !group) {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-sm font-medium text-foreground">Could not load this group.</p>
        <p className="text-sm text-muted-foreground">
          {groupQuery.error ? (groupQuery.error as Error).message : "Group not found."}
        </p>
        <Button variant="outline" size="sm" onClick={() => groupQuery.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-16">
      {/* ── 1. Header (Back arrow, Group avatar centered, Name, Count, 3-dot Menu) ── */}
      <div className="relative flex flex-col items-center text-center pt-2">
        {/* Top-left: Back button */}
        <Link
          to="/app"
          className="absolute left-0 top-2 w-9 h-9 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 active:scale-90 transition-all z-10"
          aria-label="Back to groups"
        >
          <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
        </Link>

        {/* Top-right: Three-dot More menu */}
        <div className="absolute right-0 top-2 z-10">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 active:scale-90 transition-all"
                aria-label="More options"
              >
                <span className="font-bold text-xl leading-none tracking-wider select-none">···</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-1.5 rounded-2xl border-slate-100 shadow-xl bg-white">
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors text-left"
                >
                  <UserPlus className="w-4 h-4 text-emerald-600" />
                  <span>Invite Members</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSettingsModalOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors text-left"
                >
                  <Settings className="w-4 h-4 text-slate-500" />
                  <span>Group Settings</span>
                </button>

                {isMember && !isCreator && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Leave Group</span>
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Leave "{group.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          You will no longer see expenses or debts in this group.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => leaveMutation.mutate()}
                          disabled={leaveMutation.isPending}
                        >
                          Leave Group
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {isCreator && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete Group</span>
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete "{group.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This permanently deletes the group, all expenses, and splits. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => deleteMutation.mutate()}
                          disabled={deleteMutation.isPending}
                        >
                          Delete Group
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Large Centered Avatar */}
        {(() => {
          const avatarNode = (
            <div 
              className={cn("relative group", isCreator && "cursor-pointer")}
              onClick={() => {
                if (isCreator && !isUploadingAvatar && !group.avatar_url) {
                  fileInputRef.current?.click();
                }
              }}
            >
              <Avatar className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-lg ring-4 ring-emerald-50 animate-hero-avatar">
                <AvatarImage src={group.avatar_url || undefined} alt={group.name} className="object-cover" />
                <AvatarFallback className="bg-transparent font-display font-bold text-2xl text-white">
                  {group.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              {isCreator && (
                <>
                  {isUploadingAvatar ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-3xl backdrop-blur-[1px]">
                      <Loader2 className="w-6 h-6 animate-spin text-white" />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="w-6 h-6 text-white stroke-[2]" />
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleAvatarUpload}
                  />
                </>
              )}
            </div>
          );

          if (isCreator && group.avatar_url) {
            return (
              <Popover open={avatarMenuOpen} onOpenChange={setAvatarMenuOpen}>
                <PopoverTrigger asChild>
                  {avatarNode}
                </PopoverTrigger>
                <PopoverContent side="bottom" align="center" className="w-40 p-1.5 rounded-2xl border-slate-100 shadow-xl bg-white z-50">
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarMenuOpen(false);
                        fileInputRef.current?.click();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors text-left"
                    >
                      <ImagePlus className="w-4 h-4 text-emerald-600" />
                      <span>Change Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Remove Photo</span>
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            );
          }
          return avatarNode;
        })()}

        {/* Group Name with Pencil Edit Button */}
        <div className="flex items-center justify-center gap-1.5 mt-2.5 max-w-full px-6">
          <h1 className="font-display font-bold text-xl text-slate-900 tracking-tight truncate">
            {group.name}
          </h1>
          <button
            type="button"
            onClick={() => {
              setNewGroupName(group.name);
              setEditNameOpen(true);
            }}
            className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-emerald-700 transition-colors shrink-0 active:scale-95"
            title="Edit group name"
            aria-label="Edit group name"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Member Count Button — Opens Member List */}
        <button
          type="button"
          onClick={() => setMembersListOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1 mt-1 rounded-full bg-slate-100/90 hover:bg-slate-200/80 text-slate-600 text-xs font-semibold transition-all active:scale-95 group/btn shadow-2xs border border-slate-200/50"
        >
          <Users className="w-3.5 h-3.5 text-slate-500 group-hover/btn:text-emerald-600 transition-colors" />
          <span>{acceptedMembers.length + pendingMembers.length} members</span>
          <ChevronRight className="w-3 h-3 text-slate-400 group-hover/btn:text-slate-600 transition-colors" />
        </button>
      </div>

      {/* ── 2. Action Buttons (Horizontal Row: Add Expense, Settle Up, Chat) ── */}
      <div className="grid grid-cols-3 gap-2.5 pt-1">
        {/* Add Expense (Green, prominent) */}
        <button
          type="button"
          onClick={() => setAddExpenseOpen(true)}
          className="h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all duration-150 active:scale-[0.98] hover:scale-[1.02] hover:shadow-[var(--shadow-glow-green)] select-none"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Add Expense</span>
        </button>

        {/* Settle Up (Specific to this group) */}
        <Popover open={settlePopoverOpen} onOpenChange={setSettlePopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="h-11 rounded-2xl bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all duration-150 active:scale-[0.98] hover:scale-[1.02] hover:shadow-sm select-none"
            >
              <HandCoins className="w-4 h-4 text-emerald-600 stroke-[2.2]" />
              <span>Settle Up</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-[320px] p-3 rounded-2xl border-slate-100 shadow-xl bg-white">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-display font-bold text-xs text-slate-400 uppercase tracking-wider">
                  Group Settlements ({visibleDebts.length})
                </p>
              </div>
              {visibleDebts.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-3 font-medium">All settled up in this group!</p>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {visibleDebts.map((d) => (
                    <PendingSettlementDropdownRow
                      key={`${d.from}-${d.to}`}
                      debt={d}
                      userId={userId}
                      counterpartyName={nameOfDisplay(d.to === userId ? d.from : d.to)}
                      counterpartyUsername={profileMap.get(d.to === userId ? d.from : d.to)?.username ?? null}
                      counterpartyInitials={nameOfDisplay(d.to === userId ? d.from : d.to).slice(0, 2).toUpperCase()}
                      counterpartyAvatarUrl={profileMap.get(d.to === userId ? d.from : d.to)?.avatar_url || null}
                      groupName={group.name}
                      payeeUpiId={profileMap.get(d.to)?.upi_id ?? null}
                      groupId={groupId}
                      counterpartyId={d.to === userId ? d.from : d.to}
                    />
                  ))}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Chat (New Feature) */}
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          className="h-11 rounded-2xl bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all duration-150 active:scale-[0.98] hover:scale-[1.02] hover:shadow-sm select-none"
        >
          <MessageSquare className="w-4 h-4 text-emerald-600 stroke-[2.2]" />
          <span>Chat</span>
        </button>
      </div>

      {/* ── 3. Balance Summary Card (3D Tilt, Wave, Split Bar, Toggle Breakdown) ── */}
      <GroupBalanceCard
        totalOwe={groupTotalOwe}
        totalOwed={groupTotalOwed}
        debts={visibleDebts}
        userId={userId}
        profileMap={profileMap}
        nameOfDisplay={nameOfDisplay}
        onOpenBalances={() => setMemberBalancesOpen(true)}
      />

      {/* ── 4. Expenses Section ── */}
      <section className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-base font-bold text-slate-900">Expenses</h2>
            {datePreset !== "all" && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                {PRESETS.find((p) => p.id === datePreset)?.label || "Filtered"}
              </span>
            )}
          </div>

          {/* Range Button opposite to Expenses */}
          <Popover open={rangePopoverOpen} onOpenChange={setRangePopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "h-8 px-3 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all border shadow-2xs select-none active:scale-95",
                  datePreset !== "all"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-bold"
                    : "bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {datePreset === "all"
                    ? "Range"
                    : PRESETS.find((p) => p.id === datePreset)?.label || "Range"}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[280px] p-2.5 rounded-2xl border-slate-100 shadow-xl bg-white space-y-2"
            >
              <div className="flex items-center justify-between px-1 pb-1 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Select Range
                </span>
                {datePreset !== "all" && (
                  <button
                    type="button"
                    onClick={() => {
                      setDatePreset("all");
                      setVisibleExpenseCount(6);
                      setRangePopoverOpen(false);
                    }}
                    className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700"
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className="space-y-1">
                {PRESETS.map((p) => {
                  const isSelected = datePreset === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setDatePreset(p.id);
                        setVisibleExpenseCount(6);
                        if (p.id !== "custom") {
                          setRangePopoverOpen(false);
                        }
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors text-left",
                        isSelected
                          ? "bg-emerald-50 text-emerald-800 font-bold"
                          : "text-slate-700 hover:bg-slate-50",
                      )}
                    >
                      <span>{p.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-emerald-600" />}
                    </button>
                  );
                })}
              </div>

              {/* Custom Date Range Pickers */}
              {datePreset === "custom" && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">From</label>
                      <input
                        type="date"
                        value={customFrom}
                        onChange={(e) => {
                          setCustomFrom(e.target.value);
                          setVisibleExpenseCount(6);
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 outline-none mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">To</label>
                      <input
                        type="date"
                        value={customTo}
                        onChange={(e) => {
                          setCustomTo(e.target.value);
                          setVisibleExpenseCount(6);
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 outline-none mt-1"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                    onClick={() => setRangePopoverOpen(false)}
                  >
                    Apply Range
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Expense List */}
        {filteredExpenses.length === 0 ? (
          <div className="rounded-2xl bg-white border border-slate-100 p-8 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No expenses in this period
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {expenses.length === 0
                ? "Tap Add Expense to get started"
                : "Try adjusting your filters"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedExpenses.today.length > 0 && (
              <div className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 uppercase tracking-widest px-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-badge-pulse" />
                  TODAY
                </h3>
                <div className="space-y-2">
                  {groupedExpenses.today.map((expense, index) => (
                    <motion.div
                      key={expense.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.25,
                        delay: Math.min(index * 0.05, 0.35),
                        ease: [0.25, 1, 0.5, 1],
                      }}
                    >
                      <ExpenseRow
                        expense={expense}
                        currentUserId={userId}
                        creatorDisplayName={nameOfDisplay(expense.created_by)}
                        canRemove={canDeleteExpense(expense, userId)}
                        removeBusy={removeExpenseMutation.isPending}
                        onRemove={() => removeExpenseMutation.mutate(expense.id)}
                        initialSplits={splitsByExpense[expense.id]}
                        acceptedMembers={acceptedMembers.map((member) => ({
                          id: member.user_id,
                          name: nameOf(member.user_id),
                        }))}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {groupedExpenses.yesterday.length > 0 && (
              <div className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  YESTERDAY
                </h3>
                <div className="space-y-2">
                  {groupedExpenses.yesterday.map((expense, index) => (
                    <motion.div
                      key={expense.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.25,
                        delay: Math.min(index * 0.05, 0.35),
                        ease: [0.25, 1, 0.5, 1],
                      }}
                    >
                      <ExpenseRow
                        expense={expense}
                        currentUserId={userId}
                        creatorDisplayName={nameOfDisplay(expense.created_by)}
                        canRemove={canDeleteExpense(expense, userId)}
                        removeBusy={removeExpenseMutation.isPending}
                        onRemove={() => removeExpenseMutation.mutate(expense.id)}
                        initialSplits={splitsByExpense[expense.id]}
                        acceptedMembers={acceptedMembers.map((member) => ({
                          id: member.user_id,
                          name: nameOf(member.user_id),
                        }))}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {groupedExpenses.earlier.length > 0 && (
              <div className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  EARLIER
                </h3>
                <div className="space-y-2">
                  {groupedExpenses.earlier.map((expense, index) => (
                    <motion.div
                      key={expense.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.25,
                        delay: Math.min(index * 0.05, 0.35),
                        ease: [0.25, 1, 0.5, 1],
                      }}
                    >
                      <ExpenseRow
                        expense={expense}
                        currentUserId={userId}
                        creatorDisplayName={nameOfDisplay(expense.created_by)}
                        canRemove={canDeleteExpense(expense, userId)}
                        removeBusy={removeExpenseMutation.isPending}
                        onRemove={() => removeExpenseMutation.mutate(expense.id)}
                        initialSplits={splitsByExpense[expense.id]}
                        acceptedMembers={acceptedMembers.map((member) => ({
                          id: member.user_id,
                          name: nameOf(member.user_id),
                        }))}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {hasMoreExpenses && (
              <button
                type="button"
                className="w-full py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.99] shadow-2xs mt-4"
                onClick={() => setVisibleExpenseCount((count) => count + 6)}
              >
                Load more expenses
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── Add Expense Dialog Controlled ── */}
      <Suspense fallback={null}>
        <AddExpenseDialog
          groupId={groupId}
          userId={userId}
          members={acceptedMembers.map((m) => ({
            id: m.user_id,
            name: nameOfDisplay(m.user_id),
            avatar_url: profileMap.get(m.user_id)?.avatar_url || null,
          }))}
          open={addExpenseOpen}
          onOpenChange={setAddExpenseOpen}
        />
      </Suspense>

      {/* ── Invite Member Dialog Controlled ── */}
      <InviteDialog
        groupId={groupId}
        groupName={group.name}
        inviterId={userId}
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
      />

      {/* ── Group Settings Dialog ── */}
      <GroupSettingsDialog
        group={group}
        members={acceptedMembers}
        pendingMembers={pendingMembers}
        profileMap={profileMap}
        currentUserId={userId}
        isCreator={isCreator}
        open={settingsModalOpen}
        onOpenChange={setSettingsModalOpen}
        onInviteClick={() => {
          setSettingsModalOpen(false);
          setInviteModalOpen(true);
        }}
        onLeave={() => leaveMutation.mutate()}
        leaveBusy={leaveMutation.isPending}
        onDelete={() => deleteMutation.mutate()}
        deleteBusy={deleteMutation.isPending}
      />

      {/* ── Member Balances Dialog ── */}
      <MemberBalancesDialog
        open={memberBalancesOpen}
        onOpenChange={setMemberBalancesOpen}
        debts={visibleDebts}
        userId={userId}
        profileMap={profileMap}
        nameOfDisplay={nameOfDisplay}
        groupName={group.name}
        groupId={groupId}
      />

      {/* ── Dedicated Group Chat Page ── */}
      {chatOpen && (
        <GroupChatPage
          group={group}
          currentUserId={userId}
          members={members}
          profileMap={profileMap}
          onClose={() => setChatOpen(false)}
        />
      )}

      {/* ── Edit Group Name Dialog ── */}
      <Dialog open={editNameOpen} onOpenChange={setEditNameOpen}>
        <DialogContent className="max-w-sm rounded-3xl p-6 border-slate-100 shadow-2xl bg-white space-y-4">
          <DialogHeader className="p-0">
            <DialogTitle className="font-display font-bold text-lg text-slate-900">
              Edit Group Name
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="group-name-input" className="text-xs font-semibold text-slate-500">
              Group Name
            </Label>
            <Input
              id="group-name-input"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Enter group name"
              className="h-11 rounded-xl border-slate-200 focus:border-emerald-600 font-medium"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && newGroupName.trim() && !isUpdatingName) {
                  handleUpdateGroupName();
                }
              }}
            />
          </div>
          <DialogFooter className="flex gap-2 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditNameOpen(false)}
              className="rounded-xl h-10 flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpdateGroupName}
              disabled={!newGroupName.trim() || newGroupName.trim() === group.name || isUpdatingName}
              className="rounded-xl h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex-1 sm:flex-none"
            >
              {isUpdatingName ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Group Members List Dialog ── */}
      <GroupMembersDialog
        group={group}
        members={acceptedMembers}
        pendingMembers={pendingMembers}
        profileMap={profileMap}
        currentUserId={userId}
        open={membersListOpen}
        onOpenChange={setMembersListOpen}
        onInviteClick={() => setInviteModalOpen(true)}
        myFriendsIds={new Set((friendsQuery.data ?? []).map(f => f.friend_id))}
        requestedUserIds={requestedUserIds}
        onAddFriend={(friendId) => addFriendMutation.mutate(friendId)}
        isAddingFriend={addFriendMutation.isPending ? (addFriendMutation.variables as string) : null}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GroupBalanceCard with 3D Tilt, Continuous Wave, Split Bar & Breakdown Toggle
// ─────────────────────────────────────────────────────────────────────────────
function GroupBalanceCard({
  totalOwe,
  totalOwed,
  debts,
  userId,
  profileMap,
  nameOfDisplay,
  onOpenBalances,
}: {
  totalOwe: number;
  totalOwed: number;
  debts: PairwiseDebt[];
  userId: string;
  profileMap: Map<string, Profile>;
  nameOfDisplay: (id: string) => string;
  onOpenBalances: () => void;
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0, active: false });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (typeof window !== "undefined" && window.matchMedia("(hover: none)").matches) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      x: -py * 10, // max +/- 5 deg
      y: px * 6,   // max +/- 3 deg
      active: true,
    });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0, active: false });
  };

  const net = totalOwe - totalOwed;
  const isNegative = net > 0.005;
  const isPositive = net < -0.005;

  let waveColor1 = "text-slate-300/40";
  let waveColor2 = "text-slate-400/30";
  let cardTheme =
    "bg-gradient-to-br from-slate-50 via-emerald-50/20 to-slate-100/50 border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.04)] hover:shadow-[0_12px_28px_rgba(15,23,42,0.1)]";

  if (isNegative) {
    cardTheme =
      "bg-gradient-to-br from-rose-50/90 via-pink-50/60 to-rose-100/40 border-rose-200/70 shadow-[0_2px_12px_rgba(244,63,94,0.06)] hover:shadow-[0_12px_28px_rgba(244,63,94,0.18)]";
    waveColor1 = "text-rose-400/40";
    waveColor2 = "text-pink-400/30";
  } else if (isPositive) {
    cardTheme =
      "bg-gradient-to-br from-emerald-50/90 via-teal-50/60 to-emerald-100/40 border-emerald-200/70 shadow-[0_2px_12px_rgba(16,185,129,0.06)] hover:shadow-[0_12px_28px_rgba(16,185,129,0.18)]";
    waveColor1 = "text-emerald-400/40";
    waveColor2 = "text-teal-400/30";
  }

  const totalSum = totalOwe + totalOwed;
  const oweRatio = totalSum > 0 ? (totalOwe / totalSum) * 100 : 50;

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: tilt.active
          ? `perspective(1000px) rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg)`
          : "perspective(1000px) rotateX(0deg) rotateY(0deg)",
        transition: tilt.active
          ? "transform 0.1s ease-out, box-shadow 0.25s ease-out"
          : "transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.45s ease-out",
        transformStyle: "preserve-3d",
      }}
      className={cn(
        "group relative w-full min-h-[148px] rounded-3xl border overflow-hidden select-none will-change-transform transition-all",
        cardTheme,
      )}
    >
      {/* Top Right Toggle Button */}
      <button
        type="button"
        onClick={() => setShowBreakdown((prev) => !prev)}
        className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-white/90 border border-slate-200/80 flex items-center justify-center text-slate-600 hover:bg-white active:scale-90 shadow-2xs transition-all"
        title={showBreakdown ? "Show summary" : "Show member breakdown"}
        aria-label="Toggle card view"
      >
        <ArrowLeftRight
          className={cn(
            "w-3.5 h-3.5 stroke-[2.2] transition-transform duration-300",
            showBreakdown && "rotate-180",
          )}
        />
      </button>

      {/* View 1: Main Summary & Red/Green Balance Bar */}
      <div
        className={cn(
          "p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 ease-out z-10 relative cursor-pointer",
          showBreakdown
            ? "-translate-x-full opacity-0 pointer-events-none absolute inset-0"
            : "translate-x-0 opacity-100",
        )}
        onClick={onOpenBalances}
      >
        <div>
          <div className="flex items-center justify-between pr-10">
            <span className="font-display font-bold text-xs text-slate-500 uppercase tracking-wider">
              Balance Summary
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <span className="text-xs font-bold text-rose-500">You owe</span>
              <p className="font-display font-bold text-xl text-rose-600 mt-0.5">
                ₹{totalOwe.toFixed(2)}
              </p>
            </div>
            <div className="text-right pr-6">
              <span className="text-xs font-bold text-emerald-600">Owed to you</span>
              <p className="font-display font-bold text-xl text-emerald-600 mt-0.5">
                ₹{totalOwed.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          {/* Red/Green Balance Bar */}
          <div className="h-2 w-full rounded-full bg-slate-200/60 flex overflow-hidden">
            <div
              style={{ width: `${totalSum > 0 ? oweRatio : 50}%` }}
              className="bg-rose-500 h-full transition-all duration-300"
            />
            <div
              style={{ width: `${totalSum > 0 ? 100 - oweRatio : 50}%` }}
              className="bg-emerald-500 h-full transition-all duration-300"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span>Tap card to view member balances</span>
            <span className="font-semibold text-emerald-700">View All →</span>
          </div>
        </div>
      </div>

      {/* View 2: Quick Member Breakdown View */}
      <div
        className={cn(
          "p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 ease-out z-10 relative cursor-pointer",
          showBreakdown
            ? "translate-x-0 opacity-100"
            : "translate-x-full opacity-0 pointer-events-none absolute inset-0",
        )}
        onClick={onOpenBalances}
      >
        <div>
          <div className="flex items-center justify-between pr-10">
            <span className="font-display font-bold text-xs text-slate-500 uppercase tracking-wider">
              Pairwise Breakdown
            </span>
          </div>

          <div className="mt-2 space-y-1 pr-8 max-h-[84px] overflow-y-auto">
            {debts.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium py-2">No pending balances in this group.</p>
            ) : (
              debts.slice(0, 3).map((d) => {
                const isOwe = d.from === userId;
                const otherId = isOwe ? d.to : d.from;
                return (
                  <div key={`${d.from}-${d.to}`} className="flex items-center justify-between text-xs py-0.5">
                    <span className="font-semibold text-slate-700 truncate max-w-[140px]">
                      {isOwe ? `To ${nameOfDisplay(otherId)}` : `From ${nameOfDisplay(otherId)}`}
                    </span>
                    <span className={cn("font-bold font-display", isOwe ? "text-rose-600" : "text-emerald-600")}>
                      {isOwe ? `-₹` : `+₹`}{d.amount.toFixed(2)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <p className="text-[11px] text-slate-400 font-medium mt-2">
          Tap card for full balances & settlement options
        </p>
      </div>

      {/* Subtle Continuously Moving Wave Background (10s loop) */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none overflow-hidden h-16 opacity-40 z-0">
        <div className="absolute bottom-0 left-0 w-full h-full flex overflow-hidden">
          <svg
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            className={cn("w-[200%] min-w-[200%] h-14 animate-wave-flow shrink-0", waveColor1)}
            fill="currentColor"
          >
            <path d="M0,60 C150,20 300,90 450,40 C525,15 570,35 600,60 C750,20 900,90 1050,40 C1125,15 1170,35 1200,60 L1200,120 L0,120 Z" />
          </svg>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-full flex overflow-hidden opacity-60">
          <svg
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            className={cn("w-[200%] min-w-[200%] h-12 animate-wave-flow-slow shrink-0", waveColor2)}
            fill="currentColor"
          >
            <path d="M0,45 C150,75 300,15 450,65 C525,90 570,70 600,45 C750,75 900,15 1050,65 C1125,90 1170,70 1200,45 L1200,120 L0,120 Z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ExpenseRow with Category Icons, Hover 3D Scale/Lift & Expense Details Modal
// ─────────────────────────────────────────────────────────────────────────────
const ExpenseRow = memo(function ExpenseRow({
  expense,
  currentUserId,
  creatorDisplayName,
  canRemove,
  removeBusy,
  onRemove,
  initialSplits,
  acceptedMembers,
}: {
  expense: Expense;
  currentUserId: string;
  creatorDisplayName: string;
  canRemove: boolean;
  removeBusy: boolean;
  onRemove: () => void;
  initialSplits?: ExpenseSplit[];
  acceptedMembers?: { id: string; name: string }[];
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const canShowActions = expense.created_by === currentUserId && canRemove;
  const { cleanDescription } = parseExpenseDescription(expense.description);
  const descLower = cleanDescription.toLowerCase();
  const isSettlement = descLower.includes("settlement") || descLower.includes("paid");

  const d = new Date(expense.created_at);
  const timeStr = !isNaN(d.getTime())
    ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    : "";

  const subtitle = `Paid by ${creatorDisplayName}${timeStr ? ` • ${timeStr}` : ""}`;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setDetailsOpen(true)}
        className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-slate-100 shadow-[var(--shadow-1)] card-hover-green cursor-pointer select-none"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <CategoryIcon description={cleanDescription} size="md" />
          <div className="min-w-0">
            <p className="font-display font-bold text-sm text-slate-900 truncate">{cleanDescription}</p>
            <p className="text-xs text-slate-400 font-medium truncate mt-0.5">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 pl-2">
          <div className="text-right">
            <p className="font-display font-bold text-sm sm:text-base text-slate-900">
              ₹{Number(expense.amount).toFixed(2)}
            </p>
          </div>

          {canShowActions && (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Suspense fallback={null}>
                <AddExpenseDialog
                  userId={currentUserId}
                  groupId={expense.group_id}
                  mode="edit"
                  initialExpense={expense}
                  initialSplits={initialSplits}
                  members={acceptedMembers}
                  trigger={
                    <button
                      type="button"
                      className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  }
                />
              </Suspense>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    disabled={removeBusy}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
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
            </div>
          )}
        </div>
      </div>

      <ExpenseDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        expense={expense}
        currentUserId={currentUserId}
        creatorDisplayName={creatorDisplayName}
        initialSplits={initialSplits}
      />
    </>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GroupMembersDialog — Dedicated modal showing all group members
// ─────────────────────────────────────────────────────────────────────────────
function GroupMembersDialog({
  group,
  members,
  pendingMembers,
  profileMap,
  currentUserId,
  open,
  onOpenChange,
  onInviteClick,
  myFriendsIds,
  requestedUserIds,
  onAddFriend,
  isAddingFriend,
}: {
  group: Group;
  members: GroupMember[];
  pendingMembers: GroupMember[];
  profileMap: Map<string, Profile>;
  currentUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInviteClick: () => void;
  myFriendsIds: Set<string>;
  requestedUserIds: Set<string>;
  onAddFriend: (userId: string) => void;
  isAddingFriend: string | null;
}) {
  const totalCount = members.length + pendingMembers.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden border-slate-100 shadow-2xl bg-white flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="font-display font-bold text-base text-slate-900 leading-tight">
                Group Members
              </DialogTitle>
              <p className="text-xs text-slate-400 font-medium">
                {totalCount} {totalCount === 1 ? "member" : "members"} in {group.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onInviteClick();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Invite</span>
          </button>
        </div>

        {/* Member List */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Active Members */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
              Active Members ({members.length})
            </span>
            <div className="space-y-1.5">
              {members.map((m) => {
                const p = profileMap.get(m.user_id);
                const isMe = m.user_id === currentUserId;
                const isAdmin = m.user_id === group.created_by;
                const dName = isMe
                  ? "You"
                  : p?.full_name?.trim() || p?.username?.trim() || "User";
                const avatarText = (p?.full_name || p?.username || "U").slice(0, 2).toUpperCase();

                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50/80 border border-slate-100 hover:bg-slate-100/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="w-10 h-10 rounded-2xl ring-2 ring-white shadow-2xs shrink-0">
                        <AvatarImage src={p?.avatar_url || undefined} alt={dName} />
                        <AvatarFallback className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white text-xs font-bold">
                          {avatarText}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-slate-800 truncate">{dName}</p>
                          {isMe && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded-md">
                              You
                            </span>
                          )}
                        </div>
                        {p?.username && (
                          <p className="text-[11px] text-slate-400 truncate">@{p.username}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isAdmin && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-lg shadow-2xs">
                          Admin
                        </span>
                      )}
                      {!isMe && !myFriendsIds.has(m.user_id) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddFriend(m.user_id);
                          }}
                          disabled={isAddingFriend === m.user_id || requestedUserIds.has(m.user_id)}
                          className={cn(
                            "text-[10px] font-bold px-2 py-1 rounded-lg shadow-2xs transition-colors flex items-center gap-1",
                            requestedUserIds.has(m.user_id)
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-emerald-600 hover:bg-emerald-700 text-white"
                          )}
                        >
                          {isAddingFriend === m.user_id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : requestedUserIds.has(m.user_id) ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <UserPlus className="w-3 h-3" />
                          )}
                          {requestedUserIds.has(m.user_id) ? "Pending" : "Add"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pending Invitations */}
          {pendingMembers.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider px-1 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                Pending Invites ({pendingMembers.length})
              </span>
              <div className="space-y-1.5">
                {pendingMembers.map((m) => {
                  const p = profileMap.get(m.user_id);
                  const dName = p?.full_name?.trim() || p?.username?.trim() || "Invited User";
                  const avatarText = dName.slice(0, 2).toUpperCase();

                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-amber-50/40 border border-amber-100/80"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="w-9 h-9 rounded-2xl opacity-80 shrink-0">
                          <AvatarImage src={p?.avatar_url || undefined} alt={dName} />
                          <AvatarFallback className="bg-amber-100 text-amber-800 text-xs font-bold">
                            {avatarText}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-700 truncate">{dName}</p>
                          {p?.username && (
                            <p className="text-[10px] text-slate-400 truncate">@{p.username}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100/70 border border-amber-200/60 px-2 py-0.5 rounded-lg">
                        Pending
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MemberBalancesDialog — Clickable popup showing all member balances
// ─────────────────────────────────────────────────────────────────────────────
function MemberBalancesDialog({
  open,
  onOpenChange,
  debts,
  userId,
  profileMap,
  nameOfDisplay,
  groupName,
  groupId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debts: PairwiseDebt[];
  userId: string;
  profileMap: Map<string, Profile>;
  nameOfDisplay: (id: string) => string;
  groupName: string;
  groupId: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden border-slate-100 shadow-2xl bg-white">
        <DialogHeader className="px-6 py-4 border-b border-slate-100 shrink-0">
          <DialogTitle className="font-display font-bold text-lg text-slate-900">
            Group Member Balances
          </DialogTitle>
          <p className="text-xs text-slate-400 font-medium">{groupName}</p>
        </DialogHeader>

        <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
          {debts.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 font-medium">
              Everyone is settled up in this group!
            </div>
          ) : (
            debts.map((d) => (
              <PendingSettlementDropdownRow
                key={`${d.from}-${d.to}`}
                debt={d}
                userId={userId}
                counterpartyName={nameOfDisplay(d.to === userId ? d.from : d.to)}
                counterpartyUsername={profileMap.get(d.to === userId ? d.from : d.to)?.username ?? null}
                counterpartyInitials={nameOfDisplay(d.to === userId ? d.from : d.to).slice(0, 2).toUpperCase()}
                counterpartyAvatarUrl={profileMap.get(d.to === userId ? d.from : d.to)?.avatar_url || null}
                groupName={groupName}
                payeeUpiId={profileMap.get(d.to)?.upi_id ?? null}
                groupId={groupId}
                counterpartyId={d.to === userId ? d.from : d.to}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GroupSettingsDialog — Info, Members, and Delete options
// ─────────────────────────────────────────────────────────────────────────────
function GroupSettingsDialog({
  group,
  members,
  pendingMembers,
  profileMap,
  currentUserId,
  isCreator,
  open,
  onOpenChange,
  onInviteClick,
  onLeave,
  leaveBusy,
  onDelete,
  deleteBusy,
}: {
  group: Group;
  members: GroupMember[];
  pendingMembers: GroupMember[];
  profileMap: Map<string, Profile>;
  currentUserId: string;
  isCreator: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInviteClick: () => void;
  onLeave: () => void;
  leaveBusy: boolean;
  onDelete: () => void;
  deleteBusy: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden border-slate-100 shadow-2xl bg-white">
        <DialogHeader className="px-6 py-4 border-b border-slate-100 shrink-0">
          <DialogTitle className="font-display font-bold text-lg text-slate-900">
            Group Settings
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Group Info */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-bold flex items-center justify-center text-base">
              {group.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-display font-bold text-base text-slate-900">{group.name}</p>
              <p className="text-xs text-slate-400">
                Created {new Date(group.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </div>

          {/* Members List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Members ({members.length + pendingMembers.length})
              </span>
              <button
                type="button"
                onClick={onInviteClick}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Invite
              </button>
            </div>

            <div className="space-y-1.5">
              {members.map((m) => {
                const p = profileMap.get(m.user_id);
                const dName =
                  m.user_id === currentUserId
                    ? "You"
                    : p?.full_name?.trim() || p?.username?.trim() || "User";
                return (
                  <div key={m.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="w-8 h-8 rounded-full shrink-0 ring-1 ring-slate-200/60 shadow-2xs">
                        <AvatarImage src={p?.avatar_url || undefined} alt={dName} />
                        <AvatarFallback className="bg-emerald-100 text-emerald-800 font-bold text-xs">
                          {dName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{dName}</p>
                        {p?.username && <p className="text-[10px] text-slate-400">@{p.username}</p>}
                      </div>
                    </div>
                    {m.user_id === group.created_by && (
                      <span className="text-[10px] font-bold text-slate-500 bg-white border px-2 py-0.5 rounded-md">
                        Admin
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <span className="text-xs font-bold text-rose-500 uppercase tracking-wider">Danger Zone</span>
            {!isCreator ? (
              <button
                type="button"
                onClick={onLeave}
                disabled={leaveBusy}
                className="w-full py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors"
              >
                Leave Group
              </button>
            ) : (
              <button
                type="button"
                onClick={onDelete}
                disabled={deleteBusy}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-xs"
              >
                Delete Group
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InviteDialog — tabbed: Friends (from friend list) | Search (by username)
// ─────────────────────────────────────────────────────────────────────────────
function InviteDialog({
  groupId,
  groupName,
  inviterId,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: {
  groupId: string;
  groupName: string;
  inviterId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const [tab, setTab] = useState<"friends" | "search">("friends");
  const [username, setUsername] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [invitedUserIds, setInvitedUserIds] = useState<Set<string>>(new Set());
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [invitingAll, setInvitingAll] = useState(false);
  const queryClient = useQueryClient();

  const handleSearchUsers = (val: string) => {
    setUsername(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!val.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await searchUsersByName(val.trim());
        setSearchResults(res.filter((u) => u.id !== inviterId));
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);
  };

  const handleInviteUser = async (targetUserId: string) => {
    setInvitingUserId(targetUserId);
    try {
      await inviteToGroup({ groupId, groupName, targetUserId, inviterId });
      setInvitedUserIds((prev) => new Set(prev).add(targetUserId));
      toast.success("Invite sent!");
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
      queryClient.invalidateQueries({ queryKey: ["friends-not-in-group", inviterId, groupId] });
    } catch (err: any) {
      toast.error(getCleanErrorMessage(err));
    } finally {
      setInvitingUserId(null);
    }
  };

  // Load friends not yet in this group
  const friendsQuery = useQuery({
    queryKey: ["friends-not-in-group", inviterId, groupId],
    queryFn: () => getFriendsNotInGroup(inviterId, groupId),
    enabled: open,
    staleTime: 30_000,
  });
  const friendsAvailable = friendsQuery.data ?? [];

  const toggleFriend = (id: string) => {
    setSelectedFriends((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );
  };

  const handleInviteSelected = async () => {
    if (selectedFriends.length === 0) return;
    setInvitingAll(true);
    let successCount = 0;
    for (const friendId of selectedFriends) {
      try {
        await inviteToGroup({ groupId, groupName, targetUserId: friendId, inviterId });
        successCount++;
      } catch (e: any) {
        toast.error(e.message || "Could not invite friend");
      }
    }
    setInvitingAll(false);
    if (successCount > 0) {
      toast.success(`${successCount} invite${successCount > 1 ? "s" : ""} sent!`);
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
      queryClient.invalidateQueries({ queryKey: ["friends-not-in-group", inviterId, groupId] });
      setSelectedFriends([]);
      setOpen(false);
    }
  };

  const searchMutation = useMutation({
    mutationFn: async () => {
      const user = await findUserByUsername(username.trim().toLowerCase());
      if (!user) throw new Error("No user found with that username.");
      if (user.id === inviterId) throw new Error("You're already in this group.");
      await inviteToGroup({ groupId, groupName, targetUserId: user.id, inviterId });
    },
    onSuccess: () => {
      toast.success("Invite sent!");
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
      queryClient.invalidateQueries({ queryKey: ["friends-not-in-group", inviterId, groupId] });
      setOpen(false);
      setUsername("");
    },
    onError: (error: Error) => toast.error(getCleanErrorMessage(error)),
  });

  const handleClose = (o: boolean) => {
    if (!o) {
      setSelectedFriends([]);
      setUsername("");
      setSearchResults([]);
      setTab("friends");
    }
    setOpen(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="p-0 gap-0 max-w-sm rounded-3xl overflow-hidden border-slate-100 shadow-2xl bg-white">
        {/* Handle */}
        <div className="pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto" />
        </div>

        <DialogHeader className="px-5 py-3 border-b border-slate-100 shrink-0">
          <DialogTitle className="font-display font-bold text-slate-900">Invite to Group</DialogTitle>
        </DialogHeader>

        {/* Tab Pills */}
        <div className="flex gap-2 px-5 pt-3 pb-0">
          {(["friends", "search"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-bold transition-all capitalize",
                tab === t
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200",
              )}
            >
              {t === "friends" ? "My Friends" : "Search User"}
            </button>
          ))}
        </div>

        {/* ── Friends Tab ── */}
        {tab === "friends" && (
          <div className="px-5 py-3 space-y-2 max-h-[55vh] overflow-y-auto">
            {friendsQuery.isLoading ? (
              <div className="py-6 flex justify-center">
                <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
              </div>
            ) : friendsAvailable.length === 0 ? (
              <div className="py-8 text-center">
                <UserPlus className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-500">No friends to invite</p>
                <p className="text-xs text-slate-400 mt-0.5">All your friends are already in this group, or you have no friends yet.</p>
              </div>
            ) : (
              <>
                {friendsAvailable.map((f) => {
                  const p = f.profile;
                  const name = p?.full_name?.trim() || p?.username?.replace(/^@/, "") || "Friend";
                  const uname = p?.username ? `@${p.username.replace(/^@/, "")}` : "";
                  const checked = selectedFriends.includes(f.friend_id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => toggleFriend(f.friend_id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-2.5 rounded-2xl border transition-all text-left",
                        checked
                          ? "border-emerald-300 bg-emerald-50/60"
                          : "border-transparent hover:bg-slate-50",
                      )}
                    >
                      <div
                        className={cn(
                          "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                          checked ? "bg-emerald-600 border-emerald-600" : "border-slate-300",
                        )}
                      >
                        {checked && <Check className="w-3 h-3 text-white stroke-[3]" />}
                      </div>
                      <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 font-bold text-sm flex items-center justify-center shrink-0">
                        {p?.avatar_url ? (
                          <img src={p.avatar_url} alt={name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          name.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                        {uname && <p className="text-[11px] text-slate-400">{uname}</p>}
                      </div>
                    </button>
                  );
                })}

                <div className="pt-2 pb-1">
                  <button
                    type="button"
                    disabled={selectedFriends.length === 0 || invitingAll}
                    onClick={handleInviteSelected}
                    className="w-full h-11 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/25"
                  >
                    {invitingAll ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    Invite {selectedFriends.length > 0 ? `${selectedFriends.length} Friend${selectedFriends.length > 1 ? "s" : ""}` : "Friends"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Search Tab (Search all users) ── */}
        {tab === "search" && (
          <div className="px-5 py-4 space-y-3 max-h-[55vh] overflow-y-auto">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={username}
                onChange={(e) => handleSearchUsers(e.target.value)}
                placeholder="Search users by name or username..."
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-10 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              {isSearching && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                </div>
              )}
            </div>

            {searchResults.length > 0 ? (
              <div className="space-y-1.5 pt-1">
                {searchResults.map((user) => {
                  const name = user.full_name?.trim() || user.username?.replace(/^@/, "") || "User";
                  const uname = user.username ? `@${user.username.replace(/^@/, "")}` : "";
                  const initials = getInitials(name, "U");
                  const isInvited = invitedUserIds.has(user.id);
                  const isInvitingThis = invitingUserId === user.id;

                  return (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50/80 border border-slate-100"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="w-9 h-9 rounded-full shrink-0 shadow-2xs">
                          <AvatarImage src={user.avatar_url || undefined} alt={name} />
                          <AvatarFallback className="bg-emerald-50 text-emerald-700 font-bold text-xs">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{name}</p>
                          {uname && <p className="text-[10px] text-slate-400 truncate">{uname}</p>}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isInvited || isInvitingThis}
                        onClick={() => handleInviteUser(user.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all active:scale-95 shrink-0",
                          isInvited
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs",
                        )}
                      >
                        {isInvitingThis ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isInvited ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <UserPlus className="w-3.5 h-3.5" />
                        )}
                        <span>{isInvited ? "Invited" : "Invite"}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : username.trim() ? (
              !isSearching && (
                <div className="py-6 text-center space-y-3">
                  <p className="text-xs text-slate-400">No users found matching "{username}"</p>
                  <Button
                    type="button"
                    disabled={searchMutation.isPending}
                    onClick={() => searchMutation.mutate()}
                    className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11"
                  >
                    {searchMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Invite by exact handle "@{username.replace(/^@/, "")}"
                  </Button>
                </div>
              )
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                <Search className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                Type a name or @username to search across all Splity users
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PendingSettlementDropdownRow
// ─────────────────────────────────────────────────────────────────────────────
function PendingSettlementDropdownRow({
  debt,
  userId,
  counterpartyName,
  counterpartyUsername,
  counterpartyInitials,
  counterpartyAvatarUrl,
  groupName,
  payeeUpiId,
  groupId,
  counterpartyId,
}: {
  debt: PairwiseDebt;
  userId: string;
  counterpartyName: string;
  counterpartyUsername: string | null;
  counterpartyInitials: string;
  counterpartyAvatarUrl?: string | null;
  groupName: string;
  payeeUpiId: string | null;
  groupId: string;
  counterpartyId: string;
}) {
  const isNegative = debt.from === userId;
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors">
        <div
          onClick={() => setSheetOpen(true)}
          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer select-none"
        >
          <Avatar className="w-8 h-8 rounded-full shrink-0 ring-1 ring-slate-200/60 shadow-2xs">
            <AvatarImage src={counterpartyAvatarUrl || undefined} alt={counterpartyName} />
            <AvatarFallback
              className={cn(
                "font-bold text-xs",
                isNegative ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700",
              )}
            >
              {counterpartyInitials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800 truncate">{counterpartyName}</p>
            <p className="text-[10px] text-slate-400">
              {isNegative ? "You owe" : "Owes you"} • {groupName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 pl-1">
          <p
            className={cn(
              "font-display font-bold text-xs",
              isNegative ? "text-rose-600" : "text-emerald-600",
            )}
          >
            {isNegative ? "-₹" : "+₹"}{debt.amount.toFixed(2)}
          </p>

          {isNegative ? (
            <QrPayDialog
              payeeName={counterpartyName}
              payeeUpiId={payeeUpiId}
              amount={debt.amount}
              note={`Splity settlement`}
              currentUserId={userId}
              counterpartyId={counterpartyId}
              groupId={groupId}
              trigger={
                <button
                  type="button"
                  className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold shadow-xs active:scale-95"
                >
                  Pay
                </button>
              }
            />
          ) : null}
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
        negative={isNegative}
        groupId={groupId}
        payeeUpiId={payeeUpiId}
      />
    </>
  );
}
