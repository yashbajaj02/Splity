import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, Loader2, LogOut, QrCode, Receipt, Trash2, UserPlus } from "lucide-react";
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
  settleByCash,
  settleByUpi,
} from "@/lib/api";
import type { Expense, ExpenseSplit, PairwiseDebt, Profile } from "@/lib/app-types";
import { computePairwiseDebts } from "@/lib/debt";
import { supabase } from "@/lib/supabase";
import { AddExpenseDialog } from "@/components/AddExpenseDialog";
import { CountUpCurrency } from "@/components/CountUpCurrency";
import { UpiQrDialog } from "@/components/UpiQrDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [visibleExpenseCount, setVisibleExpenseCount] = useState(5);

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

  const profileMap = new Map<string, Profile>(
    (profilesQuery.data ?? []).map((profile) => [profile.id, profile]),
  );
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

  const cashSettlement = useMutation({
    mutationFn: (values: { payeeId: string; amount: number }) =>
      settleByCash({
        groupId,
        payerId: userId,
        payeeId: values.payeeId,
        amount: values.amount,
      }),
    onSuccess: () => {
      toast.success("Cash payment recorded. They were notified.");
      queryClient.invalidateQueries({ queryKey: ["group-expenses", groupId] });
      queryClient.invalidateQueries({ queryKey: ["settle", userId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const upiSettlement = useMutation({
    mutationFn: (values: { payeeId: string; amount: number }) =>
      settleByUpi({
        groupId,
        payerId: userId,
        payeeId: values.payeeId,
        amount: values.amount,
      }),
    onSuccess: (_data, values) => {
      toast.success(`Payment of Rs ${values.amount.toFixed(2)} settled.`);
      queryClient.invalidateQueries({ queryKey: ["group-expenses", groupId] });
      queryClient.invalidateQueries({ queryKey: ["settle", userId] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
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

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-muted-foreground">
            Members ({acceptedMembers.length})
          </h2>
          <InviteDialog groupId={groupId} groupName={group.name} inviterId={userId} />
        </div>
        <div className="flex flex-wrap gap-2">
          {acceptedMembers.map((member) => (
            <span
              key={member.id}
              className="rounded-full bg-secondary px-3 py-1 text-sm font-medium text-primary"
            >
              {nameOf(member.user_id)}
            </span>
          ))}
          {pendingMembers.map((member) => (
            <span
              key={member.id}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-sm text-muted-foreground"
            >
              <Clock className="h-3 w-3" /> {nameOf(member.user_id)}
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold text-muted-foreground">Who owes whom</h2>
        {visibleDebts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/50 p-4 text-center text-sm text-muted-foreground">
            Everyone's settled up.
          </p>
        ) : (
          <div className="space-y-2">
            {visibleDebts.map((debt) => (
              <DebtRow
                key={`${debt.from}-${debt.to}`}
                debt={debt}
                userId={userId}
                nameOf={nameOf}
                payeeUpiId={profileMap.get(debt.to)?.upi_id ?? null}
                cashBusy={cashSettlement.isPending}
                upiBusy={upiSettlement.isPending}
                onUpiPaid={(paidAmount) =>
                  upiSettlement.mutate({
                    payeeId: debt.to,
                    amount: paidAmount,
                  })
                }
                onCashPaid={(paidAmount) =>
                  cashSettlement.mutate({
                    payeeId: debt.to,
                    amount: paidAmount,
                  })
                }
                groupName={group.name}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-muted-foreground">Expenses</h2>
          <AddExpenseDialog
            groupId={groupId}
            userId={userId}
            members={acceptedMembers.map((member) => ({
              id: member.user_id,
              name: nameOf(member.user_id),
            }))}
            trigger={<Button size="sm">Add expense</Button>}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>From date</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(event) => {
                setFromDate(event.target.value);
                setVisibleExpenseCount(5);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>To date</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(event) => {
                setToDate(event.target.value);
                setVisibleExpenseCount(5);
              }}
            />
          </div>
        </div>
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
                creatorName={nameOf(expense.created_by)}
                payerName={nameOf(expense.paid_by)}
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

function DebtRow({
  debt,
  userId,
  nameOf,
  payeeUpiId,
  cashBusy,
  upiBusy,
  onUpiPaid,
  onCashPaid,
  groupName,
}: {
  debt: PairwiseDebt;
  userId: string;
  nameOf: (id: string) => string;
  payeeUpiId: string | null;
  cashBusy: boolean;
  upiBusy: boolean;
  onUpiPaid: (paidAmount: number) => void;
  onCashPaid: (paidAmount: number) => void;
  groupName: string;
}) {
  const debtText =
    debt.from === userId
      ? `You owe ${nameOf(debt.to)}`
      : debt.to === userId
        ? `${nameOf(debt.from)} owes you`
        : `${nameOf(debt.from)} owes ${nameOf(debt.to)}`;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">{debtText}</span>
        <span className="ml-1 font-display font-bold text-primary">
          <CountUpCurrency amount={debt.amount} />
        </span>
      </div>
      {debt.from === userId ? (
        <UpiQrDialog
          payeeName={nameOf(debt.to)}
          payeeUpiId={payeeUpiId}
          amount={debt.amount}
          note={`SplitPay - ${groupName}`}
          onUpiPaid={onUpiPaid}
          upiBusy={upiBusy}
          onCashPaid={onCashPaid}
          cashBusy={cashBusy}
          trigger={
            <Button size="sm">
              <QrCode className="mr-1.5 h-4 w-4" /> Pay
            </Button>
          }
        />
      ) : null}
    </div>
  );
}

function ExpenseRow({
  expense,
  currentUserId,
  creatorName,
  payerName,
  canRemove,
  removeBusy,
  onRemove,
}: {
  expense: Expense;
  currentUserId: string;
  creatorName: string;
  payerName: string;
  canRemove: boolean;
  removeBusy: boolean;
  onRemove: () => void;
}) {
  const canShowRemove = expense.created_by === currentUserId && canRemove;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
        <Receipt className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{expense.description}</p>
        <p className="text-xs text-muted-foreground">
          {creatorName} added · {payerName} paid · {new Date(expense.created_at).toLocaleString()}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <p className="font-display font-bold">
          <CountUpCurrency amount={Number(expense.amount)} />
        </p>
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
}

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
