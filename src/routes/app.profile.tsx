import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  AtSign,
  CreditCard,
  Loader2,
  Mail,
  UserRound,
  LogOut,
  Info,
  Lock,
  UserPen,
  ChevronRight,
  Camera,
  Check,
  Settings,
  UserPlus,
  Users,
  Search,
  X,
  UserMinus,
  Plus,
  Sparkles,
  Trash2,
  ImagePlus,
  type LucideIcon,
} from "lucide-react";
import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  getProfile,
  getMyGroups,
  getAllMyExpenses,
  getFriends,
  sendFriendRequest,
  getFriendRequestStatus,
  removeFriend,
  searchUsersByName,
  uploadToCloudinary,
  updateProfile,
} from "@/lib/api";
import { getInitials, cn } from "@/lib/utils";
import { ProfileForm } from "@/components/ProfileForm";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
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
import { toast } from "sonner";
import type { FriendRequestStatus, UserSearchResult } from "@/lib/app-types";

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return "Good Morning";
  if (h >= 12 && h < 17) return "Good Afternoon";
  if (h >= 17 && h < 21) return "Good Evening";
  return "Good Night";
}

function ProfileDetail({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-lg bg-secondary/45 px-3 py-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold text-foreground break-all">{value}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Friend Modal
// ─────────────────────────────────────────────────────────────────────────────
function AddFriendModal({
  open,
  onOpenChange,
  currentUserId,
  onFriendRequestSent,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currentUserId: string;
  onFriendRequestSent: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, FriendRequestStatus>>({});
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchUsersByName(value.trim());
        setResults(data);
        const newStatuses: Record<string, FriendRequestStatus> = {};
        await Promise.all(
          data.map(async (u) => {
            newStatuses[u.id] = await getFriendRequestStatus(currentUserId, u.id);
          })
        );
        setStatuses(newStatuses);
      } catch (e) {
        console.warn("Search error:", e);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const handleAdd = async (targetId: string) => {
    setSending((prev) => ({ ...prev, [targetId]: true }));
    try {
      await sendFriendRequest(currentUserId, targetId);
      setStatuses((prev) => ({ ...prev, [targetId]: "pending_sent" }));
      toast.success("Friend request sent! ✅");
      onFriendRequestSent();
    } catch (e: any) {
      toast.error(e.message || "Could not send request");
    } finally {
      setSending((prev) => ({ ...prev, [targetId]: false }));
    }
  };

  const handleClose = (o: boolean) => {
    if (!o) { setQuery(""); setResults([]); setStatuses({}); }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="p-0 gap-0 max-w-sm rounded-3xl overflow-hidden border-slate-100 shadow-2xl bg-white">
        <div className="pt-3 pb-1"><div className="w-10 h-1 bg-slate-200 rounded-full mx-auto" /></div>
        <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100">
          <DialogTitle className="font-display text-lg font-bold text-slate-900">Add Friend</DialogTitle>
          <button type="button" onClick={() => handleClose(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text" value={query} onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name or username..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
              autoFocus
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 animate-spin" />}
          </div>
        </div>
        <div className="px-5 pb-5 min-h-[140px] max-h-[55vh] overflow-y-auto">
          {!query.trim() ? (
            <div className="pt-6 text-center">
              <UserPlus className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-400">Find your friends</p>
              <p className="text-xs text-slate-300 mt-0.5">Type a name or @username to search</p>
            </div>
          ) : !searching && results.length === 0 ? (
            <div className="pt-6 text-center">
              <p className="text-sm font-semibold text-slate-500">No users found</p>
              <p className="text-xs text-slate-400 mt-0.5">Try a different name or username</p>
            </div>
          ) : (
            <div className="space-y-1 pt-1">
              {results.map((user) => {
                const name = user.full_name?.trim() || user.username?.replace(/^@/, "") || "User";
                const uname = user.username ? `@${user.username.replace(/^@/, "")}` : "";
                const initials = getInitials(name, "");
                const status = statuses[user.id] ?? "none";
                const isSending = sending[user.id] ?? false;
                return (
                  <div key={user.id} className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-50 transition-colors">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={user.avatar_url || undefined} alt={name} />
                      <AvatarFallback className="bg-emerald-50 text-emerald-700 font-bold text-sm">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                      {uname && <p className="text-[11px] text-slate-400">{uname}</p>}
                    </div>
                    {status === "friends" ? (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold"><Check className="w-3 h-3" /> Friends</span>
                    ) : status === "pending_sent" ? (
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold">Sent</span>
                    ) : status === "pending_received" ? (
                      <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold">Respond ↑</span>
                    ) : (
                      <button type="button" disabled={isSending} onClick={() => handleAdd(user.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all active:scale-95 disabled:opacity-50">
                        {isSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                        Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const Route = createFileRoute("/app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { session, signOut } = useAuth();
  const userId = session?.user?.id ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [friendsListOpen, setFriendsListOpen] = useState(false);
  const [groupsListOpen, setGroupsListOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const handleRemoveAvatar = async () => {
    setIsUploadingAvatar(true);
    setAvatarMenuOpen(false);
    try {
      await updateProfile(userId, { avatar_url: null });
      await queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      toast.success("Profile photo removed.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove profile photo");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }
    setIsUploadingAvatar(true);
    try {
      const url = await uploadToCloudinary(file, "avatars");
      await updateProfile(userId, { avatar_url: url });
      await queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      toast.success("Profile photo updated! ✨");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update profile photo");
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const [reduceMotion, setReduceMotion] = useState<boolean>(() => {
    return localStorage.getItem("splity-reduce-motion") === "true";
  });

  useEffect(() => {
    if (reduceMotion) {
      document.documentElement.setAttribute("data-reduce-motion", "true");
      document.documentElement.classList.add("reduce-motion");
    } else {
      document.documentElement.removeAttribute("data-reduce-motion");
      document.documentElement.classList.remove("reduce-motion");
    }
  }, [reduceMotion]);

  const toggleReduceMotion = useCallback(() => {
    const next = !reduceMotion;
    setReduceMotion(next);
    localStorage.setItem("splity-reduce-motion", String(next));
  }, [reduceMotion]);

  const profileQuery = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getProfile(userId),
    enabled: !!userId,
  });

  const groupsQuery = useQuery({
    queryKey: ["my-groups", userId],
    queryFn: () => getMyGroups(userId),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const expensesQuery = useQuery({
    queryKey: ["my-expenses", userId],
    queryFn: () => getAllMyExpenses(userId),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const friendsQuery = useQuery({
    queryKey: ["friends", userId],
    queryFn: () => getFriends(userId),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const removeFriendMutation = useMutation({
    mutationFn: (friendId: string) => removeFriend(userId, friendId),
    onSuccess: () => {
      toast.success("Friend removed");
      queryClient.invalidateQueries({ queryKey: ["friends", userId] });
    },
    onError: (err: Error) => toast.error(err.message || "Could not remove friend"),
  });

  if (profileQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (profileQuery.isError) {
    return (
      <div className="space-y-3 py-16 text-center">
        <h1 className="font-display text-xl font-bold">Profile could not load</h1>
        <p className="text-sm text-slate-500">{(profileQuery.error as Error).message}</p>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800"
          onClick={() => profileQuery.refetch()}
        >
          Try again
        </button>
      </div>
    );
  }

  const profile = profileQuery.data;
  const userMeta = session?.user?.user_metadata;
  const profileEmail = profile?.email ?? session?.user?.email ?? "";
  const displayName =
    profile?.full_name ??
    (userMeta?.full_name as string | undefined) ??
    (userMeta?.name as string | undefined) ??
    "Your profile";
  const rawUsername = profile?.username?.replace(/^@/, "") ?? "username";
  const username = `@${rawUsername}`;
  const initials = getInitials(displayName, profileEmail);

  const groupsCount = groupsQuery.data?.length ?? 0;
  const allExpenses = expensesQuery.data ?? [];
  const regularExpensesCount = allExpenses.filter((e) => {
    const d = e.description.toLowerCase();
    return !d.includes("settlement") && !d.includes("paid");
  }).length;
  const friendsCount = friendsQuery.data?.length ?? 0;
  const friends = friendsQuery.data ?? [];

  if (!profile) {
    return <p className="text-center text-sm text-slate-400">Profile not found.</p>;
  }

  return (
    <div className="space-y-5">
      {/* Screen 8 Top Bar: Title + Settings button */}
      <div className="flex items-center justify-between pt-1">
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          Profile
        </h1>
        <button
          type="button"
          onClick={() => setProfileDialogOpen(true)}
          className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5 stroke-[2]" />
        </button>
      </div>

      {/* Hero Section: Avatar + Name + Greeting */}
      <div className="flex flex-col items-center text-center pt-2">
        <div className="relative animate-scale-fade-in">
          <Avatar className="h-24 w-24 ring-4 ring-white shadow-[var(--shadow-2)]">
            <AvatarImage src={profile.avatar_url || undefined} alt={displayName} />
            <AvatarFallback className="bg-emerald-50 font-display text-2xl font-bold text-emerald-700">
              {initials}
            </AvatarFallback>
          </Avatar>
          {isUploadingAvatar && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-white animate-spin" />
            </div>
          )}
          {profile.avatar_url ? (
            <Popover open={avatarMenuOpen} onOpenChange={setAvatarMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={isUploadingAvatar}
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md transition-transform active:scale-95 hover:scale-110 disabled:opacity-50"
                  aria-label="Edit avatar"
                >
                  <Camera className="w-3.5 h-3.5 stroke-[2.2]" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="center" className="w-40 p-1.5 rounded-2xl border-slate-100 shadow-xl bg-white z-50">
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarMenuOpen(false);
                      avatarInputRef.current?.click();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors text-left"
                  >
                    <ImagePlus className="w-4 h-4 text-emerald-600" />
                    <span>Change Photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Remove Photo</span>
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <button
              type="button"
              disabled={isUploadingAvatar}
              onClick={() => avatarInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md transition-transform active:scale-95 hover:scale-110 disabled:opacity-50"
              aria-label="Add avatar"
            >
              <Camera className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={avatarInputRef}
            onChange={handleAvatarFileChange}
          />
        </div>

        <h2 className="mt-3 font-display text-xl font-bold text-slate-900 animate-slide-up-fade">{displayName}</h2>
        <div className="flex items-center gap-1 mt-0.5 animate-fade-in">
          <span className="text-xs font-semibold text-slate-400">{username}</span>
          <div className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
            <Check className="w-2.5 h-2.5 stroke-[3]" />
          </div>
        </div>
        <p className="text-xs text-slate-400 font-medium mt-1.5 animate-fade-in" style={{ animationDelay: "100ms" }}>
          {getTimeGreeting()}, {displayName.split(" ")[0]}!
        </p>
      </div>

      {/* 2-Column Stats Card */}
      <div className="p-2.5 rounded-2xl bg-white border border-slate-100 shadow-[var(--shadow-1)] grid grid-cols-2 divide-x divide-slate-100 text-center">
        {[
          { value: groupsCount, label: "Groups", onClick: () => setGroupsListOpen(true) },
          { value: friendsCount, label: "Friends", onClick: () => setFriendsListOpen(true) },
        ].map((stat, idx) => (
          <button
            key={stat.label}
            type="button"
            className="px-2 py-2 rounded-xl hover:bg-slate-50/80 transition-all active:scale-95 animate-stagger-item text-center flex flex-col items-center justify-center cursor-pointer"
            style={{ "--stagger": idx } as React.CSSProperties}
            onClick={stat.onClick}
          >
            <p className="font-display font-bold text-xl text-slate-900">{stat.value}</p>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{stat.label}</p>
          </button>
        ))}
      </div>

      {/* Friends Actions */}
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => {
            if (typeof navigator !== "undefined" && !navigator.onLine) {
              toast.error("Requires internet to add friends");
              return;
            }
            setAddFriendOpen(true);
          }}
          className="flex-1 h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Friends</span>
        </button>
        <button
          type="button"
          onClick={() => setFriendsListOpen(true)}
          className="h-11 px-4 rounded-2xl bg-white border border-slate-200/90 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-95"
        >
          <Users className="w-4 h-4 text-emerald-600" />
          <span>Friends ({friendsCount})</span>
        </button>
      </div>

      {/* PREFERENCES Section */}
      <div className="space-y-2">
        <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-slate-400">
          Preferences
        </h3>
        <div className="rounded-2xl bg-white border border-slate-100 shadow-[var(--shadow-1)] overflow-hidden">
          <div className="flex items-center justify-between p-3.5 gap-2">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-slate-800 truncate">Reduce Motion</p>
                <p className="text-[11px] text-slate-400 font-medium truncate">Disable animations for accessibility</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={reduceMotion}
              onClick={toggleReduceMotion}
              aria-label="Toggle reduce motion"
              style={{
                display: "inline-flex",
                alignItems: "center",
                width: "50px",
                height: "28px",
                minWidth: "50px",
                minHeight: "28px",
                maxHeight: "28px",
                borderRadius: "14px",
                border: "none",
                outline: "none",
                padding: 0,
                cursor: "pointer",
                flexShrink: 0,
                position: "relative",
                backgroundColor: reduceMotion ? "#10B981" : "#D1D5DB",
                transition: "background-color 0.2s cubic-bezier(0.4,0,0.2,1)",
                boxShadow: "inset 0 1px 3px rgba(0,0,0,0.12)",
              }}
            >
              <span
                style={{
                  display: "block",
                  position: "absolute",
                  top: "3px",
                  left: "3px",
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  backgroundColor: "white",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.22)",
                  transform: reduceMotion ? "translateX(22px)" : "translateX(0px)",
                  transition: "transform 0.2s cubic-bezier(0.4,0,0.2,1)",
                  pointerEvents: "none",
                }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* FRIENDS List Modal */}
      <Dialog open={friendsListOpen} onOpenChange={setFriendsListOpen}>
        <DialogContent className="p-0 gap-0 max-w-sm rounded-3xl overflow-hidden border-slate-100 shadow-2xl bg-white max-h-[85vh] flex flex-col">
          {/* Handle */}
          <div className="pt-3 pb-1">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto" />
          </div>
          
          <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100 shrink-0">
            <DialogTitle className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
              Friends
              <span className="text-emerald-600 text-base">({friendsCount})</span>
            </DialogTitle>
            <button
              type="button"
              onClick={() => {
                setFriendsListOpen(false);
                setTimeout(() => setAddFriendOpen(true), 150);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all active:scale-95 shadow-sm shadow-emerald-600/30"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
          
          <div className="overflow-y-auto flex-1 min-h-[150px] bg-slate-50/50">
            {friendsQuery.isLoading ? (
              <div className="p-5 space-y-3">
                {[0, 1].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full skeleton-shimmer bg-slate-200" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-1/2 rounded skeleton-shimmer bg-slate-200" />
                      <div className="h-2.5 w-1/3 rounded skeleton-shimmer bg-slate-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : friends.length === 0 ? (
              <div className="py-12 text-center px-4">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-500">No friends yet</p>
                <p className="text-xs text-slate-400 mt-1">Add people to connect and invite them to groups easily.</p>
                <button
                  type="button"
                  onClick={() => {
                    setFriendsListOpen(false);
                    setTimeout(() => setAddFriendOpen(true), 150);
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all active:scale-95 shadow-md shadow-emerald-600/20"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Find Friends
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100/80">
                {friends.map((friend) => {
                  const p = friend.profile;
                  const name = p?.full_name?.trim() || p?.username?.replace(/^@/, "") || "Friend";
                  const initials = getInitials(name, "");
                  const uname = p?.username ? `@${p.username.replace(/^@/, "")}` : "";
                  return (
                    <div key={friend.id} className="flex items-center gap-3 p-3.5 group hover:bg-white transition-colors">
                      <Avatar className="h-10 w-10 shrink-0 shadow-sm border border-slate-100">
                        <AvatarImage src={p?.avatar_url || undefined} alt={name} />
                        <AvatarFallback className="bg-emerald-50 text-emerald-700 font-bold text-sm">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                        {uname && <p className="text-[11px] text-slate-400 font-medium">{uname}</p>}
                      </div>
                      <button
                        type="button"
                        disabled={removeFriendMutation.isPending}
                        onClick={() => removeFriendMutation.mutate(friend.friend_id)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 shrink-0"
                        title="Remove friend"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* GROUPS List Modal */}
      <Dialog open={groupsListOpen} onOpenChange={setGroupsListOpen}>
        <DialogContent className="p-0 gap-0 max-w-sm rounded-3xl overflow-hidden border-slate-100 shadow-2xl bg-white max-h-[85vh] flex flex-col">
          {/* Handle */}
          <div className="pt-3 pb-1">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto" />
          </div>

          <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100 shrink-0">
            <DialogTitle className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
              My Groups
              <span className="text-emerald-600 text-base">({groupsCount})</span>
            </DialogTitle>
            <Link
              to="/app"
              onClick={() => setGroupsListOpen(false)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all active:scale-95 shadow-sm shadow-emerald-600/30"
            >
              <Plus className="w-3.5 h-3.5" />
              New
            </Link>
          </div>

          <div className="overflow-y-auto flex-1 min-h-[150px] bg-slate-50/50">
            {groupsQuery.isLoading ? (
              <div className="p-5 space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl skeleton-shimmer bg-slate-200" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-1/2 rounded skeleton-shimmer bg-slate-200" />
                      <div className="h-2.5 w-1/3 rounded skeleton-shimmer bg-slate-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (groupsQuery.data ?? []).length === 0 ? (
              <div className="py-12 text-center px-4">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-600">No groups yet</p>
                <p className="text-xs text-slate-400 mt-1">You are not connected to any groups yet.</p>
                <Link
                  to="/app"
                  onClick={() => setGroupsListOpen(false)}
                  className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all active:scale-95 shadow-md shadow-emerald-600/20"
                >
                  <Plus className="w-3.5 h-3.5" /> Create or Join Group
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100/80">
                {(groupsQuery.data ?? []).map((grp) => {
                  const isCreator = grp.created_by === userId;
                  const initials = grp.name.slice(0, 2).toUpperCase();
                  return (
                    <Link
                      key={grp.id}
                      to="/app/group/$groupId"
                      params={{ groupId: grp.id }}
                      onClick={() => setGroupsListOpen(false)}
                      className="flex items-center gap-3 p-3.5 group hover:bg-white transition-colors"
                    >
                      <Avatar className="h-11 w-11 rounded-2xl shrink-0 shadow-sm border border-slate-100">
                        <AvatarImage src={grp.avatar_url ?? undefined} alt={grp.name} className="object-cover rounded-2xl" />
                        <AvatarFallback className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white font-bold text-xs rounded-2xl">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-slate-800 truncate group-hover:text-emerald-700 transition-colors">
                            {grp.name}
                          </p>
                          {isCreator && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded-md">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                          Created {new Date(grp.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Details */}
      <div className="space-y-2">
        <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-slate-400">
          Payment Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-400">UPI ID</p>
              <p className="text-xs font-bold text-slate-900 truncate">
                {profile.upi_id || "Not configured"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-400">Email</p>
              <p className="text-xs font-bold text-slate-900 truncate">{profileEmail}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Account Actions */}
      <div className="space-y-2">
        <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-slate-400">
          Account
        </h3>
        <div className="rounded-2xl bg-white border border-slate-100 shadow-[var(--shadow-1)] divide-y divide-slate-100 overflow-hidden">
          <button
            type="button"
            className="flex w-full items-center justify-between p-3.5 text-left transition-colors hover:bg-slate-50 active:scale-[0.99] group"
            onClick={() => setProfileDialogOpen(true)}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <UserPen className="h-4 w-4" />
              </div>
              <span className="font-semibold text-sm text-slate-800">Edit Profile</span>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
          <button
            type="button"
            className="flex w-full items-center justify-between p-3.5 text-left transition-colors hover:bg-slate-50 active:scale-[0.99] group"
            onClick={() => setPasswordDialogOpen(true)}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <Lock className="h-4 w-4" />
              </div>
              <span className="font-semibold text-sm text-slate-800">Change Password</span>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
          <div className="flex items-center justify-between p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <Info className="h-4 w-4" />
              </div>
              <span className="font-semibold text-sm text-slate-800">App Version</span>
            </div>
            <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
              {__APP_VERSION__}
            </span>
          </div>
        </div>
      </div>

      {/* Sign Out Button */}
      <div className="pt-2 pb-4">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              className="w-full h-12 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] hover:shadow-[var(--shadow-glow-red)] hover:-translate-y-0.5"
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-3xl border-slate-100">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display font-bold text-slate-900">
                Sign Out?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-500">
                Are you sure you want to sign out of Splity?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSigningOut} className="rounded-xl font-semibold">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="rounded-xl font-semibold bg-rose-600 hover:bg-rose-700 text-white"
                disabled={isSigningOut}
                onClick={async (e) => {
                  e.preventDefault();
                  setIsSigningOut(true);
                  await signOut();
                  navigate({ to: "/auth" });
                }}
              >
                {isSigningOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Sign Out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <ChangePasswordDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen} />

      {/* Edit Profile Dialog */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl overflow-hidden border-slate-100 shadow-2xl p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-slate-100 shrink-0">
            <DialogTitle className="font-display font-bold text-lg text-slate-900">
              Edit Profile
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 flex-1 overflow-y-auto max-h-[80vh]">
            <ProfileForm
              userId={userId}
              email={profileEmail}
              existing={profile}
              showAvatar
              showEmailField
              hideSignedInText
              submitLabel="Save Changes"
              onCancel={() => setProfileDialogOpen(false)}
              onDone={() => {
                queryClient.invalidateQueries({ queryKey: ["profile", userId] });
                setProfileDialogOpen(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Friend Dialog */}
      <AddFriendModal
        open={addFriendOpen}
        onOpenChange={setAddFriendOpen}
        currentUserId={userId}
        onFriendRequestSent={() => {
          queryClient.invalidateQueries({ queryKey: ["friends", userId] });
        }}
      />
    </div>
  );
}
