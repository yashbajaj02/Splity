import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getProfile } from "@/lib/api";
import { ProfileForm } from "@/components/ProfileForm";

export const Route = createFileRoute("/app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const queryClient = useQueryClient();

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
  if (!profile) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Profile not found.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/app"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold">Edit profile</h1>
        <p className="text-sm text-muted-foreground">
          Update your username and UPI ID.
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <ProfileForm
          userId={userId}
          email={session!.user.email ?? ""}
          existing={profile}
          onDone={() =>
            queryClient.invalidateQueries({ queryKey: ["profile", userId] })
          }
        />
      </div>
    </div>
  );
}
