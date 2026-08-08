import { useState, memo, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  getMyGroups,
  getAllMyExpenses,
  parseExpenseDescription,
} from "@/lib/api";
import type { AppNotification, Profile, Expense } from "@/lib/app-types";
import { Button } from "@/components/ui/button";
import { CountUpCurrency } from "@/components/CountUpCurrency";
import { ActivityDetailsSheet } from "@/components/ActivityDetailsSheet";
import { ExpenseDetailsModal } from "@/components/ExpenseDetailsModal";
import { PaymentDetailsModal } from "@/components/PaymentDetailsModal";
import { ActivityExpenseDetailsModal } from "@/components/ActivityExpenseDetailsModal";
import { cn, getCleanErrorMessage } from "@/lib/utils";

export const Route = createFileRoute("/app/activity")({
  component: ActivityPage,
});

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
  return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()} • ${timeStr}`;
}

type UnifiedActivityItem =
  | { type: "notification"; id: string; timestamp: string; notification: AppNotification }
  | { type: "expense"; id: string; timestamp: string; expense: Expense };

function ActivityPage() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? "";
  const queryClient = useQueryClient();

  const notifQuery = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => getNotifications(userId),
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
    for (const e of expensesQuery.data ?? []) {
      if (e.created_by) ids.add(e.created_by);
      if (e.paid_by) ids.add(e.paid_by);
    }
    const arr = Array.from(ids);
    try {
      arr.sort();
    } catch (e) {
      // ignore
    }
    return arr;
  }, [notifQuery.data, expensesQuery.data]);

  const profilesQuery = useQuery({
    queryKey: ["profiles", profileIds.join(",")],
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

  const pendingCount = useMemo(
    () => notifications.filter((n) => n.status === "pending").length,
    [notifications],
  );

  const unifiedActivity = useMemo(() => {
    const items: UnifiedActivityItem[] = [];

    // Notifications (exclude those handled by expenses to avoid duplicates)
    for (const n of notifications) {
      if (n.type !== "expense_added" && n.type !== "settlement_confirmed") {
        items.push({
          type: "notification",
          id: `notif-${n.id}`,
          timestamp: n.created_at,
          notification: n,
        });
      }
    }

    // Expenses
    for (const e of expenses) {
      const { cleanDescription } = parseExpenseDescription(e.description);
      const descLower = cleanDescription.toLowerCase();
      const isSettlement = descLower.includes("settlement") || descLower.includes("paid");
      
      if (!isSettlement && e.created_by === userId) {
        continue; // Do NOT show my own newly-created regular expenses
      }

      items.push({
        type: "expense",
        id: `exp-${e.id}`,
        timestamp: e.created_at,
        expense: e,
      });
    }

    // Sort descending
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items;
  }, [notifications, expenses, userId]);

  const isLoading = notifQuery.isLoading || expensesQuery.isLoading;
  const isError = notifQuery.isError || expensesQuery.isError;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Activity</h1>
          <p className="text-sm text-muted-foreground">
            Group invites, expense updates, and settlement requests.
          </p>
        </div>
        {notifications.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {pendingCount > 0 ? (
              <Button
                size="sm"
                variant="outline"
                disabled={markAllRead.isPending}
                onClick={() => markAllRead.mutate()}
              >
                <CheckCheck className="mr-1.5 h-4 w-4" />
                Mark all read
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              disabled={dismissAll.isPending}
              onClick={() => dismissAll.mutate()}
            >
              <X className="mr-1.5 h-4 w-4" />
              Dismiss all
            </Button>
          </div>
        ) : null}
      </div>

      {isLoading && unifiedActivity.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
            <Bell className="h-6 w-6" />
          </div>
          <h3 className="mt-4 font-display text-base font-semibold">Activity could not load</h3>
          <p className="mt-1 text-sm text-muted-foreground">Please try refreshing the page.</p>
          <Button
            className="mt-5"
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
      ) : unifiedActivity.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
            <Bell className="h-6 w-6" />
          </div>
          <h3 className="mt-4 font-display text-base font-semibold">You're all caught up</h3>
          <p className="mt-1 text-sm text-muted-foreground">Recent activity will show up here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {unifiedActivity.map((item) => {
            if (item.type === "notification") {
              return (
                <NotificationCard
                  key={item.id}
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
                  onAccept={() =>
                    respond.mutate({
                      notificationId: item.notification.id,
                      groupId: item.notification.group_id!,
                      accept: true,
                    })
                  }
                  onDecline={() =>
                    respond.mutate({
                      notificationId: item.notification.id,
                      groupId: item.notification.group_id!,
                      accept: false,
                    })
                  }
                  onDismiss={() => dismiss.mutate(item.notification.id)}
                  onMarkRead={() => markRead.mutate(item.notification.id)}
                  busy={respond.isPending || dismiss.isPending || markRead.isPending}
                />
              );
            } else {
              return (
                <ActivityExpenseCard
                  key={item.id}
                  expense={item.expense}
                  currentUserId={userId}
                  creatorProfile={
                    item.expense.created_by ? profileMap.get(item.expense.created_by) : undefined
                  }
                />
              );
            }
          })}
        </div>
      )}
    </div>
  );
}

const ActivityExpenseCard = memo(function ActivityExpenseCard({
  expense,
  currentUserId,
  creatorProfile,
}: {
  expense: Expense;
  currentUserId: string;
  creatorProfile?: Profile;
}) {
  const navigate = useNavigate();
  const { cleanDescription } = parseExpenseDescription(expense.description);
  const descLower = cleanDescription.toLowerCase();
  const isSettlement = descLower.includes("settlement") || descLower.includes("paid");

  let bgClass = "bg-card";
  let borderClass = "border-border";
  let iconClass = "bg-secondary text-primary";
  let amountPrefix = "";
  let Icon = Receipt;

  const isPayer = expense.paid_by === currentUserId;

  if (isPayer) {
    // Money going OUT
    bgClass = "bg-rose-500/5"; // soft pastel red background
    borderClass = "border-rose-500/10";
    iconClass = "bg-rose-500/10 text-rose-600 dark:text-rose-400";
    amountPrefix = "-";
  } else if (isSettlement) {
    // Money coming IN (received settlement)
    bgClass = "bg-emerald-500/5"; // soft pastel green background
    borderClass = "border-emerald-500/10";
    iconClass = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    amountPrefix = "+";
  }

  let title = cleanDescription;
  let subtitle = "";
  const noteText = isSettlement ? (descLower.includes("upi") ? "UPI" : "Cash") : "";

  const creatorDisplayName = isPayer
    ? "You"
    : creatorProfile?.full_name?.trim() ||
      creatorProfile?.username?.replace(/^@/, "").trim() ||
      "Someone";

  if (isSettlement) {
    Icon = HandCoins;
    title = descLower.includes("upi") ? "UPI Settlement" : "Cash Settlement";
    subtitle = isPayer ? "Settled by You" : `Settled with You`;
  } else {
    subtitle = isPayer ? "Added by You" : `Added by ${creatorDisplayName}`;
  }

  const [detailsOpen, setDetailsOpen] = useState(false);

  const handleCardClick = () => {
    setDetailsOpen(true);
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        className={cn(
          "flex items-start sm:items-center gap-3 sm:gap-3.5 rounded-2xl border p-3.5 sm:p-4 shadow-sm transition-all duration-200 cursor-pointer select-none overflow-hidden",
          "active:scale-[0.98] sm:hover:-translate-y-0.5 sm:hover:shadow-md",
          bgClass,
          borderClass,
        )}
      >
        <div
          className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", iconClass)}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
            <span className="font-semibold text-foreground text-sm truncate max-w-full">{title}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 break-words">{subtitle}</p>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 font-medium">
            {formatActivityTime(expense.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-right ml-auto pl-1">
          <div>
            <p className="font-display font-bold text-sm sm:text-base text-foreground whitespace-nowrap">
              {amountPrefix}
              <CountUpCurrency amount={Number(expense.amount)} />
            </p>
            {noteText && (
              <p className="text-xs text-muted-foreground mt-0.5 font-medium whitespace-nowrap">
                {noteText}
              </p>
            )}
          </div>
        </div>
      </div>
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
  const isSettlementRequest = notification.type === "settlement_request";
  const pending = notification.status === "pending";

  const isSenderCurrentUser = notification.sender_id === currentUserId;

  const senderDisplayName = isSenderCurrentUser
    ? "You"
    : senderProfile?.full_name?.trim() ||
      senderProfile?.username?.replace(/^@/, "").trim() ||
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
      <div
        onClick={handleCardClick}
        className={cn(
          "flex items-start sm:items-center gap-3 sm:gap-3.5 rounded-2xl border border-border bg-card p-3.5 sm:p-4 shadow-sm transition-all duration-200 cursor-pointer select-none overflow-hidden",
          "active:scale-[0.98] sm:hover:-translate-y-0.5 sm:hover:shadow-md",
        )}
      >
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            isInvite
              ? "bg-secondary text-primary"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
          )}
        >
          {isInvite ? <UserPlus className="h-5 w-5" /> : <HandCoins className="h-5 w-5" />}
        </div>

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

          {isInvite && pending ? (
            <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" onClick={onAccept} disabled={busy}>
                <Check className="mr-1 h-4 w-4" /> Accept
              </Button>
              <Button size="sm" variant="outline" onClick={onDecline} disabled={busy}>
                <X className="mr-1 h-4 w-4" /> Decline
              </Button>
            </div>
          ) : null}
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
      </div>

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
