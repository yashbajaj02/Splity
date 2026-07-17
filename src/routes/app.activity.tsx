import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, HandCoins, Loader2, UserPlus, X } from "lucide-react";
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
} from "@/lib/api";
import type { AppNotification, Profile } from "@/lib/app-types";
import { Button } from "@/components/ui/button";
import { UpiQrDialog } from "@/components/UpiQrDialog";
import { CountUpCurrency } from "@/components/CountUpCurrency";

export const Route = createFileRoute("/app/activity")({
  component: ActivityPage,
});

function ActivityPage() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const queryClient = useQueryClient();

  const notifQuery = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => getNotifications(userId),
  });

  const senderIds = Array.from(
    new Set((notifQuery.data ?? []).map((notification) => notification.sender_id).filter(Boolean)),
  ) as string[];

  const profilesQuery = useQuery({
    queryKey: ["notification-senders", senderIds.sort().join(",")],
    queryFn: () => getNotificationSenderProfiles(senderIds),
    enabled: senderIds.length > 0,
  });

  const profileMap = new Map<string, Profile>(
    (profilesQuery.data ?? []).map((profile) => [profile.id, profile]),
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
  const pendingCount = notifications.filter(
    (notification) => notification.status === "pending",
  ).length;

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

      {notifQuery.isLoading ? (
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
              sender={notification.sender_id ? profileMap.get(notification.sender_id) : undefined}
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

function resolveSender(notification: AppNotification, profile?: Profile) {
  const username = profile?.username ?? notification.sender_username;
  const upiId = profile?.upi_id ?? notification.sender_upi;
  const name = username
    ? `@${username}`
    : profile?.full_name?.trim() || notification.sender_username || "Someone";
  return { name, upiId };
}

function NotificationCard({
  notification,
  sender,
  onAccept,
  onDecline,
  onDismiss,
  onMarkRead,
  busy,
}: {
  notification: AppNotification;
  sender?: Profile;
  onAccept: () => void;
  onDecline: () => void;
  onDismiss: () => void;
  onMarkRead: () => void;
  busy: boolean;
}) {
  const { name: senderName, upiId: senderUpi } = resolveSender(notification, sender);
  const isInvite = notification.type === "group_invite";
  const isSettlement = notification.type === "settlement_request";
  const isSettlementConfirmed = notification.type === "settlement_confirmed";
  const isExpenseAdded = notification.type === "expense_added";
  const pending = notification.status === "pending";
  const canOpenGroup = isInvite && !!notification.group_id && notification.status === "accepted";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            isInvite ? "bg-secondary text-primary" : "bg-accent/30 text-accent-foreground"
          }`}
        >
          {isInvite ? (
            <UserPlus className="h-5 w-5" />
          ) : isExpenseAdded ? (
            <Bell className="h-5 w-5" />
          ) : (
            <HandCoins className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-semibold">{senderName}</span>{" "}
            {isSettlement && notification.amount != null ? (
              <>
                requested{" "}
                <strong>
                  <CountUpCurrency amount={Number(notification.amount)} />
                </strong>
                {notification.message ? ` - ${notification.message}` : ""}
              </>
            ) : isSettlementConfirmed && notification.amount != null ? (
              <>
                confirmed{" "}
                <strong>
                  <CountUpCurrency amount={Number(notification.amount)} />
                </strong>{" "}
                {notification.message ?? "as paid."}
              </>
            ) : (
              notification.message
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {new Date(notification.created_at).toLocaleString()}
            {!pending ? ` · ${notification.status}` : ""}
          </p>

          {isInvite && pending ? (
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={onAccept} disabled={busy}>
                <Check className="mr-1 h-4 w-4" /> Accept
              </Button>
              <Button size="sm" variant="outline" onClick={onDecline} disabled={busy}>
                <X className="mr-1 h-4 w-4" /> Decline
              </Button>
            </div>
          ) : null}

          {canOpenGroup ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" asChild>
                <Link to="/app/group/$groupId" params={{ groupId: notification.group_id! }}>
                  Open group
                </Link>
              </Button>
              <Button size="sm" variant="outline" onClick={onDismiss} disabled={busy}>
                Dismiss
              </Button>
            </div>
          ) : null}

          {isSettlement && pending ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <UpiQrDialog
                payeeName={senderName}
                payeeUpiId={senderUpi}
                amount={Number(notification.amount ?? 0)}
                note="SplitPay settlement"
                trigger={
                  <Button size="sm">
                    <HandCoins className="mr-1 h-4 w-4" /> Settle up
                  </Button>
                }
              />
              <Button size="sm" variant="outline" onClick={onMarkRead} disabled={busy}>
                <CheckCheck className="mr-1 h-4 w-4" /> Mark as read
              </Button>
            </div>
          ) : null}

          {(isSettlementConfirmed || isExpenseAdded) && pending ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={onMarkRead} disabled={busy}>
                <CheckCheck className="mr-1 h-4 w-4" /> Mark as read
              </Button>
              {isExpenseAdded && notification.group_id ? (
                <Button size="sm" asChild>
                  <Link to="/app/group/$groupId" params={{ groupId: notification.group_id }}>
                    Open group
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : null}

          {!pending && !isInvite ? (
            <div className="mt-3">
              <Button size="sm" variant="ghost" onClick={onDismiss} disabled={busy}>
                Dismiss
              </Button>
            </div>
          ) : null}

          {isInvite && notification.status === "declined" ? (
            <div className="mt-3">
              <Button size="sm" variant="ghost" onClick={onDismiss} disabled={busy}>
                Dismiss
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
