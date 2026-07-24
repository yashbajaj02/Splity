import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Bell, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useSettleBalances } from "@/hooks/use-settle-balances";
import type { Balance } from "@/hooks/use-settle-balances";
import { sendSettlementRequest } from "@/lib/api";
import { BalanceSummaryCards } from "@/components/BalanceSummaryCards";
import { CountUpCurrency } from "@/components/CountUpCurrency";
import { Button } from "@/components/ui/button";
import { QrPayDialog } from "@/components/QrPayDialog";
import { PaidDialog } from "@/components/PaidDialog";
import { ExpenseBreakdownSheet } from "@/components/ExpenseBreakdownSheet";

export const Route = createFileRoute("/app/settle")({
  component: SettlePage,
});

function SettlePage() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const query = useSettleBalances(userId ?? "");

  const remind = useMutation({
    mutationFn: (v: { debtorId: string; amount: number }) =>
      sendSettlementRequest({
        recipientId: v.debtorId,
        senderId: userId!,
        amount: v.amount,
        message: "Please settle up on SplitPay",
      }),
    onSuccess: () => {
      toast.success("Reminder sent!");
      queryClient.invalidateQueries({ queryKey: ["settle", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalOwe = useMemo(
    () => query.data?.iOwe.reduce((s, b) => s + b.amount, 0) ?? 0,
    [query.data?.iOwe],
  );
  const totalOwed = useMemo(
    () => query.data?.owedToMe.reduce((s, b) => s + b.amount, 0) ?? 0,
    [query.data?.owedToMe],
  );

  if (query.isPending || !userId) {
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
          <BalanceRow key={b.counterpartyId} b={b} userId={userId} negative>
            <div className="flex gap-2 shrink-0">
              <QrPayDialog
                payeeName={b.profile?.full_name?.trim() || b.profile?.username?.trim() || "them"}
                payeeUpiId={b.profile?.upi_id ?? null}
                amount={b.amount}
                note="Splity settlement"
              />
              <PaidDialog
                payeeName={b.profile?.full_name?.trim() || b.profile?.username?.trim() || "them"}
                groupName={b.settlementGroupName}
                amount={b.amount}
                groupId={b.settlementGroupId}
                payeeId={b.counterpartyId}
                payerId={userId}
              />
            </div>
          </BalanceRow>
        ))}
      </Section>

      <Section title="Owed to you" empty="No one owes you right now.">
        {data.owedToMe.map((b) => (
          <BalanceRow key={b.counterpartyId} b={b} userId={userId}>
            <RemindButton
              debtorId={b.counterpartyId}
              isPending={remind.isPending}
              onRemind={() => remind.mutate({ debtorId: b.counterpartyId, amount: b.amount })}
            />
          </BalanceRow>
        ))}
      </Section>
    </div>
  );
}

function RemindButton({
  onRemind,
  isPending,
  debtorId,
}: {
  onRemind: () => void;
  isPending: boolean;
  debtorId: string;
}) {
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(() => {
    const saved = localStorage.getItem(`remind_cooldown_${debtorId}`);
    if (!saved) return null;
    const end = parseInt(saved, 10);
    return end > Date.now() ? end : null;
  });

  const [remainingMs, setRemainingMs] = useState<number>(() => {
    return cooldownEnd ? Math.max(0, cooldownEnd - Date.now()) : 0;
  });

  useEffect(() => {
    if (!cooldownEnd) return;

    const interval = setInterval(() => {
      const left = cooldownEnd - Date.now();
      if (left <= 0) {
        setCooldownEnd(null);
        setRemainingMs(0);
        localStorage.removeItem(`remind_cooldown_${debtorId}`);
      } else {
        setRemainingMs(left);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownEnd, debtorId]);

  const handleRemind = () => {
    onRemind();
    const end = Date.now() + 5 * 60 * 1000;
    setCooldownEnd(end);
    setRemainingMs(5 * 60 * 1000);
    localStorage.setItem(`remind_cooldown_${debtorId}`, end.toString());
  };

  if (cooldownEnd && remainingMs > 0) {
    const totalSec = Math.ceil(remainingMs / 1000);
    const m = Math.floor(totalSec / 60);
    const s = (totalSec % 60).toString().padStart(2, "0");

    return (
      <Button size="sm" variant="outline" disabled className="shrink-0 text-xs font-medium">
        <Check className="mr-1 h-3.5 w-3.5 text-primary" />
        Reminder Sent ({m}m {s}s)
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={handleRemind}
      className="shrink-0"
    >
      <Bell className="mr-1.5 h-4 w-4" /> Remind
    </Button>
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
  userId,
  children,
}: {
  b: Balance;
  negative?: boolean;
  userId: string;
  children: React.ReactNode;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const displayName = b.profile?.full_name?.trim() || b.profile?.username?.trim() || "Unknown user";
  const groupName = b.settlementGroupName;

  return (
    <>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-secondary/30">
        <div
          onClick={() => setSheetOpen(true)}
          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer group select-none"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold uppercase text-primary transition-transform group-hover:scale-105">
            {displayName.slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center min-w-0 gap-1.5">
              <span className="font-semibold text-foreground shrink-0 group-hover:text-primary transition-colors">
                {displayName}
              </span>
              {groupName && (
                <span className="text-sm text-muted-foreground truncate max-w-[120px] sm:max-w-[180px]">
                  ({groupName})
                </span>
              )}
            </div>
            <p className={`text-sm font-medium ${negative ? "text-destructive" : "text-success"}`}>
              <CountUpCurrency amount={b.amount} />
            </p>
          </div>
        </div>
        {children}
      </div>

      <ExpenseBreakdownSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        currentUserId={userId}
        counterpartyId={b.counterpartyId}
        displayName={displayName}
        groupName={groupName}
        balanceAmount={b.amount}
      />
    </>
  );
}
