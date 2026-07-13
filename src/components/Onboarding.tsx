import { Wallet } from "lucide-react";
import { ProfileForm } from "@/components/ProfileForm";
import type { Profile } from "@/lib/app-types";

export function Onboarding({
  userId,
  email,
  existing,
  onDone,
}: {
  userId: string;
  email: string;
  existing?: Profile;
  onDone: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app-gradient px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Wallet className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold">SplitPay</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h1 className="font-display text-xl font-bold">Set up your profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a unique username so friends can find you, and add your UPI ID
            so people can pay you back.
          </p>

          <div className="mt-6">
            <ProfileForm
              userId={userId}
              email={email}
              existing={
                existing ?? {
                  id: userId,
                  username: null,
                  email,
                  full_name: null,
                  upi_id: null,
                  avatar_url: null,
                  created_at: "",
                  updated_at: "",
                }
              }
              onDone={onDone}
              submitLabel="Continue"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
