import { useState, memo, useMemo, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Bell,
  Check,
  CheckCheck,
  HandCoins,
  Loader2,
  Receipt,
  UserPlus,
  X,
  ChevronRight,
  Filter,
  Calendar,
  ChevronDown,
  ArrowUpRight,
  ArrowDown,
  Utensils,
  ShoppingBag,
  Coffee,
  Clock,
  IndianRupee,
  Handshake,
  Infinity,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  dismissAllNotifications,
  dismissNotification,
  getNotifications,
  getProfilesByIds,
  markAllNotificationsRead,
  markNotificationRead,
  respondToInvite,
  respondToFriendRequest,
  getMyGroups,
  getAllMyExpenses,
  parseExpenseDescription,
  getPendingFriendRequests,
} from "@/lib/api";
import { cn, getCleanErrorMessage, getInitials } from "@/lib/utils";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { AppNotification, Profile, Expense } from "@/lib/app-types";
import { Button } from "@/components/ui/button";
import { CountUpCurrency } from "@/components/CountUpCurrency";
import { ActivityDetailsSheet } from "@/components/ActivityDetailsSheet";
import { ExpenseDetailsModal } from "@/components/ExpenseDetailsModal";
import { PaymentDetailsModal } from "@/components/PaymentDetailsModal";
import { ActivityExpenseDetailsModal } from "@/components/ActivityExpenseDetailsModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function formatActivityTime(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const isYesterday =
    date.getDate() === now.getDate() - 1 &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const timeStr = `${hours}:${minutes} ${ampm}`;

  if (isToday) return `Today • ${timeStr}`;
  if (isYesterday) return `Yesterday • ${timeStr}`;

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()} • ${timeStr}`;
}

export const Route = createFileRoute("/app/activity")({
  component: ActivityPage,
});

type UnifiedActivityItem =
  | { type: "notification"; id: string; timestamp: string; notification: AppNotification }
  | { type: "expense"; id: string; timestamp: string; expense: Expense };

type DatePresetType =
  | "all"
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "thisMonth"
  | "custom";

function ActivityPage() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? "";
  const queryClient = useQueryClient();

  const [typeFilter, setTypeFilter] = useState<"all" | "expenses" | "settlements" | "friend_requests">("all");
  const [datePreset, setDatePreset] = useState<DatePresetType>("all");
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [friendRequestsModalOpen, setFriendRequestsModalOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const notifQuery = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => getNotifications(userId),
    enabled: !!userId,
    staleTime: 15_000,
  });

  const friendRequestsQuery = useQuery({
    queryKey: ["friend-requests", userId],
    queryFn: () => getPendingFriendRequests(userId),
    enabled: !!userId,
    staleTime: 15_000,
  });

  const expensesQuery = useQuery({
    queryKey: ["my-expenses", userId],
    queryFn: () => getAllMyExpenses(userId),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const groupsQuery = useQuery({
    queryKey: ["my-groups", userId],
    queryFn: () => getMyGroups(userId),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const groupMap = useMemo(
    () => new Map((groupsQuery.data ?? []).map((g) => [g.id, g.name])),
    [groupsQuery.data],
  );

  const profileIds = useMemo(() => {
    const ids = new Set<string>();
    for (const n of notifQuery.data ?? []) {
      if (n.sender_id) ids.add(n.sender_id);
      if (n.recipient_id) ids.add(n.recipient_id);
    }
    for (const fr of friendRequestsQuery.data ?? []) {
      if (fr.sender_id) ids.add(fr.sender_id);
    }
    for (const e of expensesQuery.data ?? []) {
      if (e.created_by) ids.add(e.created_by);
      if (e.paid_by) ids.add(e.paid_by);
    }
    return Array.from(ids);
  }, [notifQuery.data, friendRequestsQuery.data, expensesQuery.data]);

  const profilesQuery = useQuery({
    queryKey: ["profiles", profileIds.sort().join(",")],
    queryFn: () => getProfilesByIds(profileIds),
    enabled: profileIds.length > 0,
    staleTime: 60_000,
  });

  const profileMap = useMemo(
    () => new Map<string, Profile>((profilesQuery.data ?? []).map((p) => [p.id, p])),
    [profilesQuery.data],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    queryClient.invalidateQueries({ queryKey: ["friend-requests", userId] });
    queryClient.invalidateQueries({ queryKey: ["friends", userId] });
    queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
    queryClient.invalidateQueries({ queryKey: ["settle", userId] });
  };

  const respond = useMutation({
    mutationFn: (values: { notificationId: string; groupId: string; accept: boolean }) =>
      respondToInvite({
        notificationId: values.notificationId,
        groupId: values.groupId,
        userId,
        accept: values.accept,
      }),
    onSuccess: (_data, values) => {
      toast.success(values.accept ? "Joined the group!" : "Invite declined");
      invalidate();
    },
    onError: (error: Error) => toast.error(getCleanErrorMessage(error)),
  });

  const respondFriend = useMutation({
    mutationFn: (values: { notificationId?: string; senderId: string; accept: boolean }) =>
      respondToFriendRequest({
        notificationId: values.notificationId,
        senderId: values.senderId,
        recipientId: userId,
        accept: values.accept,
      }),
    onSuccess: (_data, values) => {
      toast.success(values.accept ? "Friend request accepted! ✅" : "Friend request declined");
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["friends", userId] });
      queryClient.invalidateQueries({ queryKey: ["friend-requests", userId] });
    },
    onError: (error: Error) => toast.error(getCleanErrorMessage(error)),
  });

  const dismiss = useMutation({
    mutationFn: (notificationId: string) => dismissNotification(notificationId),
    onSuccess: invalidate,
  });

  const dismissAll = useMutation({
    mutationFn: () => dismissAllNotifications(userId),
    onSuccess: () => {
      toast.success("All notifications dismissed");
      invalidate();
    },
    onError: (error: Error) => toast.error(getCleanErrorMessage(error)),
  });

  const markRead = useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId),
    onSuccess: () => {
      toast.success("Marked as read");
      invalidate();
    },
    onError: (error: Error) => toast.error(getCleanErrorMessage(error)),
  });

  const markAllRead = useMutation({
    mutationFn: () => markAllNotificationsRead(userId),
    onSuccess: () => {
      toast.success("All marked as read");
      invalidate();
    },
    onError: (error: Error) => toast.error(getCleanErrorMessage(error)),
  });

  const notifications = notifQuery.data ?? [];
  const expenses = expensesQuery.data ?? [];

  const pendingFriendRequests = useMemo(() => {
    const list: AppNotification[] = [];
    const seenSenders = new Set<string>();

    // 1. From notifications table
    for (const n of notifications) {
      if (
        n.type === "friend_request" &&
        n.status === "pending" &&
        n.sender_id &&
        n.sender_id !== userId
      ) {
        list.push(n);
        seenSenders.add(n.sender_id);
      }
    }

    // 2. From friend_requests table (source of truth if notification was not created)
    for (const fr of friendRequestsQuery.data ?? []) {
      if (fr.status === "pending" && fr.sender_id !== userId && !seenSenders.has(fr.sender_id)) {
        list.push({
          id: `fr-${fr.id}`,
          recipient_id: fr.recipient_id,
          sender_id: fr.sender_id,
          type: "friend_request",
          status: "pending",
          group_id: null,
          amount: null,
          message: "sent you a friend request",
          sender_username: null,
          sender_upi: null,
          created_at: fr.created_at,
        });
        seenSenders.add(fr.sender_id);
      }
    }

    return list;
  }, [notifications, friendRequestsQuery.data, userId]);

  const pendingCount = useMemo(
    () => notifications.filter((n) => n.status === "pending").length + (friendRequestsQuery.data ?? []).length,
    [notifications, friendRequestsQuery.data],
  );

  const unifiedActivity = useMemo(() => {
    const items: UnifiedActivityItem[] = [];
    const seenFriendSenders = new Set<string>();

    for (const n of notifications) {
      if (n.type !== "expense_added" && n.type !== "settlement_confirmed") {
        if (typeFilter === "expenses") continue;
        if (typeFilter === "settlements") continue;
        if (typeFilter === "friend_requests" && n.type !== "friend_request") continue;

        if (n.type === "friend_request" && n.sender_id) {
          seenFriendSenders.add(n.sender_id);
        }

        items.push({
          type: "notification",
          id: `notif-${n.id}`,
          timestamp: n.created_at,
          notification: n,
        });
      }
    }

    // Add friend requests from friend_requests table if not already represented in notifications
    for (const pfr of pendingFriendRequests) {
      if (pfr.id.startsWith("fr-") && pfr.sender_id && !seenFriendSenders.has(pfr.sender_id)) {
        if (typeFilter === "expenses") continue;
        if (typeFilter === "settlements") continue;
        items.push({
          type: "notification",
          id: pfr.id,
          timestamp: pfr.created_at,
          notification: pfr,
        });
      }
    }

    if (typeFilter !== "friend_requests") {
      for (const e of expenses) {
        const { cleanDescription } = parseExpenseDescription(e.description);
        const descLower = cleanDescription.toLowerCase();
        const isSettlement = descLower.includes("settlement") || descLower.includes("paid");

        if (typeFilter === "expenses" && isSettlement) continue;
        if (typeFilter === "settlements" && !isSettlement) continue;

        if (!isSettlement && e.created_by === userId) {
          continue;
        }

        items.push({
          type: "expense",
          id: `exp-${e.id}`,
          timestamp: e.created_at,
          expense: e,
        });
      }
    }

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items;
  }, [notifications, expenses, pendingFriendRequests, userId, typeFilter]);

  // Date range filtering
  const filteredActivity = useMemo(() => {
    if (datePreset === "all") return unifiedActivity;

    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    return unifiedActivity.filter((item) => {
      const itemDate = new Date(item.timestamp);

      if (datePreset === "today") {
        return itemDate >= startOfToday;
      }
      if (datePreset === "yesterday") {
        const startOfYesterday = new Date(startOfToday);
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);
        return itemDate >= startOfYesterday && itemDate < startOfToday;
      }
      if (datePreset === "last7") {
        const d = new Date(startOfToday);
        d.setDate(d.getDate() - 7);
        return itemDate >= d;
      }
      if (datePreset === "last30") {
        const d = new Date(startOfToday);
        d.setDate(d.getDate() - 30);
        return itemDate >= d;
      }
      if (datePreset === "thisMonth") {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        return itemDate >= startOfMonth;
      }
      if (datePreset === "custom" && customFrom && customTo) {
        const from = new Date(customFrom);
        const to = new Date(customTo);
        to.setHours(23, 59, 59, 999);
        return itemDate >= from && itemDate <= to;
      }
      return true;
    });
  }, [unifiedActivity, datePreset, customFrom, customTo]);

  // Group into "Today", "Yesterday", "Earlier"
  const groupedActivity = useMemo(() => {
    const today: UnifiedActivityItem[] = [];
    const yesterday: UnifiedActivityItem[] = [];
    const earlier: UnifiedActivityItem[] = [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    for (const item of filteredActivity) {
      const d = new Date(item.timestamp);
      if (d >= startOfToday) {
        today.push(item);
      } else if (d >= startOfYesterday) {
        yesterday.push(item);
      } else {
        earlier.push(item);
      }
    }

    return { today, yesterday, earlier };
  }, [filteredActivity]);

  // Date range label for Screen 2 dropdown pill
  const dateLabel = useMemo(() => {
    switch (datePreset) {
      case "today":
        return "Today";
      case "yesterday":
        return "Yesterday";
      case "last7":
        return "Last 7 Days";
      case "last30":
        return "Last 30 Days";
      case "thisMonth":
        return "This Month";
      case "custom":
        return customFrom && customTo ? `${customFrom} – ${customTo}` : "Custom Range";
      default:
        return "All Time";
    }
  }, [datePreset, customFrom, customTo]);

  const isFilterActive = datePreset !== "all" || typeFilter !== "all";

  const isLoading = notifQuery.isLoading || expensesQuery.isLoading;
  const isError = notifQuery.isError || expensesQuery.isError;

  return (
    <div className="space-y-4">
      {/* Top Bar: Title & Subtitle on left, Actions & Filter button on right */}
      <div className="flex items-start justify-between pt-1">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Activity
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Your shared expenses & settlements
          </p>
        </div>

        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <div className="flex items-center gap-1.5">
              {pendingCount > 0 && (
                <button
                  type="button"
                  disabled={markAllRead.isPending}
                  onClick={() => markAllRead.mutate()}
                  className="px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                  title="Mark all notifications as read"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Mark read</span>
                </button>
              )}
              <button
                type="button"
                disabled={dismissAll.isPending}
                onClick={() => dismissAll.mutate()}
                className="px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                title="Dismiss all notifications"
              >
                <X className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Dismiss all</span>
              </button>
            </div>
          )}

          {/* Filter Button with Active Indicator Dot */}
          <button
            type="button"
            onClick={() => setDateSheetOpen(true)}
            className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center transition-all relative border",
              isFilterActive
                ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs"
                : "bg-slate-100/80 border-slate-200/50 text-slate-600 hover:bg-slate-200/70",
            )}
            aria-label="Filter activity"
          >
            <Filter className="w-4 h-4 stroke-[2.2]" />
            {isFilterActive && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-600 ring-2 ring-white" />
            )}
          </button>
        </div>
      </div>

      {/* Type Filter Pills (All / Expenses / Settlements / Friend Requests) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          type="button"
          onClick={() => setTypeFilter("all")}
          className={cn(
            "rounded-full px-5 py-2 text-xs font-semibold transition-all shrink-0",
            typeFilter === "all"
              ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md shadow-emerald-600/25"
              : "bg-slate-100/90 text-slate-600 hover:bg-slate-200/70",
          )}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setTypeFilter("expenses")}
          className={cn(
            "rounded-full px-5 py-2 text-xs font-semibold transition-all shrink-0",
            typeFilter === "expenses"
              ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md shadow-emerald-600/25"
              : "bg-slate-100/90 text-slate-600 hover:bg-slate-200/70",
          )}
        >
          Expenses
        </button>
        <button
          type="button"
          onClick={() => setTypeFilter("settlements")}
          className={cn(
            "rounded-full px-5 py-2 text-xs font-semibold transition-all shrink-0",
            typeFilter === "settlements"
              ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md shadow-emerald-600/25"
              : "bg-slate-100/90 text-slate-600 hover:bg-slate-200/70",
          )}
        >
          Settlements
        </button>
        <button
          type="button"
          onClick={() => setTypeFilter("friend_requests")}
          className={cn(
            "rounded-full px-4 py-2 text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5",
            typeFilter === "friend_requests"
              ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md shadow-emerald-600/25"
              : "bg-slate-100/90 text-slate-600 hover:bg-slate-200/70",
          )}
        >
          <span>Friend Requests</span>
          {pendingFriendRequests.length > 0 && (
            <span
              className={cn(
                "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                typeFilter === "friend_requests"
                  ? "bg-white text-emerald-700"
                  : "bg-rose-500 text-white",
              )}
            >
              {pendingFriendRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* Screen 3 in Mockup: Active Date Filter Badge */}
      {datePreset !== "all" && (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-emerald-50/90 border border-emerald-200/80 text-emerald-900 text-xs font-semibold shadow-2xs">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>{dateLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setDatePreset("all");
              setCustomFrom("");
              setCustomTo("");
            }}
            className="p-1 hover:bg-emerald-100/80 rounded-lg text-emerald-700 transition-colors"
            aria-label="Clear date filter"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Activity List grouped by Today, Yesterday, Earlier */}
      {isLoading && unifiedActivity.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3.5 p-4 rounded-2xl bg-white border border-slate-100" style={{ "--stagger": i } as React.CSSProperties}>
              <div className="w-11 h-11 rounded-2xl skeleton-shimmer shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-3/5 rounded-lg skeleton-shimmer" />
                <div className="h-3 w-2/5 rounded-lg skeleton-shimmer" />
              </div>
              <div className="h-4 w-14 rounded-lg skeleton-shimmer" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl bg-white border border-slate-100 p-8 text-center">
          <p className="text-sm font-semibold text-slate-800">Activity could not load</p>
          <Button
            className="mt-4"
            size="sm"
            variant="outline"
            onClick={() => {
              notifQuery.refetch();
              expensesQuery.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      ) : filteredActivity.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-100 p-8 text-center">
          <p className="text-sm font-semibold text-slate-800">No activity found</p>
          <p className="text-xs text-slate-400 mt-1">
            {datePreset === "all" && typeFilter === "all"
              ? "Transactions will show up here"
              : "Try adjusting your filters"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedActivity.today.length > 0 && (
            <ActivitySection
              sectionType="today"
              items={groupedActivity.today}
              userId={userId}
              profileMap={profileMap}
              groupMap={groupMap}
              respond={respond}
              respondFriend={respondFriend}
              dismiss={dismiss}
              markRead={markRead}
            />
          )}

          {groupedActivity.yesterday.length > 0 && (
            <ActivitySection
              sectionType="yesterday"
              items={groupedActivity.yesterday}
              userId={userId}
              profileMap={profileMap}
              groupMap={groupMap}
              respond={respond}
              respondFriend={respondFriend}
              dismiss={dismiss}
              markRead={markRead}
            />
          )}

          {groupedActivity.earlier.length > 0 && (
            <ActivitySection
              sectionType="earlier"
              items={groupedActivity.earlier}
              userId={userId}
              profileMap={profileMap}
              groupMap={groupMap}
              respond={respond}
              respondFriend={respondFriend}
              dismiss={dismiss}
              markRead={markRead}
            />
          )}
        </div>
      )}

      {/* Friend Requests Modal */}
      <FriendRequestsModal
        open={friendRequestsModalOpen}
        onOpenChange={setFriendRequestsModalOpen}
        requests={pendingFriendRequests}
        profileMap={profileMap}
        onAccept={(req) => {
          respondFriend.mutate({
            notificationId: req.id,
            senderId: req.sender_id!,
            accept: true,
          });
        }}
        onDecline={(req) => {
          respondFriend.mutate({
            notificationId: req.id,
            senderId: req.sender_id!,
            accept: false,
          });
        }}
        busy={respondFriend.isPending}
      />

      {/* Screen 2: Expandable Mobile Activity Filter Modal */}
      <ActivityFilterModal
        open={dateSheetOpen}
        onOpenChange={setDateSheetOpen}
        typeFilter={typeFilter}
        onSelectType={setTypeFilter}
        selectedPreset={datePreset}
        onSelectPreset={setDatePreset}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFromChange={setCustomFrom}
        onCustomToChange={setCustomTo}
      />
    </div>
  );
}

function FriendRequestsModal({
  open,
  onOpenChange,
  requests,
  profileMap,
  onAccept,
  onDecline,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requests: AppNotification[];
  profileMap: Map<string, Profile>;
  onAccept: (req: AppNotification) => void;
  onDecline: (req: AppNotification) => void;
  busy: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-sm rounded-3xl overflow-hidden border-slate-100 shadow-2xl bg-white max-h-[85vh] flex flex-col">
        <div className="pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto" />
        </div>

        <DialogHeader className="px-5 py-3 border-b border-slate-100 shrink-0">
          <DialogTitle className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
            Friend Requests
            <span className="text-emerald-600 text-base">({requests.length})</span>
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {requests.length === 0 ? (
            <div className="py-10 text-center px-4">
              <UserPlus className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
              <p className="text-sm font-semibold text-slate-700">No pending friend requests</p>
              <p className="text-xs text-slate-400 mt-1">When someone sends you a friend request, it will appear here.</p>
            </div>
          ) : (
            requests.map((req) => {
              const sender = req.sender_id ? profileMap.get(req.sender_id) : undefined;
              const name = sender?.full_name?.trim() || sender?.username?.replace(/^@/, "").trim() || req.sender_username || "Someone";
              const uname = sender?.username ? `@${sender.username.replace(/^@/, "")}` : "";
              const initials = getInitials(name, "U");

              return (
                <div key={req.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10 shrink-0 shadow-2xs">
                      <AvatarImage src={sender?.avatar_url || undefined} alt={name} />
                      <AvatarFallback className="bg-emerald-50 text-emerald-700 font-bold text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{name}</p>
                      {uname && <p className="text-[10px] text-slate-400 truncate">{uname}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onAccept(req)}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Accept</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDecline(req)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActivitySection({
  sectionType,
  items,
  userId,
  profileMap,
  groupMap,
  respond,
  respondFriend,
  dismiss,
  markRead,
}: {
  sectionType: "today" | "yesterday" | "earlier";
  items: UnifiedActivityItem[];
  userId: string;
  profileMap: Map<string, Profile>;
  groupMap: Map<string, string>;
  respond: any;
  respondFriend: any;
  dismiss: any;
  markRead: any;
}) {
  return (
    <div className="space-y-2">
      {sectionType === "today" ? (
        <h3 className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 uppercase tracking-widest px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-badge-pulse" />
          TODAY
        </h3>
      ) : sectionType === "yesterday" ? (
        <h3 className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
          YESTERDAY
        </h3>
      ) : (
        <h3 className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
          EARLIER
        </h3>
      )}

      <div className="space-y-2">
        {items.map((item, index) => {
          if (item.type === "notification") {
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: Math.min(index * 0.05, 0.35),
                  ease: [0.25, 1, 0.5, 1],
                }}
              >
                <NotificationCard
                  notification={item.notification}
                  senderProfile={
                    item.notification.sender_id
                      ? profileMap.get(item.notification.sender_id)
                      : undefined
                  }
                  recipientProfile={
                    item.notification.recipient_id
                      ? profileMap.get(item.notification.recipient_id)
                      : undefined
                  }
                  groupName={
                    item.notification.group_id
                      ? groupMap.get(item.notification.group_id)
                      : undefined
                  }
                  currentUserId={userId}
                  onAccept={() => {
                    if (item.notification.type === "friend_request") {
                      respondFriend.mutate({
                        notificationId: item.notification.id,
                        senderId: item.notification.sender_id!,
                        accept: true,
                      });
                    } else {
                      respond.mutate({
                        notificationId: item.notification.id,
                        groupId: item.notification.group_id!,
                        accept: true,
                      });
                    }
                  }}
                  onDecline={() => {
                    if (item.notification.type === "friend_request") {
                      respondFriend.mutate({
                        notificationId: item.notification.id,
                        senderId: item.notification.sender_id!,
                        accept: false,
                      });
                    } else {
                      respond.mutate({
                        notificationId: item.notification.id,
                        groupId: item.notification.group_id!,
                        accept: false,
                      });
                    }
                  }}
                  onDismiss={() => dismiss.mutate(item.notification.id)}
                  onMarkRead={() => markRead.mutate(item.notification.id)}
                  busy={respond.isPending || respondFriend.isPending || dismiss.isPending || markRead.isPending}
                />
              </motion.div>
            );
          } else {
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: Math.min(index * 0.05, 0.35),
                  ease: [0.25, 1, 0.5, 1],
                }}
              >
                <ActivityExpenseCard
                  expense={item.expense}
                  currentUserId={userId}
                  groupName={groupMap.get(item.expense.group_id)}
                  creatorProfile={
                    item.expense.created_by ? profileMap.get(item.expense.created_by) : undefined
                  }
                />
              </motion.div>
            );
          }
        })}
      </div>
    </div>
  );
}

// Screen 2: Expandable, mobile-friendly Activity Filter Modal
function ActivityFilterModal({
  open,
  onOpenChange,
  typeFilter,
  onSelectType,
  selectedPreset,
  onSelectPreset,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  typeFilter: "all" | "expenses" | "settlements" | "friend_requests";
  onSelectType: (t: "all" | "expenses" | "settlements" | "friend_requests") => void;
  selectedPreset: DatePresetType;
  onSelectPreset: (p: DatePresetType) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (v: string) => void;
  onCustomToChange: (v: string) => void;
}) {
  const [draftType, setDraftType] = useState<"all" | "expenses" | "settlements" | "friend_requests">(typeFilter);
  const [draftPreset, setDraftPreset] = useState<DatePresetType>(selectedPreset);

  // Sync state when opened
  useEffect(() => {
    if (open) {
      setDraftType(typeFilter);
      setDraftPreset(selectedPreset);
    }
  }, [open, typeFilter, selectedPreset]);

  // Compute realistic dynamic dates for subtitles
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const last7 = new Date();
  last7.setDate(now.getDate() - 7);
  const last30 = new Date();
  last30.setDate(now.getDate() - 30);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const todayLabel = `${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  const yesterdayLabel = `${yesterday.getDate()} ${monthNames[yesterday.getMonth()]} ${yesterday.getFullYear()}`;
  const last7Label = `${last7.getDate()} ${monthNames[last7.getMonth()]} – ${now.getDate()} ${monthNames[now.getMonth()]}`;
  const last30Label = `${last30.getDate()} ${monthNames[last30.getMonth()]} – ${now.getDate()} ${monthNames[now.getMonth()]}`;
  const thisMonthLabel = `1 ${monthNames[now.getMonth()]} – ${endOfMonth.getDate()} ${monthNames[now.getMonth()]}`;

  const presets = [
    { id: "all" as const, label: "All Time", sub: "Show all activity", isInfinity: true },
    { id: "today" as const, label: "Today", sub: todayLabel },
    { id: "yesterday" as const, label: "Yesterday", sub: yesterdayLabel },
    { id: "last7" as const, label: "Last 7 Days", sub: last7Label },
    { id: "last30" as const, label: "Last 30 Days", sub: last30Label },
    { id: "thisMonth" as const, label: "This Month", sub: thisMonthLabel },
    { id: "custom" as const, label: "Custom Range", sub: "Choose start and end date" },
  ];

  const handleApply = () => {
    onSelectType(draftType);
    onSelectPreset(draftPreset);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-sm rounded-[28px] overflow-hidden border-slate-100 shadow-2xl bg-white">
        {/* Top Handle Bar */}
        <div className="pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto" />
        </div>

        {/* Modal Header */}
        <div className="px-6 py-2.5 flex items-center justify-between">
          <DialogTitle className="font-display text-lg font-bold text-slate-900">
            Filter Activity
          </DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-3 space-y-5 max-h-[68vh] overflow-y-auto">
          {/* Section 1: Activity Type Filter (3 clean cards) */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 mb-2.5">
              Activity Type
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Card 1: All */}
              <button
                type="button"
                onClick={() => setDraftType("all")}
                className={cn(
                  "p-3 rounded-2xl flex flex-col items-center justify-center transition-all relative border",
                  draftType === "all"
                    ? "bg-emerald-50/80 border-emerald-500/50 shadow-xs"
                    : "bg-white border-slate-100 hover:bg-slate-50/70",
                )}
              >
                <div className="w-9 h-9 rounded-full bg-emerald-100/70 text-emerald-700 flex items-center justify-center mb-1.5">
                  <IndianRupee className="w-4 h-4 stroke-[2.5]" />
                </div>
                <span className="text-xs font-bold text-slate-800">All</span>
                {draftType === "all" && (
                  <div className="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
              </button>

              {/* Card 2: Expenses */}
              <button
                type="button"
                onClick={() => setDraftType("expenses")}
                className={cn(
                  "p-3 rounded-2xl flex flex-col items-center justify-center transition-all relative border",
                  draftType === "expenses"
                    ? "bg-emerald-50/80 border-emerald-500/50 shadow-xs"
                    : "bg-white border-slate-100 hover:bg-slate-50/70",
                )}
              >
                <div className="w-9 h-9 rounded-full bg-rose-100/70 text-rose-600 flex items-center justify-center mb-1.5">
                  <Receipt className="w-4 h-4 stroke-[2.2]" />
                </div>
                <span className="text-xs font-bold text-slate-800">Expenses</span>
                {draftType === "expenses" && (
                  <div className="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
              </button>

              {/* Card 3: Settlements */}
              <button
                type="button"
                onClick={() => setDraftType("settlements")}
                className={cn(
                  "p-3 rounded-2xl flex flex-col items-center justify-center transition-all relative border",
                  draftType === "settlements"
                    ? "bg-emerald-50/80 border-emerald-500/50 shadow-xs"
                    : "bg-white border-slate-100 hover:bg-slate-50/70",
                )}
              >
                <div className="w-9 h-9 rounded-full bg-purple-100/70 text-purple-600 flex items-center justify-center mb-1.5">
                  <Handshake className="w-4 h-4 stroke-[2.2]" />
                </div>
                <span className="text-xs font-bold text-slate-800">Settlements</span>
                {draftType === "settlements" && (
                  <div className="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
              </button>

              {/* Card 4: Friend Requests */}
              <button
                type="button"
                onClick={() => setDraftType("friend_requests")}
                className={cn(
                  "p-3 rounded-2xl flex flex-col items-center justify-center transition-all relative border",
                  draftType === "friend_requests"
                    ? "bg-emerald-50/80 border-emerald-500/50 shadow-xs"
                    : "bg-white border-slate-100 hover:bg-slate-50/70",
                )}
              >
                <div className="w-9 h-9 rounded-full bg-sky-100/70 text-sky-600 flex items-center justify-center mb-1.5">
                  <UserPlus className="w-4 h-4 stroke-[2.2]" />
                </div>
                <span className="text-xs font-bold text-slate-800">Friends</span>
                {draftType === "friend_requests" && (
                  <div className="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Section 2: Date Range Filter */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 mb-2.5">
              Date Range
            </h3>
            <div className="space-y-2">
              {presets.map((p) => {
                const isSelected = draftPreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setDraftPreset(p.id)}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all",
                      isSelected
                        ? "bg-emerald-50/70 border-emerald-300 shadow-2xs"
                        : "bg-white border-slate-100 hover:bg-slate-50/70",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                          p.isInfinity
                            ? "bg-emerald-100/70 text-emerald-700"
                            : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {p.isInfinity ? (
                          <Infinity className="w-4 h-4 stroke-[2.5]" />
                        ) : (
                          <Calendar className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 leading-tight">
                          {p.label}
                        </p>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                          {p.sub}
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}

              {draftPreset === "custom" && (
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 mt-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">From</label>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => onCustomFromChange(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-xs text-slate-800 outline-none mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">To</label>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => onCustomToChange(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-xs text-slate-800 outline-none mt-1"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer: Apply Filters Button */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={handleApply}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
          >
            <Filter className="w-4 h-4" />
            <span>Apply Filters</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActivityMotionCard({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const [tilt, setTilt] = useState({ x: 0, y: 0, active: false });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (typeof window !== "undefined" && window.matchMedia("(hover: none)").matches) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      x: -py * 4,
      y: px * 4,
      active: true,
    });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0, active: false });
  };

  return (
    <div
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: tilt.active
          ? `perspective(800px) rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg) translateY(-2.5px)`
          : "perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0px)",
        transition: tilt.active
          ? "transform 0.12s ease-out, box-shadow 0.2s ease-out"
          : "transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.4s ease-out",
        transformStyle: "preserve-3d",
      }}
      className={cn(
        "will-change-transform select-none cursor-pointer transition-shadow duration-200 hover:shadow-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

const ActivityExpenseCard = memo(function ActivityExpenseCard({
  expense,
  currentUserId,
  groupName,
  creatorProfile,
}: {
  expense: Expense;
  currentUserId: string;
  groupName?: string;
  creatorProfile?: Profile;
}) {
  const { cleanDescription } = parseExpenseDescription(expense.description);
  const descLower = cleanDescription.toLowerCase();
  const isSettlement = descLower.includes("settlement") || descLower.includes("paid");
  const isCash = descLower.includes("cash");
  const isUpi = descLower.includes("upi") || (!isCash && isSettlement);
  const isPayer = expense.paid_by === currentUserId;

  const creatorDisplayName = isPayer
    ? "You"
    : creatorProfile?.full_name?.trim() ||
      creatorProfile?.username?.replace(/^@/, "").trim() ||
      "Someone";

  const expenseDate = new Date(expense.created_at);
  const timeStr = !isNaN(expenseDate.getTime())
    ? expenseDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    : "";

  let title = cleanDescription;
  let subtitle = "";
  let badgeText: string | null = null;
  let isOutgoing = false;
  let isIncoming = false;

  if (isSettlement) {
    title = isCash ? "Cash Settlement" : "UPI Settlement";
    badgeText = isCash ? "Cash" : "UPI";

    if (isPayer) {
      isOutgoing = true;
      subtitle = `You paid out${timeStr ? ` • ${timeStr}` : ""}${groupName ? ` • ${groupName}` : ""}`;
    } else {
      isIncoming = true;
      subtitle = `${creatorDisplayName} paid you${timeStr ? ` • ${timeStr}` : ""}${groupName ? ` • ${groupName}` : ""}`;
    }
  } else {
    // Normal expense
    subtitle = `Paid by ${creatorDisplayName}${timeStr ? ` • ${timeStr}` : ""}${groupName ? ` • ${groupName}` : ""}`;
  }

  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <>
      <ActivityMotionCard
        onClick={() => setDetailsOpen(true)}
        className={cn(
          "flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border card-hover",
          isSettlement
            ? isOutgoing
              ? "bg-rose-50 border-rose-100/80 shadow-[0_2px_8px_rgba(239,68,68,0.08)]"
              : "bg-emerald-50 border-emerald-100/80 shadow-[0_2px_8px_rgba(16,185,129,0.08)]"
            : "bg-white border-slate-100/90 shadow-[0_2px_8px_rgba(0,0,0,0.03)]",
        )}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          {/* Category Icon or Settlement Arrow */}
          {isSettlement ? (
            <div
              className={cn(
                "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border",
                isOutgoing
                  ? "bg-rose-100 text-rose-600 border-rose-200/60"
                  : "bg-emerald-100 text-emerald-700 border-emerald-200/60",
              )}
            >
              {isOutgoing ? (
                <ArrowUpRight className="w-5 h-5 stroke-[2.2]" />
              ) : (
                <ArrowDown className="w-5 h-5 stroke-[2.2]" />
              )}
            </div>
          ) : (
            <CategoryIcon description={cleanDescription} size="md" />
          )}

          <div className="min-w-0">
            <p className="font-display font-bold text-sm text-slate-900 truncate">
              {title}
            </p>
            <p className="text-xs text-slate-400 font-medium truncate mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Right side: Badge (if settlement) + Amount */}
        <div className="shrink-0 text-right pl-2 flex flex-col items-end gap-1">
          {badgeText && (
            <span
              className={cn(
                "px-2 py-0.5 rounded-md text-[10px] font-bold border",
                isOutgoing
                  ? "bg-rose-50 text-rose-500 border-rose-100/70"
                  : "bg-emerald-50 text-emerald-700 border-emerald-100/70",
              )}
            >
              {badgeText}
            </span>
          )}
          <p
            className={cn(
              "font-display font-bold text-sm sm:text-base",
              isOutgoing
                ? "text-rose-500"
                : isIncoming || isPayer
                  ? "text-emerald-600"
                  : "text-slate-900",
            )}
          >
            {isOutgoing ? "-₹" : isIncoming ? "+₹" : "₹"}
            {Number(expense.amount).toFixed(2)}
          </p>
        </div>
      </ActivityMotionCard>

      {isSettlement ? (
        <PaymentDetailsModal
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          expense={expense}
          currentUserId={currentUserId}
        />
      ) : (
        <ActivityExpenseDetailsModal
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          expense={expense}
          currentUserId={currentUserId}
        />
      )}
    </>
  );
});

const NotificationCard = memo(function NotificationCard({
  notification,
  senderProfile,
  recipientProfile,
  groupName,
  currentUserId,
  onAccept,
  onDecline,
  onDismiss,
  onMarkRead,
  busy,
}: {
  notification: AppNotification;
  senderProfile?: Profile;
  recipientProfile?: Profile;
  groupName?: string;
  currentUserId: string;
  onAccept: () => void;
  onDecline: () => void;
  onDismiss: () => void;
  onMarkRead: () => void;
  busy: boolean;
}) {
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isInvite = notification.type === "group_invite";
  const isFriendRequest = notification.type === "friend_request";
  const isSettlementRequest = notification.type === "settlement_request";
  const pending = notification.status === "pending";
  const isAccepted = notification.status === "accepted";

  const isSenderCurrentUser = notification.sender_id === currentUserId;

  const senderDisplayName = isSenderCurrentUser
    ? "You"
    : senderProfile?.full_name?.trim() ||
      senderProfile?.username?.replace(/^@/, "").trim() ||
      notification.sender_username ||
      "Someone";

  const counterpartyId = notification.sender_id || "";

  let cardDisplayName = senderDisplayName;
  let actionText = "";

  if (isSettlementRequest) {
    cardDisplayName = senderDisplayName;
    actionText = "Requested a settlement";
  } else if (isInvite) {
    cardDisplayName = senderDisplayName;
    actionText = "Invited you to join group";
  } else if (isFriendRequest) {
    cardDisplayName = senderDisplayName;
    if (isAccepted && isSenderCurrentUser) {
      // "You" accepted notification — shouldn't normally appear; just show as read.
      actionText = "Friend request accepted";
    } else if (isAccepted) {
      actionText = "Accepted your friend request";
    } else {
      actionText = isSenderCurrentUser ? "You sent a friend request" : "Sent you a friend request";
    }
  }

  const handleCardClick = () => {
    if (isInvite) {
      // Do not navigate automatically for invites on Activity page
      return;
    }
    if (counterpartyId) {
      setSheetOpen(true);
      if (pending) {
        onMarkRead();
      }
    }
  };

  return (
    <>
      <ActivityMotionCard
        onClick={handleCardClick}
        className={cn(
          "flex items-start sm:items-center gap-3 sm:gap-3.5 rounded-2xl border border-border bg-card p-3.5 sm:p-4 shadow-sm active:scale-[0.98] overflow-hidden",
        )}
      >
        {senderProfile?.avatar_url ? (
          <Avatar className="h-10 w-10 shrink-0 rounded-2xl shadow-2xs">
            <AvatarImage src={senderProfile.avatar_url} alt={cardDisplayName} />
            <AvatarFallback className="rounded-2xl bg-emerald-50 text-emerald-700 font-bold text-xs">
              {getInitials(cardDisplayName, "U")}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              isInvite || isFriendRequest
                ? "bg-secondary text-primary"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            )}
          >
            {isInvite || isFriendRequest ? <UserPlus className="h-5 w-5" /> : <HandCoins className="h-5 w-5" />}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
            <span className="font-semibold text-foreground text-sm truncate max-w-full">
              {cardDisplayName}
            </span>
          </div>

          <p className="text-xs text-muted-foreground mt-0.5 break-words">{actionText}</p>

          <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 font-medium">
            {formatActivityTime(notification.created_at)}
          </p>

          {(isInvite || isFriendRequest) && pending && !isSenderCurrentUser ? (
            <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" onClick={onAccept} disabled={busy}>
                <Check className="mr-1 h-4 w-4" /> Accept
              </Button>
              <Button size="sm" variant="outline" onClick={onDecline} disabled={busy}>
                <X className="mr-1 h-4 w-4" /> Decline
              </Button>
            </div>
          ) : (
            <div className="mt-2.5 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {pending && (
                <button
                  type="button"
                  onClick={onMarkRead}
                  disabled={busy}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 flex items-center gap-1 transition-colors disabled:opacity-50"
                  title="Mark as read"
                >
                  <Check className="w-3 h-3" /> Mark read
                </button>
              )}
              <button
                type="button"
                onClick={onDismiss}
                disabled={busy}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 flex items-center gap-1 transition-colors disabled:opacity-50"
                title="Dismiss"
              >
                <X className="w-3 h-3" /> Dismiss
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 text-right ml-auto pl-1">
          {notification.amount != null ? (
            <div>
              <p className="font-display font-bold text-sm sm:text-base text-foreground whitespace-nowrap">
                <CountUpCurrency amount={Number(notification.amount)} />
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium whitespace-nowrap">
                Pending Balance
              </p>
            </div>
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </ActivityMotionCard>

      {counterpartyId ? (
        <ActivityDetailsSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          currentUserId={currentUserId}
          counterpartyId={counterpartyId}
          notification={notification}
          groupName={groupName}
        />
      ) : null}
    </>
  );
});
