import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useSettleBalances } from "@/hooks/use-settle-balances";
import { createGroup, getMyGroups, getProfile } from "@/lib/api";
import { BalanceSummaryCards } from "@/components/BalanceSummaryCards";
import { AddExpenseFab } from "@/components/AddExpenseDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/app/")({
  component: GroupsHome,
});

function GroupsHome() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const [now, setNow] = useState(() => new Date());

  const groupsQuery = useQuery({
    queryKey: ["my-groups", userId],
    queryFn: () => getMyGroups(userId),
  });
  const profileQuery = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getProfile(userId),
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const settleQuery = useSettleBalances(userId);
  const groups = groupsQuery.data ?? [];
  const profile = profileQuery.data;
  const firstName = getFirstName(
    profile?.full_name ??
      (session!.user.user_metadata.full_name as string | undefined) ??
      (session!.user.user_metadata.name as string | undefined) ??
      session!.user.email?.split("@")[0] ??
      "there",
  );
  const greeting = getGreeting(now);
  const initials = getInitials(profile?.full_name ?? firstName, session!.user.email ?? "");
  const totalOwe = (settleQuery.data?.iOwe ?? []).reduce(
    (s, b) => s + b.amount,
    0,
  );
  const totalOwed = (settleQuery.data?.owedToMe ?? []).reduce(
    (s, b) => s + b.amount,
    0,
  );

  return (
    <>
      <div className="space-y-5">
        <div className="space-y-4">
          <div className="py-2 pb-4">
            <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
              {greeting}, {firstName} 👋
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Keep your groups tidy and your balances in sight.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold">Your groups</h1>
              <p className="text-sm text-muted-foreground">
                Split bills with friends and roommates.
              </p>
            </div>
            <CreateGroupDialog userId={userId} />
          </div>
        </div>

        {settleQuery.isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : settleQuery.isError ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-4 text-center">
            <p className="text-sm font-medium">Balances could not load.</p>
            <Button
              className="mt-3"
              size="sm"
              variant="outline"
              onClick={() => settleQuery.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : (
          <BalanceSummaryCards totalOwe={totalOwe} totalOwed={totalOwed} />
        )}

        {groupsQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : groupsQuery.isError ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-display text-base font-semibold">
              Groups could not load
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {(groupsQuery.error as Error).message}
            </p>
            <Button
              className="mt-5"
              size="sm"
              variant="outline"
              onClick={() => groupsQuery.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : groups.length === 0 ? (
          <EmptyState userId={userId} />
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <Link
                key={g.id}
                to="/app/group/$groupId"
                params={{ groupId: g.id }}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                  <Users className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{g.name}</p>
                  {g.description && (
                    <p className="truncate text-sm text-muted-foreground">
                      {g.description}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </div>

      <AddExpenseFab
        userId={userId}
        groups={groups.map((g) => ({ id: g.id, name: g.name }))}
      />
    </>
  );
}

function getGreeting(date: Date) {
  const hour = date.getHours();
  if (hour >= 5 && hour <= 11) return "Good Morning";
  if (hour >= 12 && hour <= 16) return "Good Afternoon";
  if (hour >= 17 && hour <= 20) return "Good Evening";
  return "Good Night";
}

function getFirstName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0];
}

function getInitials(name: string, email: string) {
  const source = name.trim() || email.trim();
  if (!source) return "SP";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function EmptyState({ userId }: { userId: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
        <Users className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-display text-base font-semibold">No groups yet</h3>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
        Create your first group and invite friends by their username to start
        splitting expenses.
      </p>
      <div className="mt-5 flex justify-center">
        <CreateGroupDialog userId={userId} />
      </div>
    </div>
  );
}

function CreateGroupDialog({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => createGroup(userId, name.trim(), description.trim() || null),
    onSuccess: () => {
      toast.success("Group created!");
      queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
      setOpen(false);
      setName("");
      setDescription("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" /> New group
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a group</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            mutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Group name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Goa Trip, Flat 4B, ..."
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this group for?"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
