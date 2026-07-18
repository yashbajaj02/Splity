import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  AtSign,
  CreditCard,
  Loader2,
  Mail,
  ShieldCheck,
  UserRound,
  LogOut,
  FileText,
  BookOpen,
  Info,
  Lock,
  UserPen,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getProfile } from "@/lib/api";
import { ProfileForm } from "@/components/ProfileForm";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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

export const Route = createFileRoute("/app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { session, signOut } = useAuth();
  const userId = session!.user.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getProfile(userId),
  });

  if (profileQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (profileQuery.isError) {
    return (
      <div className="space-y-3 py-16 text-center">
        <h1 className="font-display text-xl font-bold">
          Profile could not load
        </h1>
        <p className="text-sm text-muted-foreground">
          {(profileQuery.error as Error).message}
        </p>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
          onClick={() => profileQuery.refetch()}
        >
          Try again
        </button>
      </div>
    );
  }

  const profile = profileQuery.data;
  const profileEmail = profile?.email ?? session!.user.email ?? "";
  const displayName =
    profile?.full_name ??
    (session!.user.user_metadata.full_name as string | undefined) ??
    (session!.user.user_metadata.name as string | undefined) ??
    "Your profile";
  const username = profile?.username ? `@${profile.username}` : "Username not set";
  const initials = getInitials(displayName, profileEmail);

  if (!profile) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Profile not found.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/app"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold">Profile</h1>
      </div>

      <section className="flex flex-col items-center rounded-2xl border border-border bg-card p-6 shadow-sm text-center">
        <Avatar className="h-24 w-24 border-4 border-background shadow-sm">
          <AvatarImage src={profile.avatar_url ?? undefined} alt={displayName} />
          <AvatarFallback className="bg-secondary font-display text-2xl text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <h2 className="mt-4 font-display text-xl font-bold">{displayName}</h2>
        <p className="text-sm font-medium text-primary">{username}</p>
        
        <div className="mt-6 grid w-full gap-2 text-sm text-muted-foreground text-left sm:grid-cols-2">
          <ProfileDetail icon={UserRound} label="Full Name" value={displayName} />
          <ProfileDetail icon={AtSign} label="Username" value={username} />
          <ProfileDetail
            icon={CreditCard}
            label="UPI ID"
            value={profile.upi_id ?? "UPI ID not set"}
          />
          <ProfileDetail icon={Mail} label="Email" value={profileEmail} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="px-2 font-display text-sm font-semibold text-muted-foreground">Account</h3>
        <div className="divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <button
            type="button"
            className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-secondary/50"
            onClick={() => setProfileDialogOpen(true)}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-primary">
                <UserPen className="h-4 w-4" />
              </div>
              <span className="font-medium">Edit Profile</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            type="button"
            className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-secondary/50"
            onClick={() => setPasswordDialogOpen(true)}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-primary">
                <Lock className="h-4 w-4" />
              </div>
              <span className="font-medium">Change Password</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="px-2 font-display text-sm font-semibold text-muted-foreground">About</h3>
        <div className="divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="flex items-center justify-between p-4 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-primary">
                <Info className="h-4 w-4" />
              </div>
              <span className="font-medium text-foreground">App Version</span>
            </div>
            <span className="text-sm text-muted-foreground">v1.0.0</span>
          </div>
        </div>
      </section>

      <section className="pt-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full rounded-2xl h-12 text-base font-semibold">
              <LogOut className="mr-2 h-5 w-5" /> Sign Out
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign Out?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to sign out of Splity?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSigningOut}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
      </section>

      <ChangePasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
      />
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="mx-4 max-w-md rounded-2xl border-border bg-card p-6 shadow-xl sm:mx-0">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Edit Profile</DialogTitle>
            <DialogDescription>
              Update your profile details. Your email is shown for reference.
            </DialogDescription>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>
    </div>
  );
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
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function getInitials(name: string, email: string) {
  const source = name.trim() || email.trim();
  if (!source) return "SP";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
