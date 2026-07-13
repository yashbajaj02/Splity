import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Bell,
  UserPlus,
  HandCoins,
  Check,
  X,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  getNotifications,
  getNotificationSenderProfiles,
  respondToInvite,
  dismissNotification,
  markNotificationRead,
  markAllNotificationsRead,
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
    new Set((notifQuery.data ?? []).map((n) => n.sender_id).filter(Boolean)),
  ) as string[];

  const profilesQuery = useQuery({
    queryKey: ["notification-senders", senderIds.sort().join(",")],
    queryFn: () => getNotificationSenderProfiles(senderIds),
    enabled: senderIds.length > 0,
  });

  const profileMap = new Map<string, Profile>(
    (profilesQuery.data ?? []).map((p) => [p.id, p]),
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
  };

  const respond = useMutation({
    mutationFn: (v: {
      notificationId: string;
      groupId: string;
      accept: boolean;
    }) =>
      respondToInvite({
        notificationId: v.notificationId,
        groupId: v.groupId,
        userId,
        accept: v.accept,
      }),
    onSuccess: (_d, v) => {
      toast.success(v.accept ? "Joined the group!" : "Invite declined");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => dismissNotification(id),
    onSuccess: invalidate,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      toast.success("Marked as read");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markAllRead = useMutation({
    mutationFn: () => markAllNotificationsRead(userId),
    onSuccess: () => {
      toast.success("All marked as read");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const notifications = notifQuery.data ?? [];
  const pendingSettlementCount = notifications.filter(
    (n) => n.status === "pending" && n.type === "settlement_request",
  ).length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Activity</h1>
          <p className="text-sm text-muted-foreground">
            Group invites and settlement requests.
          </p>
        </div>
        {pendingSettlementCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            disabled={markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            <CheckCheck className="mr-1.5 h-4 w-4" />
            Mark requests read
          </Button>
        )}
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
          <h3 className="mt-4 font-display text-base font-semibold">
            Activity could not load
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {(notifQuery.error as Error).message}
          </p>
          <Button
            className="mt-5"
            size="sm"
            variant="outline"
            onClick={() => notifQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
            <Bell className="h-6 w-6" />
          </div>
          <h3 className="mt-4 font-display text-base font-semibold">
            You're all caught up
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Notifications will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <NotificationCard
              key={n.id}
              n={n}
              sender={n.sender_id ? profileMap.get(n.sender_id) : undefined}
              onAccept={() =>
                respond.mutate({
                  notificationId: n.id,
                  groupId: n.group_id!,
                  accept: true,
                })
              }
              onDecline={() =>
                respond.mutate({
                  notificationId: n.id,
                  groupId: n.group_id!,
                  accept: false,
                })
              }
              onDismiss={() => dismiss.mutate(n.id)}
              onMarkRead={() => markRead.mutate(n.id)}
              busy={respond.isPending || dismiss.isPending || markRead.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function resolveSender(n: AppNotification, profile?: Profile) {
  const username = profile?.username ?? n.sender_username;
  const upiId = profile?.upi_id ?? n.sender_upi;
  const name = username
    ? `@${username}`
    : profile?.full_name?.trim() || n.sender_username || "Someone";
  return { name, upiId };
}

function NotificationCard({
  n,
  sender,
  onAccept,
  onDecline,
  onDismiss,
  onMarkRead,
  busy,
}: {
  n: AppNotification;
  sender?: Profile;
  onAccept: () => void;
  onDecline: () => void;
  onDismiss: () => void;
  onMarkRead: () => void;
  busy: boolean;
}) {
  const { name: senderName, upiId: senderUpi } = resolveSender(n, sender);
  const isInvite = n.type === "group_invite";
  const isSettlement = n.type === "settlement_request";
  const pending = n.status === "pending";
  const canOpenGroup = isInvite && !!n.group_id && n.status === "accepted";

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
          ) : (
            <HandCoins className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-semibold">{senderName}</span>{" "}
            {isSettlement && n.amount != null ? (
              <>
                requested{" "}
                <strong>
                  <CountUpCurrency amount={Number(n.amount)} />
                </strong>
                {n.message ? ` — ${n.message}` : ""}
              </>
            ) : (
              n.message
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {new Date(n.created_at).toLocaleString()}
            {!pending && ` · ${n.status}`}
          </p>

          {isInvite && pending && (
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={onAccept} disabled={busy}>
                <Check className="mr-1 h-4 w-4" /> Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onDecline}
                disabled={busy}
              >
                <X className="mr-1 h-4 w-4" /> Decline
              </Button>
            </div>
          )}

          {canOpenGroup && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" asChild>
                <Link
                  to="/app/group/$groupId"
                  params={{ groupId: n.group_id! }}
                >
                  Open group
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onDismiss}
                disabled={busy}
              >
                Dismiss
              </Button>
            </div>
          )}

          {isSettlement && pending && (
            <div className="mt-3 flex flex-wrap gap-2">
              <UpiQrDialog
                payeeName={senderName}
                payeeUpiId={senderUpi}
                amount={Number(n.amount ?? 0)}
                note="SplitPay settlement"
                trigger={
                  <Button size="sm">
                    <HandCoins className="mr-1 h-4 w-4" /> Settle up
                  </Button>
                }
              />
              <Button
                size="sm"
                variant="outline"
                onClick={onMarkRead}
                disabled={busy}
              >
                <CheckCheck className="mr-1 h-4 w-4" /> Mark as read
              </Button>
            </div>
          )}

          {!pending && !isInvite && (
            <div className="mt-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                disabled={busy}
              >
                Dismiss
              </Button>
            </div>
          )}

          {isInvite && n.status === "declined" && (
            <div className="mt-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                disabled={busy}
              >
                Dismiss
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
