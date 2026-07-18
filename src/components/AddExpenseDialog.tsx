import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  addExpense,
  getGroupMembers,
  getProfilesByIds,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

type Member = { id: string; name: string };

export function AddExpenseDialog({
  userId,
  groupId: fixedGroupId,
  members: fixedMembers,
  groups,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  userId: string;
  groupId?: string;
  members?: Member[];
  groups?: { id: string; name: string }[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  const [selectedGroupId, setSelectedGroupId] = useState(
    fixedGroupId ?? groups?.[0]?.id ?? "",
  );
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const activeGroupId = fixedGroupId ?? selectedGroupId;
  const needsGroupPicker = !!groups && !fixedGroupId;

  const membersQuery = useQuery({
    queryKey: ["group-members", activeGroupId],
    queryFn: () => getGroupMembers(activeGroupId),
    enabled: open && !!activeGroupId && !fixedMembers,
  });

  const memberIds = useMemo(() => {
    if (fixedMembers) return fixedMembers.map((m) => m.id);
    return (membersQuery.data ?? [])
      .filter((m) => m.status === "accepted")
      .map((m) => m.user_id);
  }, [fixedMembers, membersQuery.data]);

  const profilesQuery = useQuery({
    queryKey: ["profiles", memberIds.sort().join(",")],
    queryFn: () => getProfilesByIds(memberIds),
    enabled: open && memberIds.length > 0 && !fixedMembers,
  });

  const members: Member[] = useMemo(() => {
    if (fixedMembers) return fixedMembers;
    const pmap = new Map((profilesQuery.data ?? []).map((p) => [p.id, p]));
    return (membersQuery.data ?? [])
      .filter((m) => m.status === "accepted")
      .map((m) => {
        const p = pmap.get(m.user_id);
        
        let displayName = "user";
        if (p) {
          if (p.full_name && p.username) displayName = `${p.full_name} (@${p.username})`;
          else if (p.full_name) displayName = p.full_name;
          else if (p.username) displayName = `@${p.username}`;
        }

        return {
          id: m.user_id,
          name: m.user_id === userId ? `You${p?.username ? ` (@${p.username})` : ""}` : displayName,
        };
      });
  }, [fixedMembers, membersQuery.data, profilesQuery.data, userId]);

  useEffect(() => {
    if (!open) return;
    if (members.length > 0) {
      setParticipants(members.map((m) => m.id));
    }
  }, [open, members]);

  useEffect(() => {
    if (open && groups?.[0] && !fixedGroupId) {
      setSelectedGroupId(groups[0].id);
    }
  }, [open, groups, fixedGroupId]);

  const resetForm = () => {
    setDescription("");
    setAmount("");
    setParticipants(members.map((m) => m.id));
  };

  const allSelected =
    members.length > 0 && participants.length === members.length;

  const toggle = (id: string) =>
    setParticipants((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const toggleAll = () => {
    setParticipants(allSelected ? [] : members.map((m) => m.id));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!activeGroupId) throw new Error("Select a group.");
      const total = Number(amount);
      if (!description.trim()) throw new Error("Add a description.");
      if (!(total > 0)) throw new Error("Enter a valid amount.");
      if (participants.length === 0)
        throw new Error("Select at least one person to split with.");

      const cents = Math.round(total * 100);
      const base = Math.floor(cents / participants.length);
      let remainder = cents - base * participants.length;
      const splits = participants.map((uid) => {
        let c = base;
        if (remainder > 0) {
          c += 1;
          remainder -= 1;
        }
        return { userId: uid, amount: c / 100 };
      });

      await addExpense({
        groupId: activeGroupId,
        createdBy: userId,
        description: description.trim(),
        amount: total,
        splits,
      });
    },
    onSuccess: () => {
      toast.success("Expense added!");
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
    onError: (e: Error) => toast.error(e.message),
  });

  const isLoadingMembers =
    !fixedMembers && !!activeGroupId && membersQuery.isLoading;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add an expense</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          {needsGroupPicker && (
            <div className="space-y-1.5">
              <Label>Group</Label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Dinner, cab, groceries..."
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Amount (₹)</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          {isLoadingMembers ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No members in this group yet.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Paid by</Label>
                <div className="flex h-10 w-full items-center gap-2 rounded-md border border-input bg-secondary/40 px-3 py-2 text-sm font-medium text-foreground">
                  <span>👤</span>
                  <span>{members.find((m) => m.id === userId)?.name || "You"}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Split equally between</Label>
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {allSelected ? "Deselect all" : "Select all"}
                  </button>
                </div>
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
                  {members.map((m) => (
                    <label
                      key={m.id}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={participants.includes(m.id)}
                        onCheckedChange={() => toggle(m.id)}
                      />
                      {m.name}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button
              type="submit"
              disabled={
                mutation.isPending || isLoadingMembers || members.length === 0
              }
            >
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add expense
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
        className="fixed bottom-20 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        aria-label="Add expense"
      >
        <Plus className="h-7 w-7" />
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
