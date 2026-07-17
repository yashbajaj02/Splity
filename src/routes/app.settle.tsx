import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Bell } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useSettleBalances } from "@/hooks/use-settle-balances";
import type { Balance } from "@/hooks/use-settle-balances";
import { sendSettlementRequest, settleByCash, settleByUpi } from "@/lib/api";
import { BalanceSummaryCards } from "@/components/BalanceSummaryCards";
import { CountUpCurrency } from "@/components/CountUpCurrency";
import { Button } from "@/components/ui/button";
import { UpiQrDialog } from "@/components/UpiQrDialog";

export const Route = createFileRoute("/app/settle")({
  component: SettlePage,
});

function SettlePage() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const queryClient = useQueryClient();

  const query = useSettleBalances(userId);

  const remind = useMutation({
    mutationFn: (v: { debtorId: string; amount: number }) =>
      sendSettlementRequest({
        recipientId: v.debtorId,
        senderId: userId,
        amount: v.amount,
        message: "Please settle up on SplitPay",
      }),
    onSuccess: () => {
      toast.success("Reminder sent!");
      queryClient.invalidateQueries({ queryKey: ["settle", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cashSettlement = useMutation({
    mutationFn: (v: { groupId: string; payeeId: string; amount: number }) =>
      settleByCash({
        groupId: v.groupId,
        payerId: userId,
        payeeId: v.payeeId,
        amount: v.amount,
      }),
    onSuccess: () => {
      toast.success("Cash payment recorded. They were notified.");
      queryClient.invalidateQueries({ queryKey: ["settle", userId] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upiSettlement = useMutation({
    mutationFn: (v: { groupId: string; payeeId: string; amount: number }) =>
      settleByUpi({
        groupId: v.groupId,
        payerId: userId,
        payeeId: v.payeeId,
        amount: v.amount,
      }),
    onSuccess: (_data, values) => {
      toast.success(`Payment of Rs ${values.amount.toFixed(2)} settled.`);
      queryClient.invalidateQueries({ queryKey: ["settle", userId] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="space-y-3 py-16 text-center">
        <h1 className="font-display text-xl font-bold">Balances could not load</h1>
        <p className="text-sm text-muted-foreground">{(query.error as Error).message}</p>
        <Button size="sm" variant="outline" onClick={() => query.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const data = query.data!;
  const totalOwe = data.iOwe.reduce((s, b) => s + b.amount, 0);
  const totalOwed = data.owedToMe.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Settle up</h1>
        <p className="text-sm text-muted-foreground">
          Balances are simplified across all your groups.
        </p>
      </div>

      <BalanceSummaryCards totalOwe={totalOwe} totalOwed={totalOwed} />

      <Section title="You owe" empty="You don't owe anyone. Nice!">
        {data.iOwe.map((b) => (
          <BalanceRow key={b.counterpartyId} b={b} negative>
            <UpiQrDialog
              payeeName={b.profile?.username ? `@${b.profile.username}` : "them"}
              payeeUpiId={b.profile?.upi_id ?? null}
              amount={b.amount}
              note="SplitPay settlement"
              onCashPaid={() => {
                if (!b.settlementGroupId) {
                  toast.error("No shared group found to record this payment.");
                  return;
                }
                cashSettlement.mutate({
                  groupId: b.settlementGroupId,
                  payeeId: b.counterpartyId,
                  amount: b.amount,
                });
              }}
              cashDisabled={!b.settlementGroupId}
              cashBusy={cashSettlement.isPending}
              onUpiPaid={() => {
                if (!b.settlementGroupId) {
                  toast.error("No shared group found to record this payment.");
                  return;
                }
                upiSettlement.mutate({
                  groupId: b.settlementGroupId,
                  payeeId: b.counterpartyId,
                  amount: b.amount,
                });
              }}
              upiBusy={upiSettlement.isPending}
            />
          </BalanceRow>
        ))}
      </Section>

      <Section title="Owed to you" empty="No one owes you right now.">
        {data.owedToMe.map((b) => (
          <BalanceRow key={b.counterpartyId} b={b}>
            <Button
              size="sm"
              variant="outline"
              disabled={remind.isPending}
              onClick={() => remind.mutate({ debtorId: b.counterpartyId, amount: b.amount })}
            >
              <Bell className="mr-1.5 h-4 w-4" /> Remind
            </Button>
          </BalanceRow>
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="space-y-3">
      <h2 className="font-display text-sm font-semibold text-muted-foreground">{title}</h2>
      {hasChildren ? (
        <div className="space-y-2">{children}</div>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-card/50 p-4 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      )}
    </div>
  );
}

function BalanceRow({
  b,
  negative,
  children,
}: {
  b: Balance;
  negative?: boolean;
  children: React.ReactNode;
}) {
  const name = b.profile?.username ? `@${b.profile.username}` : "Unknown user";
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold uppercase text-primary">
        {(b.profile?.username ?? "?").slice(0, 2)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{name}</p>
        <p className={`text-sm font-medium ${negative ? "text-destructive" : "text-success"}`}>
          <CountUpCurrency amount={b.amount} />
        </p>
      </div>
      {children}
    </div>
  );
}
