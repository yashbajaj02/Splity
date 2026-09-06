import { getCleanErrorMessage, getInitials } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  addExpense,
  getCleanMemberName,
  getGroupMembers,
  getProfilesByIds,
  parseExpenseDescription,
  updateExpense,
} from "@/lib/api";
import type { Expense, ExpenseSplit } from "@/lib/app-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

type Member = { id: string; name: string; avatar_url?: string | null };

export function AddExpenseDialog({
  userId,
  groupId: fixedGroupId,
  members: fixedMembers,
  groups,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  mode = "add",
  initialExpense,
  initialSplits,
}: {
  userId: string;
  groupId?: string;
  members?: Member[];
  groups?: { id: string; name: string }[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  mode?: "add" | "edit";
  initialExpense?: Expense;
  initialSplits?: ExpenseSplit[];
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  const [selectedGroupId, setSelectedGroupId] = useState(fixedGroupId ?? groups?.[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [splitMode, setSplitMode] = useState<"equal" | "amount" | "percentage">("equal");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [customNotes, setCustomNotes] = useState<Record<string, string>>({});
  const [customPercentages, setCustomPercentages] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const activeGroupId = fixedGroupId ?? initialExpense?.group_id ?? selectedGroupId;
  const needsGroupPicker = !!groups && !fixedGroupId && mode !== "edit";

  const membersQuery = useQuery({
    queryKey: ["group-members", activeGroupId],
    queryFn: () => getGroupMembers(activeGroupId),
    enabled: open && !!activeGroupId && !fixedMembers,
  });

  const memberIds = useMemo(() => {
    if (fixedMembers) return fixedMembers.map((m) => m.id);
    return (membersQuery.data ?? []).filter((m) => m.status === "accepted").map((m) => m.user_id);
  }, [fixedMembers, membersQuery.data]);

  const sortedMemberIds = memberIds;
  try {
    sortedMemberIds.sort();
  } catch (e) {
    console.error("CRASH STACK memberIds:", e instanceof Error ? e.stack : e);
  }

  const profilesQuery = useQuery({
    queryKey: ["profiles", sortedMemberIds.join(",")],
    queryFn: () => getProfilesByIds(memberIds),
    enabled: open && memberIds.length > 0 && !fixedMembers,
  });

  const members: Member[] = useMemo(() => {
    if (fixedMembers) {
      return fixedMembers.map((m) => ({
        id: m.id,
        name: getCleanMemberName(m.name),
        avatar_url: m.avatar_url || null,
      }));
    }
    const pmap = new Map((profilesQuery.data ?? []).map((p) => [p.id, p]));
    return (membersQuery.data ?? [])
      .filter((m) => m.status === "accepted")
      .map((m) => {
        const p = pmap.get(m.user_id);
        let displayName = "Member";
        if (p) {
          if (p.full_name?.trim()) displayName = p.full_name.trim();
          else if (p.username?.trim()) displayName = p.username.trim().replace(/^@/, "");
        }

        return {
          id: m.user_id,
          name: m.user_id === userId ? "You" : displayName,
          avatar_url: p?.avatar_url || null,
        };
      });
  }, [fixedMembers, membersQuery.data, profilesQuery.data, userId]);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initialExpense) {
      const { cleanDescription, splitNotes } = parseExpenseDescription(initialExpense.description);
      setDescription(cleanDescription);
      setAmount(initialExpense.amount.toString());
      if (initialSplits && initialSplits.length > 0) {
        setParticipants(initialSplits.map((s) => s.user_id));
        const amounts: Record<string, string> = {};
        const notes: Record<string, string> = {};
        const exactEqual = initialExpense.amount / initialSplits.length;
        let isEqual = true;
        initialSplits.forEach((s) => {
          amounts[s.user_id] = s.amount_owed.toString();
          if (Math.abs(s.amount_owed - exactEqual) > 0.02) {
            isEqual = false;
          }
          if (s.note || splitNotes[s.user_id]) {
            notes[s.user_id] = s.note || splitNotes[s.user_id] || "";
          }
        });
        setCustomAmounts(amounts);
        setCustomNotes(notes);
        setSplitMode(isEqual ? "equal" : "amount");
      } else if (members.length > 0) {
        setParticipants(members.map((m) => m.id));
      }
    } else if (members.length > 0) {
      setParticipants(members.map((m) => m.id));
    }
  }, [open, members, mode, initialExpense, initialSplits]);

  useEffect(() => {
    if (open && groups?.[0] && !fixedGroupId && mode !== "edit") {
      setSelectedGroupId(groups[0].id);
    }
  }, [open, groups, fixedGroupId, mode]);

  const resetForm = () => {
    setDescription("");
    setAmount("");
    setSplitMode("equal");
    setCustomAmounts({});
    setCustomNotes({});
    setCustomPercentages({});
    setParticipants(members.map((m) => m.id));
  };

  const handleSetSplitMode = (nextMode: "equal" | "amount" | "percentage") => {
    setSplitMode(nextMode);
    const total = Number(amount) || 0;
    if (nextMode === "amount" && participants.length > 0) {
      const defaultShare = total > 0 ? (total / participants.length).toFixed(2) : "";
      setCustomAmounts((prev) => {
        const next = { ...prev };
        participants.forEach((pid) => {
          if (!next[pid]) next[pid] = defaultShare;
        });
        return next;
      });
    } else if (nextMode === "percentage" && participants.length > 0) {
      const defaultPct = (100 / participants.length).toFixed(1);
      setCustomPercentages((prev) => {
        const next = { ...prev };
        participants.forEach((pid) => {
          if (!next[pid]) next[pid] = defaultPct;
        });
        return next;
      });
    }
  };

  const totalAmount = Number(amount) || 0;

  const allocatedAmountSum = useMemo(() => {
    return participants.reduce((sum, pid) => sum + (Number(customAmounts[pid]) || 0), 0);
  }, [participants, customAmounts]);

  const amountRemaining = useMemo(() => {
    return Math.round((totalAmount - allocatedAmountSum) * 100) / 100;
  }, [totalAmount, allocatedAmountSum]);

  const allocatedPercentageSum = useMemo(() => {
    return participants.reduce((sum, pid) => sum + (Number(customPercentages[pid]) || 0), 0);
  }, [participants, customPercentages]);

  const percentageRemaining = useMemo(() => {
    return Math.round((100 - allocatedPercentageSum) * 10) / 10;
  }, [allocatedPercentageSum]);

  const allSelected = members.length > 0 && participants.length === members.length;

  const toggle = (id: string) =>
    setParticipants((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleAll = () => {
    setParticipants(allSelected ? [] : members.map((m) => m.id));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!activeGroupId) throw new Error("Select a group.");
      const total = Number(amount);
      if (!description.trim()) throw new Error("Add a description.");
      if (!(total > 0)) throw new Error("Enter a valid amount.");
      if (participants.length === 0) throw new Error("Select at least one person to split with.");

      let splits: { userId: string; amount: number; note?: string }[] = [];

      if (splitMode === "equal") {
        const cents = Math.round(total * 100);
        const base = Math.floor(cents / participants.length);
        let remainder = cents - base * participants.length;
        splits = participants.map((uid) => {
          let c = base;
          if (remainder > 0) {
            c += 1;
            remainder -= 1;
          }
          return { userId: uid, amount: c / 100 };
        });
      } else if (splitMode === "amount") {
        let sum = 0;
        splits = participants.map((uid) => {
          const val = Number(customAmounts[uid]) || 0;
          sum += val;
          const note = customNotes[uid]?.trim() || undefined;
          return {
            userId: uid,
            amount: Math.round(val * 100) / 100,
            note,
          };
        });
        if (Math.abs(sum - total) > 0.02) {
          throw new Error(
            `Allocated amounts (₹${sum.toFixed(2)}) must equal total amount (₹${total.toFixed(2)}).`,
          );
        }
      } else if (splitMode === "percentage") {
        let totalPct = 0;
        participants.forEach((uid) => {
          totalPct += Number(customPercentages[uid]) || 0;
        });
        if (Math.abs(totalPct - 100) > 0.05) {
          throw new Error(`Total percentage (${totalPct.toFixed(1)}%) must equal 100%.`);
        }

        const totalCents = Math.round(total * 100);
        let allocatedCents = 0;
        splits = participants.map((uid, index) => {
          const pct = Number(customPercentages[uid]) || 0;
          let memberCents = Math.round((totalCents * pct) / 100);
          if (index === participants.length - 1) {
            const currentSum = allocatedCents + memberCents;
            if (currentSum !== totalCents && Math.abs(currentSum - totalCents) <= 5) {
              memberCents = totalCents - allocatedCents;
            }
          }
          allocatedCents += memberCents;
          return { userId: uid, amount: memberCents / 100 };
        });
      }

      if (mode === "edit" && initialExpense) {
        await updateExpense({
          expenseId: initialExpense.id,
          userId,
          description: description.trim(),
          amount: total,
          splits,
        });
      } else {
        await addExpense({
          groupId: activeGroupId,
          createdBy: userId,
          description: description.trim(),
          amount: total,
          splits,
        });
      }
    },
    onSuccess: () => {
      toast.success(mode === "edit" ? "Expense updated!" : "Expense added!");
      queryClient.invalidateQueries({
        queryKey: ["group-expenses", activeGroupId],
      });
      queryClient.invalidateQueries({
        queryKey: ["group-splits", activeGroupId],
      });
      queryClient.invalidateQueries({ queryKey: ["settle", userId] });
      setOpen(false);
      resetForm();
    },
    onError: (e: Error) => toast.error(getCleanErrorMessage(e)),
  });

  const isLoadingMembers = !fixedMembers && !!activeGroupId && membersQuery.isLoading;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="p-0 gap-0 max-w-md rounded-3xl overflow-hidden border-slate-100 shadow-2xl">
        <DialogHeader className="px-6 py-4 border-b border-slate-100 shrink-0">
          <DialogTitle className="font-display text-lg font-bold text-slate-900">
            {mode === "edit" ? "Edit Expense" : "Add an Expense"}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 p-6 flex-1 overflow-y-auto max-h-[80vh]"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          {needsGroupPicker && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">Group</label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                required
              >
                {groups!.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Dinner, cab, groceries..."
              required
              className="rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">Amount (₹)</label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              className="rounded-xl border-slate-200 text-lg font-bold"
            />
          </div>

          {isLoadingMembers ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-slate-400">No members in this group yet.</p>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Paid by</label>
                <div className="flex h-10 w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
                  <Avatar className="w-6 h-6 rounded-full shrink-0 shadow-2xs">
                    <AvatarImage src={members.find((m) => m.id === userId)?.avatar_url || undefined} alt="You" />
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                      {getInitials(members.find((m) => m.id === userId)?.name || "You", "U")}
                    </AvatarFallback>
                  </Avatar>
                  <span>{members.find((m) => m.id === userId)?.name || "You"}</span>
                </div>
              </div>

              {/* Screen 5: Split Method Tabs (Equal / Amount / Percentage) */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">Split Method</label>
                <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => handleSetSplitMode("equal")}
                    className={`rounded-xl py-2 px-3 transition-all duration-200 cursor-pointer ${
                      splitMode === "equal"
                        ? "bg-emerald-600 text-white shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Equal
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetSplitMode("amount")}
                    className={`rounded-xl py-2 px-3 transition-all duration-200 cursor-pointer ${
                      splitMode === "amount"
                        ? "bg-emerald-600 text-white shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Amount
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetSplitMode("percentage")}
                    className={`rounded-xl py-2 px-3 transition-all duration-200 cursor-pointer ${
                      splitMode === "percentage"
                        ? "bg-emerald-600 text-white shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Percentage
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600">
                    {splitMode === "equal"
                      ? "Split equally between"
                      : splitMode === "amount"
                        ? "Split by exact amount between"
                        : "Split by percentage between"}
                  </label>
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs font-bold text-emerald-600 hover:underline"
                  >
                    {allSelected ? "Deselect all" : "Select all"}
                  </button>
                </div>
                <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-2xl border border-slate-200 p-2.5">
                  {members.map((m) => {
                    const isSelected = participants.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className="flex cursor-pointer items-center gap-2.5 text-sm select-none font-medium text-slate-700 p-1.5 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={isSelected}
                          onChange={() => toggle(m.id)}
                        />
                        <div
                          aria-hidden="true"
                          className={`w-[22px] h-[22px] rounded-md flex items-center justify-center shrink-0 border transition-all duration-200 ${
                            isSelected
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "bg-transparent border-slate-300 text-transparent hover:border-slate-400"
                          }`}
                        >
                          <Check
                            className={`w-3.5 h-3.5 stroke-[2.5] transition-transform duration-200 ${
                              isSelected ? "scale-100 opacity-100" : "scale-75 opacity-0"
                            }`}
                          />
                        </div>
                        <Avatar className="w-6 h-6 rounded-full shrink-0 shadow-2xs">
                          <AvatarImage src={m.avatar_url || undefined} alt={m.name} />
                          <AvatarFallback className="bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            {getInitials(m.name, "U")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{m.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Amount Mode Inputs */}
              {splitMode === "amount" && (
                <div className="space-y-2 pt-1 transition-all duration-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">
                      Member amounts & notes
                    </span>
                    <span
                      className={`font-semibold ${
                        Math.abs(amountRemaining) < 0.01
                          ? "text-emerald-600 dark:text-emerald-400"
                          : amountRemaining > 0
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-destructive"
                      }`}
                    >
                      {Math.abs(amountRemaining) < 0.01
                        ? "✓ Total matched"
                        : amountRemaining > 0
                          ? `₹${amountRemaining.toFixed(2)} remaining`
                          : `Over by ₹${Math.abs(amountRemaining).toFixed(2)}`}
                    </span>
                  </div>
                  <div className="max-h-56 space-y-2.5 overflow-y-auto rounded-xl border border-border p-3">
                    {participants.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Select members above to allocate amounts.
                      </p>
                    ) : (
                      participants.map((pid) => {
                        const m = members.find((x) => x.id === pid);
                        const displayName = m?.name || "Member";
                        return (
                          <div
                            key={pid}
                            className="space-y-1.5 rounded-xl bg-secondary/30 p-2.5 border border-border/50"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <Avatar className="w-5 h-5 rounded-full shrink-0 shadow-2xs">
                                  <AvatarImage src={m?.avatar_url || undefined} alt={displayName} />
                                  <AvatarFallback className="bg-emerald-100 text-emerald-800 font-bold text-[9px]">
                                    {getInitials(displayName, "U")}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium truncate">
                                  {displayName}
                                </span>
                              </div>
                              <div className="relative w-28 shrink-0">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                                  ₹
                                </span>
                                <Input
                                  type="number"
                                  inputMode="decimal"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  value={customAmounts[pid] ?? ""}
                                  onChange={(e) =>
                                    setCustomAmounts((prev) => ({ ...prev, [pid]: e.target.value }))
                                  }
                                  className="pl-6 h-8 text-xs font-semibold bg-background"
                                />
                              </div>
                            </div>
                            <div className="relative">
                              <Input
                                type="text"
                                placeholder={`Optional note for ${displayName}...`}
                                value={customNotes[pid] ?? ""}
                                onChange={(e) =>
                                  setCustomNotes((prev) => ({ ...prev, [pid]: e.target.value }))
                                }
                                maxLength={200}
                                className="h-7 text-xs bg-background/90 placeholder:text-muted-foreground/70 pr-12"
                              />
                              {(customNotes[pid]?.length ?? 0) > 0 && (
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground bg-background px-1">
                                  {customNotes[pid]?.length ?? 0}/200
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Percentage Mode Inputs */}
              {splitMode === "percentage" && (
                <div className="space-y-2 pt-1 transition-all duration-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Member percentages</span>
                    <span
                      className={`font-semibold ${
                        Math.abs(percentageRemaining) < 0.01
                          ? "text-emerald-600 dark:text-emerald-400"
                          : percentageRemaining > 0
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-destructive"
                      }`}
                    >
                      {Math.abs(percentageRemaining) < 0.01
                        ? "✓ 100% matched"
                        : percentageRemaining > 0
                          ? `${percentageRemaining.toFixed(1)}% remaining`
                          : `Over by ${Math.abs(percentageRemaining).toFixed(1)}%`}
                    </span>
                  </div>
                  <div className="max-h-44 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
                    {participants.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Select members above to allocate percentages.
                      </p>
                    ) : (
                      participants.map((pid) => {
                        const m = members.find((x) => x.id === pid);
                        const pctVal = Number(customPercentages[pid] || 0);
                        const calculatedAmt = totalAmount > 0 ? (totalAmount * pctVal) / 100 : 0;

                        return (
                          <div key={pid} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Avatar className="w-5 h-5 rounded-full shrink-0 shadow-2xs">
                                <AvatarImage src={m?.avatar_url || undefined} alt={m?.name || "Member"} />
                                <AvatarFallback className="bg-emerald-100 text-emerald-800 font-bold text-[9px]">
                                  {getInitials(m?.name || "Member", "U")}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{m?.name || "Member"}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  ₹{calculatedAmt.toFixed(2)}
                                </p>
                              </div>
                            </div>
                            <div className="relative w-24 shrink-0">
                              <Input
                                type="number"
                                inputMode="decimal"
                                step="0.1"
                                min="0"
                                max="100"
                                placeholder="0"
                                value={customPercentages[pid] ?? ""}
                                onChange={(e) =>
                                  setCustomPercentages((prev) => ({
                                    ...prev,
                                    [pid]: e.target.value,
                                  }))
                                }
                                className="pr-6 h-8 text-xs font-semibold"
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                                %
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="submit"
              disabled={mutation.isPending || isLoadingMembers || members.length === 0}
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "edit" ? "Save Changes" : "Add expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddExpenseFab({
  userId,
  groups,
}: {
  userId: string;
  groups: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);

  if (groups.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-20 flex h-12 items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 shadow-xl transition-all duration-150 active:scale-[0.98] hover:scale-[1.02] hover:shadow-2xl text-xs font-bold"
        aria-label="Add expense"
      >
        <Plus className="h-4 w-4 stroke-[3]" />
        <span>Add Expense</span>
      </button>

      <AddExpenseDialog
        userId={userId}
        groups={groups}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
