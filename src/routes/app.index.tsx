import { getCleanErrorMessage, cn } from "@/lib/utils";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCachedQuery } from "@/hooks/use-cached-query";
import {
  Plus,
  Search,
  Home,
  Compass,
  Briefcase,
  Calendar,
  GraduationCap,
  Users,
  Loader2,
  X,
  Upload,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useSettleBalances } from "@/hooks/use-settle-balances";
import { createGroup, getMyGroups, uploadToCloudinary } from "@/lib/api";
import type { Group } from "@/lib/app-types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BalanceCard } from "@/components/BalanceCard";
import { AddExpenseFab } from "@/components/AddExpenseDialog";
import { getProfile } from "@/lib/api";
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

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return "Good Morning";
  if (h >= 12 && h < 17) return "Good Afternoon";
  if (h >= 17 && h < 21) return "Good Evening";
  return "Good Night";
}

export const Route = createFileRoute("/app/")({
  component: GroupsHome,
});

// Category squircle icons & palettes matching the reference mockup
const GROUP_PALETTES = [
  { icon: Home, bg: "bg-emerald-50 text-emerald-600" },
  { icon: Compass, bg: "bg-sky-50 text-sky-600" },
  { icon: Briefcase, bg: "bg-amber-50 text-amber-600" },
  { icon: Calendar, bg: "bg-rose-50 text-rose-600" },
  { icon: GraduationCap, bg: "bg-purple-50 text-purple-600" },
];

function GroupsHome() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? "";
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Profile query — cache-first so greeting name appears on warm loads
  const profileQuery = useCachedQuery(`profile:${userId}`, {
    queryKey: ["profile", userId] as const,
    queryFn: () => getProfile(userId!),
    enabled: !!userId,
    staleTime: 300_000,
  });

  const firstName = useMemo(() => {
    const fullName = profileQuery.data?.full_name ?? session?.user?.user_metadata?.full_name as string | undefined;
    if (fullName) return fullName.split(" ")[0];
    return profileQuery.data?.username?.replace(/^@/, "") ?? "";
  }, [profileQuery.data, session]);

  const greeting = getTimeGreeting();

  // Groups query — cache-first so list renders immediately on warm loads
  const groupsQuery = useCachedQuery(`groups:${userId}`, {
    queryKey: ["my-groups", userId] as const,
    queryFn: () => getMyGroups(userId),
    enabled: !!userId,
  });

  const settleQuery = useSettleBalances(userId);
  const groups = groupsQuery.data ?? [];

  const totalOwe = useMemo(
    () => settleQuery.data?.iOwe.reduce((sum, b) => sum + b.amount, 0) ?? 0,
    [settleQuery.data],
  );

  const totalOwed = useMemo(
    () => settleQuery.data?.owedToMe.reduce((sum, b) => sum + b.amount, 0) ?? 0,
    [settleQuery.data],
  );

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, searchQuery]);

  return (
    <>
      <div className="space-y-5">
        {/* Greeting + Header Row */}
        <div className="pt-2">
          {firstName && (
            <p className="text-xs font-semibold text-emerald-600 animate-fade-in">
              {greeting}, {firstName}! 👋
            </p>
          )}
          <div className="flex items-center justify-between mt-1">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Groups
            </h1>
            <button
              type="button"
              onClick={() => {
                if (typeof navigator !== "undefined" && !navigator.onLine) {
                  toast.error("Requires internet to create a group");
                  return;
                }
                setCreateDialogOpen(true);
              }}
              title={typeof navigator !== "undefined" && !navigator.onLine ? "Requires internet" : "Create new group"}
              className={cn(
                "h-9 px-3.5 rounded-full text-white flex items-center gap-1.5 shadow-sm btn-tactile font-semibold text-xs",
                typeof navigator !== "undefined" && !navigator.onLine
                  ? "bg-slate-400 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700",
              )}
              aria-label="Create new group"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>New Group</span>
            </button>
          </div>
        </div>

        {/* Interactive Balance Card with Wave & State Switcher */}
        <BalanceCard totalOwe={totalOwe} totalOwed={totalOwed} />

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search groups"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl py-2.5 pl-10 pr-9 text-sm text-slate-800 placeholder:text-slate-400 outline-none shadow-[var(--shadow-1)] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:shadow-[0_0_12px_rgba(16,185,129,0.18)] transition-all duration-150"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Group list — spinner only on genuine first-ever cold load (no cache) */}
        {groupsQuery.isLoading && !groupsQuery.isPlaceholderData ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          </div>
        ) : groupsQuery.isError ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-slate-800">Groups could not load</p>
            <p className="mt-1 text-xs text-slate-500">{(groupsQuery.error as Error).message}</p>
            <Button
              className="mt-4"
              size="sm"
              variant="outline"
              onClick={() => groupsQuery.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : filteredGroups.length === 0 && searchQuery ? (
          <div className="rounded-2xl bg-white border border-slate-100 p-8 text-center">
            <p className="text-sm font-semibold text-slate-800">No groups found</p>
            <p className="text-xs text-slate-400 mt-1">Try a different search term</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredGroups.map((g, idx) => {
              const palette = GROUP_PALETTES[idx % GROUP_PALETTES.length];
              const Icon = palette.icon;

              return (
                <Link
                  key={g.id}
                  to="/app/group/$groupId"
                  params={{ groupId: g.id }}
                  style={{ "--stagger": idx } as React.CSSProperties}
                  className="group flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100 shadow-[var(--shadow-1)] card-hover-green cursor-pointer animate-stagger-item"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {g.avatar_url ? (
                      <Avatar className="w-12 h-12 rounded-2xl shrink-0 transition-transform duration-200 group-hover:scale-110 shadow-2xs">
                        <AvatarImage src={g.avatar_url} alt={g.name} />
                        <AvatarFallback className={`rounded-2xl ${palette.bg}`}>
                          <Icon className="w-5 h-5 stroke-[2.2]" />
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110 ${palette.bg}`}
                      >
                        <Icon className="w-5 h-5 stroke-[2.2]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-display font-bold text-slate-900 text-sm truncate">
                        {g.name}
                      </p>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">
                        {g.description ? g.description : "Split expenses"}
                      </p>
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 text-slate-400 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              );
            })}

            {/* Create New Group action card */}
            <button
              type="button"
              onClick={() => setCreateDialogOpen(true)}
              className="w-full text-left p-4 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/30 hover:bg-emerald-50/60 transition-all flex items-center gap-3.5 active:scale-[0.99] card-hover"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <p className="font-display font-bold text-sm text-emerald-800">
                  Create New Group
                </p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Start splitting with friends
                </p>
              </div>
            </button>
          </div>
        )}
      </div>

      <CreateGroupModal
        userId={userId}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <AddExpenseFab userId={userId} groups={groups.map((g) => ({ id: g.id, name: g.name }))} />
    </>
  );
}

function CreateGroupModal({
  userId,
  open,
  onOpenChange,
}: {
  userId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const url = await uploadToCloudinary(file, "splity/groups");
      setAvatarUrl(url);
      toast.success("Group avatar uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const mutation = useMutation({
    mutationFn: () => createGroup(userId, name.trim(), description.trim() || null, avatarUrl || null),
    onSuccess: () => {
      toast.success("Group created!");
      queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
      onOpenChange(false);
      setName("");
      setDescription("");
      setAvatarUrl("");
    },
    onError: (e: Error) => toast.error(getCleanErrorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-sm rounded-3xl overflow-hidden border-slate-100 shadow-xl">
        <DialogHeader className="px-6 py-4 border-b border-slate-100">
          <DialogTitle className="font-display text-lg font-bold text-slate-900">
            Create a group
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            mutation.mutate();
          }}
        >
          <div className="flex justify-center pb-2">
            <div 
              className="relative cursor-pointer group flex flex-col items-center gap-1.5"
              onClick={() => !isUploading && fileInputRef.current?.click()}
            >
              <Avatar className={`h-16 w-16 border border-border transition-opacity ${isUploading ? 'opacity-50' : 'group-hover:opacity-80'}`}>
                <AvatarImage src={avatarUrl || undefined} alt="Group Avatar" />
                <AvatarFallback className="bg-emerald-50 font-display text-xl text-emerald-700">
                  {name ? name.slice(0, 2).toUpperCase() : "GP"}
                </AvatarFallback>
              </Avatar>
              {isUploading && (
                <div className="absolute top-4 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                </div>
              )}
              <span className="text-[11px] text-muted-foreground">Upload Avatar (optional)</span>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600">Group name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Roommates, Goa Trip, Flat 4B..."
              className="rounded-xl border-slate-200 focus-visible:ring-emerald-500"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600">Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this group for?"
              className="rounded-xl border-slate-200 focus-visible:ring-emerald-500 resize-none"
              rows={2}
            />
          </div>
          <DialogFooter className="pt-2">
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
