import { getCleanErrorMessage } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Bell, Check, Info, ArrowRight, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useSettleBalances } from "@/hooks/use-settle-balances";
import type { Balance } from "@/hooks/use-settle-balances";
import { sendSettlementRequest } from "@/lib/api";
import { CountUpCurrency } from "@/components/CountUpCurrency";
import { BalanceCard } from "@/components/BalanceCard";
import { Button } from "@/components/ui/button";
import { QrPayDialog } from "@/components/QrPayDialog";
import { PaidDialog } from "@/components/PaidDialog";
import { ExpenseBreakdownSheet } from "@/components/ExpenseBreakdownSheet";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

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
        message: "Please settle up on Splity",
      }),
    onSuccess: () => {
      toast.success("Reminder sent!");
      queryClient.invalidateQueries({ queryKey: ["settle", userId] });
    },
    onError: (e: Error) => toast.error(getCleanErrorMessage(e)),
  });

  const totalOwe = useMemo(
    () => query.data?.iOwe.reduce((s, b) => s + b.amount, 0) ?? 0,
    [query.data?.iOwe],
  );
  const totalOwed = useMemo(
    () => query.data?.owedToMe.reduce((s, b) => s + b.amount, 0) ?? 0,
    [query.data?.owedToMe],
  );

  const netBalance = totalOwed - totalOwe;

  if (query.isPending || !userId) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="space-y-3 py-16 text-center">
        <h1 className="font-display text-lg font-bold">Balances could not load</h1>
        <p className="text-xs text-slate-500">{(query.error as Error).message}</p>
        <Button size="sm" variant="outline" onClick={() => query.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const data = query.data!;

  return (
    <div className="space-y-4">
      {/* Screen 3 Top Bar: Title + Info button */}
      <div className="flex items-center justify-between pt-1">
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          Settle Up
        </h1>
        <button
          type="button"
          onClick={() => toast.info("Balances are simplified across all mutual groups.")}
          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Info"
        >
          <Info className="w-5 h-5 stroke-[2]" />
        </button>
      </div>

      {/* Interactive Balance Card with State Switcher & Moving Wave */}
      <BalanceCard totalOwe={totalOwe} totalOwed={totalOwed} />

      {/* Screen 3: "You owe" Section */}
      <div className="space-y-2.5">
        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
          You owe
        </h3>
        {data.iOwe.length === 0 ? (
          <div className="p-4 rounded-2xl bg-white border border-slate-100 text-center text-xs text-slate-400 font-medium">
            You don't owe anyone. You're all settled!
          </div>
        ) : (
          <div className="space-y-2">
            {data.iOwe.map((b, idx) => (
              <BalanceItemRow
                key={b.counterpartyId}
                b={b}
                userId={userId}
                negative
                index={idx}
              />
            ))}
          </div>
        )}
      </div>

      {/* Screen 3: "Owed to you" Section */}
      <div className="space-y-2.5">
        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
          Owed to you
        </h3>
        {data.owedToMe.length === 0 ? (
          <div className="p-4 rounded-2xl bg-white border border-slate-100 text-center text-xs text-slate-400 font-medium">
            No one owes you right now.
          </div>
        ) : (
          <div className="space-y-2">
            {data.owedToMe.map((b, idx) => (
              <BalanceItemRow
                key={b.counterpartyId}
                b={b}
                userId={userId}
                index={idx}
                onRemind={() => remind.mutate({ debtorId: b.counterpartyId, amount: b.amount })}
                remindBusy={remind.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Screen 3: Bottom "Settle Up Now" button */}
      {data.iOwe.length > 0 && (
        <div className="pt-2">
          <QrPayDialog
            payeeName={data.iOwe[0].profile?.full_name?.trim() || data.iOwe[0].profile?.username?.trim() || "friend"}
            payeeUpiId={data.iOwe[0].profile?.upi_id ?? null}
            amount={data.iOwe[0].amount}
            note="Splity settlement"
            currentUserId={userId}
            counterpartyId={data.iOwe[0].counterpartyId}
            groupId={data.iOwe[0].settlementGroupId ?? undefined}
            trigger={
              <button
                type="button"
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-800 hover:to-emerald-700 text-white font-bold flex items-center justify-center gap-2 shadow-[var(--shadow-2)] transition-all duration-150 active:scale-[0.98] hover:scale-[1.01] hover:shadow-[var(--shadow-glow-green)] animate-settle-glow"
              >
                <span>Settle Up Now</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}

function BalanceItemRow({
  b,
  userId,
  negative,
  onRemind,
  remindBusy,
  index = 0,
}: {
  b: Balance;
  userId: string;
  negative?: boolean;
  onRemind?: () => void;
  remindBusy?: boolean;
  index?: number;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const displayName = b.profile?.full_name?.trim() || b.profile?.username?.trim() || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  const [cooldownEnd, setCooldownEnd] = useState<number | null>(() => {
    const saved = localStorage.getItem(`remind_cooldown_${b.counterpartyId}`);
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
        localStorage.removeItem(`remind_cooldown_${b.counterpartyId}`);
      } else {
        setRemainingMs(left);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownEnd, b.counterpartyId]);

  const handleRemindClick = () => {
    if (onRemind) {
      onRemind();
      const end = Date.now() + 5 * 60 * 1000;
      setCooldownEnd(end);
      setRemainingMs(5 * 60 * 1000);
      localStorage.setItem(`remind_cooldown_${b.counterpartyId}`, end.toString());
    }
  };

  return (
    <>
      <div
        style={{ "--stagger": index } as React.CSSProperties}
        className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-slate-100 shadow-[var(--shadow-1)] card-hover-green animate-stagger-item"
      >
        {/* Left: Avatar & Name (tap to view breakdown) */}
        <div
          onClick={() => setSheetOpen(true)}
          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer select-none"
        >
          <Avatar className="w-10 h-10 rounded-full shrink-0 shadow-2xs">
            <AvatarImage src={b.profile?.avatar_url || undefined} alt={displayName} />
            <AvatarFallback className={`font-bold text-xs ${negative ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-display font-bold text-sm text-slate-900 truncate">
              {displayName}
            </p>
            {b.settlementGroupName && (
              <p className="text-xs text-slate-400 font-medium truncate">
                {b.settlementGroupName}
              </p>
            )}
          </div>
        </div>

        {/* Right: Amount and Action Button (Pay / Remind) */}
        <div className="flex items-center gap-3 shrink-0 pl-2">
          <p className={`font-display font-bold text-sm ${negative ? "text-rose-500" : "text-emerald-600"}`}>
            ₹{b.amount.toFixed(2)}
          </p>

          {negative ? (
            <div className="flex items-center gap-1.5">
              <QrPayDialog
                payeeName={displayName}
                payeeUpiId={b.profile?.upi_id ?? null}
                amount={b.amount}
                note="Splity settlement"
                currentUserId={userId}
                counterpartyId={b.counterpartyId}
                groupId={b.settlementGroupId ?? undefined}
                trigger={
                  <button
                    type="button"
                    className="px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all duration-150 active:scale-[0.98] hover:scale-[1.02] hover:shadow-[var(--shadow-glow-green)] animate-settle-glow"
                  >
                    Pay
                  </button>
                }
              />
              <PaidDialog
                payeeName={displayName}
                groupName={b.settlementGroupName}
                amount={b.amount}
                groupId={b.settlementGroupId}
                payeeId={b.counterpartyId}
                payerId={userId}
              />
            </div>
          ) : (
            <button
              type="button"
              disabled={remindBusy || (!!cooldownEnd && remainingMs > 0)}
              onClick={handleRemindClick}
              className="px-3.5 py-1.5 rounded-full border border-emerald-500 text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 text-xs font-bold transition-all duration-150 active:scale-[0.98] hover:scale-[1.02] hover:shadow-sm"
            >
              {cooldownEnd && remainingMs > 0 ? (
                <span className="flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-600" />
                  Sent
                </span>
              ) : (
                "Remind"
              )}
            </button>
          )}
        </div>
      </div>

      <ExpenseBreakdownSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        currentUserId={userId}
        counterpartyId={b.counterpartyId}
        displayName={displayName}
        groupName={b.settlementGroupName}
        balanceAmount={b.amount}
        negative={negative}
        groupId={b.settlementGroupId}
        payeeUpiId={b.profile?.upi_id ?? null}
        onRemind={handleRemindClick}
        remindBusy={remindBusy}
        remindSent={!!cooldownEnd && remainingMs > 0}
      />
    </>
  );
}
