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
  getNotificationSenderProfiles,
  markAllNotificationsRead,
  markNotificationRead,
  respondToInvite,
  getMyGroups,
} from "@/lib/api";
import type { AppNotification, Profile } from "@/lib/app-types";
import { Button } from "@/components/ui/button";
import { CountUpCurrency } from "@/components/CountUpCurrency";
import { ActivityDetailsSheet } from "@/components/ActivityDetailsSheet";

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

function ActivityPage() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const queryClient = useQueryClient();

  const notifQuery = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => getNotifications(userId),
    staleTime: 15_000,
  });

  const groupsQuery = useQuery({
    queryKey: ["my-groups", userId],
    queryFn: () => getMyGroups(userId),
    staleTime: 60_000,
  });

  const groupMap = useMemo(
    () => new Map((groupsQuery.data ?? []).map((g) => [g.id, g.name])),
    [groupsQuery.data],
  );

  const senderIds = useMemo(() => {
    return Array.from(
      new Set(
        (notifQuery.data ?? [])
          .map((notification) => notification.sender_id)
          .filter(Boolean),
      ),
    ) as string[];
  }, [notifQuery.data]);

  const profilesQuery = useQuery({
    queryKey: ["notification-senders", senderIds.sort().join(",")],
    queryFn: () => getNotificationSenderProfiles(senderIds),
    enabled: senderIds.length > 0,
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
    onError: (error: Error) => toast.error(error.message),
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
    onError: (error: Error) => toast.error(error.message),
  });

  const markRead = useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId),
    onSuccess: () => {
      toast.success("Marked as read");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const markAllRead = useMutation({
    mutationFn: () => markAllNotificationsRead(userId),
    onSuccess: () => {
      toast.success("All marked as read");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const notifications = notifQuery.data ?? [];
  const pendingCount = useMemo(
    () => notifications.filter((n) => n.status === "pending").length,
    [notifications],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Activity</h1>
          <p className="text-sm text-muted-foreground">
            Group invites, expense updates, and settlement requests.
          </p>
        </div>
        {notifications.length > 0 ? (
          <div className="flex flex-wrap justify-end gap-2">
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

      {notifQuery.isLoading && notifications.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : notifQuery.isError ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
            <Bell className="h-6 w-6" />
          </div>
          <h3 className="mt-4 font-display text-base font-semibold">Activity could not load</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {(notifQuery.error as Error).message}
          </p>
          <Button className="mt-5" size="sm" variant="outline" onClick={() => notifQuery.refetch()}>
            Try again
          </Button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
            <Bell className="h-6 w-6" />
          </div>
          <h3 className="mt-4 font-display text-base font-semibold">You're all caught up</h3>
          <p className="mt-1 text-sm text-muted-foreground">Notifications will show up here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              senderProfile={
                notification.sender_id ? profileMap.get(notification.sender_id) : undefined
              }
              groupName={notification.group_id ? groupMap.get(notification.group_id) : undefined}
              currentUserId={userId}
              onAccept={() =>
                respond.mutate({
                  notificationId: notification.id,
                  groupId: notification.group_id!,
                  accept: true,
                })
              }
              onDecline={() =>
                respond.mutate({
                  notificationId: notification.id,
                  groupId: notification.group_id!,
                  accept: false,
                })
              }
              onDismiss={() => dismiss.mutate(notification.id)}
              onMarkRead={() => markRead.mutate(notification.id)}
              busy={respond.isPending || dismiss.isPending || markRead.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const NotificationCard = memo(function NotificationCard({
  notification,
  senderProfile,
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
  const isSettlementConfirmed = notification.type === "settlement_confirmed";
  const isExpenseAdded = notification.type === "expense_added";
  const pending = notification.status === "pending";

  const isSenderCurrentUser = notification.sender_id === currentUserId;
  const senderDisplayName = isSenderCurrentUser
    ? "You"
    : senderProfile?.full_name?.trim() ||
      senderProfile?.username?.trim() ||
      notification.sender_username ||
      "Someone";

  const counterpartyId = notification.sender_id || "";

  let actionText = "";
  let noteText = "";

  if (isExpenseAdded) {
    actionText = "Added an expense";
    noteText = notification.message || "Expense";
  } else if (isSettlementRequest) {
    actionText = "Requested a settlement";
    noteText = "Pending Balance";
  } else if (isSettlementConfirmed) {
    if (isSenderCurrentUser) {
      actionText = `Paid ${senderDisplayName}`;
      noteText = notification.message?.toLowerCase().includes("upi") ? "UPI" : "Cash";
    } else {
      actionText = "Paid you";
      noteText = notification.message?.toLowerCase().includes("upi") ? "UPI" : "Cash";
    }
  } else if (isInvite) {
    actionText = "Invited you to join group";
  }

  const handleCardClick = () => {
    if (isInvite) {
      if (notification.group_id) {
        navigate({ to: "/app/group/$groupId", params: { groupId: notification.group_id } });
      }
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
        className="flex items-center gap-3.5 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-secondary/30 cursor-pointer select-none"
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            isInvite
              ? "bg-secondary text-primary"
              : isExpenseAdded
                ? "bg-primary/10 text-primary"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {isInvite ? (
            <UserPlus className="h-5 w-5" />
          ) : isExpenseAdded ? (
            <Receipt className="h-5 w-5" />
          ) : (
            <HandCoins className="h-5 w-5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-foreground text-sm">{senderDisplayName}</span>
            {groupName && (
              <span className="text-xs text-muted-foreground font-medium">({groupName})</span>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-0.5">{actionText}</p>

          <p className="text-xs text-muted-foreground mt-1 font-medium">
            {formatActivityTime(notification.created_at)}
          </p>

          {isInvite && pending ? (
            <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" onClick={onAccept} disabled={busy}>
                <Check className="mr-1 h-4 w-4" /> Accept
              </Button>
              <Button size="sm" variant="outline" onClick={onDecline} disabled={busy}>
                <X className="mr-1 h-4 w-4" /> Decline
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 shrink-0 text-right">
          {notification.amount != null ? (
            <div>
              <p className="font-display font-bold text-base text-foreground">
                <CountUpCurrency amount={Number(notification.amount)} />
              </p>
              {noteText && (
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">{noteText}</p>
              )}
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
