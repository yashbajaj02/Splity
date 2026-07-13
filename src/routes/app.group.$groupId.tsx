import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  ArrowLeft,
  UserPlus,
  Receipt,
  Clock,
  QrCode,
  LogOut,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  getGroup,
  getGroupMembers,
  getGroupExpenses,
  getSplitsForExpenses,
  getProfilesByIds,
  findUserByUsername,
  inviteToGroup,
  leaveGroup,
  deleteGroup,
} from "@/lib/api";
import type { ExpenseSplit, Profile } from "@/lib/app-types";
import {
  computeNetBalances,
  simplifyDebts,
  formatCurrency,
} from "@/lib/debt";
import { AddExpenseDialog } from "@/components/AddExpenseDialog";
import { CountUpCurrency } from "@/components/CountUpCurrency";
import { UpiQrDialog } from "@/components/UpiQrDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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

export const Route = createFileRoute("/app/group/$groupId")({
  component: GroupDetail,
});

function GroupDetail() {
  const { groupId } = Route.useParams();
  const { session } = useAuth();
  const userId = session!.user.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  const memberIds = (membersQuery.data ?? []).map((m) => m.user_id);
  const profilesQuery = useQuery({
    queryKey: ["profiles", memberIds.sort().join(",")],
    queryFn: () => getProfilesByIds(memberIds),
    enabled: memberIds.length > 0,
  });
  const pmap = new Map<string, Profile>(
    (profilesQuery.data ?? []).map((p) => [p.id, p]),
  );
  const nameOf = (id: string) => {
    if (id === userId) return "You";
    const p = pmap.get(id);
    return p?.username ? `@${p.username}` : "user";
  };

  const expenseIds = (expensesQuery.data ?? []).map((e) => e.id);
  const splitsQuery = useQuery({
    queryKey: ["group-splits", groupId, expenseIds.join(",")],
    queryFn: () => getSplitsForExpenses(expenseIds),
    enabled: expenseIds.length > 0,
  });

  const leaveMutation = useMutation({
    mutationFn: () => leaveGroup(groupId, userId),
    onSuccess: () => {
      toast.success("Left the group");
      queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
      navigate({ to: "/app" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteGroup(groupId),
    onSuccess: () => {
      toast.success("Group deleted");
      queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
      navigate({ to: "/app" });
    },
    onError: (e: Error) => toast.error(e.message),
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
        <p className="text-sm font-medium text-foreground">
          Could not load this group.
        </p>
        <p className="text-sm text-muted-foreground">
          {(groupQuery.error as Error).message}
        </p>
        <Button variant="outline" size="sm" onClick={() => groupQuery.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (!groupQuery.data) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Group not found.
      </div>
    );
  }

  const group = groupQuery.data;
  const members = membersQuery.data ?? [];
  const acceptedMembers = members.filter((m) => m.status === "accepted");
  const pendingMembers = members.filter((m) => m.status === "pending");
  const expenses = expensesQuery.data ?? [];

  // Simplified balances within the group.
  const splitsByExpense: Record<string, ExpenseSplit[]> = {};
  for (const s of splitsQuery.data ?? []) {
    (splitsByExpense[s.expense_id] ??= []).push(s);
  }
  const balances = computeNetBalances(expenses, splitsByExpense);
  const simplified = simplifyDebts(balances);
  const isCreator = group.created_by === userId;
  const isMember = acceptedMembers.some((m) => m.user_id === userId);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/app"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Groups
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold">{group.name}</h1>
        {group.description && (
          <p className="text-sm text-muted-foreground">{group.description}</p>
        )}
      </div>

      {/* Members */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-muted-foreground">
            Members ({acceptedMembers.length})
          </h2>
          <InviteDialog
            groupId={groupId}
            groupName={group.name}
            inviterId={userId}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {acceptedMembers.map((m) => (
            <span
              key={m.id}
              className="rounded-full bg-secondary px-3 py-1 text-sm font-medium text-primary"
            >
              {nameOf(m.user_id)}
            </span>
          ))}
          {pendingMembers.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-sm text-muted-foreground"
            >
              <Clock className="h-3 w-3" /> {nameOf(m.user_id)}
            </span>
          ))}
        </div>
      </section>

      {/* Balances */}
      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold text-muted-foreground">
          Who owes whom
        </h2>
        {simplified.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/50 p-4 text-center text-sm text-muted-foreground">
            Everyone's settled up.
          </p>
        ) : (
          <div className="space-y-2">
            {simplified.map((d, idx) => {
              const creditor = pmap.get(d.to);
              const debtText =
                d.from === userId
                  ? `You owe ${nameOf(d.to)}`
                  : d.to === userId
                    ? `${nameOf(d.from)} owes you`
                    : `${nameOf(d.from)} owes ${nameOf(d.to)}`;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="min-w-0 flex-1 text-sm">
                    <span className="font-semibold">{debtText}</span>
                    <span className="ml-1 font-display font-bold text-primary">
                      <CountUpCurrency amount={d.amount} />
                    </span>
                  </div>
                  {d.from === userId && (
                    <UpiQrDialog
                      payeeName={nameOf(d.to)}
                      payeeUpiId={creditor?.upi_id ?? null}
                      amount={d.amount}
                      note={`SplitPay · ${group.name}`}
                      trigger={
                        <Button size="sm">
                          <QrCode className="mr-1.5 h-4 w-4" /> Pay
                        </Button>
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Expenses */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-muted-foreground">
            Expenses
          </h2>
          <AddExpenseDialog
            groupId={groupId}
            userId={userId}
            members={acceptedMembers.map((m) => ({
              id: m.user_id,
              name: nameOf(m.user_id),
            }))}
            trigger={
              <Button size="sm">
                Add expense
              </Button>
            }
          />
        </div>
        {expenses.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/50 p-4 text-center text-sm text-muted-foreground">
            No expenses yet. Add the first one!
          </p>
        ) : (
          <div className="space-y-2">
            {expenses.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                  <Receipt className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{e.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {nameOf(e.paid_by)} paid ·{" "}
                    {new Date(e.created_at).toLocaleDateString()}
                  </p>
                </div>
                <p className="font-display font-bold">
                  <CountUpCurrency amount={Number(e.amount)} />
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {(isMember || isCreator) && (
        <section className="space-y-3 border-t border-border pt-4">
          <h2 className="font-display text-sm font-semibold text-muted-foreground">
            Group settings
          </h2>
          <div className="flex flex-wrap gap-2">
            {isMember && !isCreator && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <LogOut className="mr-1.5 h-4 w-4" /> Leave group
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Leave this group?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You won't see expenses or balances for "{group.name}"
                      anymore. You can be re-invited later.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => leaveMutation.mutate()}
                      disabled={leaveMutation.isPending}
                    >
                      Leave
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {isCreator && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="mr-1.5 h-4 w-4" /> Delete group
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete "{group.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes the group, all expenses, and
                      member data. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </section>
      )}
    </div>
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
      if (user.id === inviterId)
        throw new Error("You're already in this group.");
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
    onError: (e: Error) => toast.error(e.message),
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
          onSubmit={(e) => {
            e.preventDefault();
            if (!username.trim()) return;
            mutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Username</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="friend_username"
              autoCapitalize="none"
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Send invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
