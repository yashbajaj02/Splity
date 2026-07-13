import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, AtSign, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { updateProfile, findUserByUsername } from "@/lib/api";
import type { Profile } from "@/lib/app-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm({
  userId,
  email,
  existing,
  onDone,
  submitLabel = "Save changes",
}: {
  userId: string;
  email: string;
  existing: Profile;
  onDone: () => void;
  submitLabel?: string;
}) {
  const [username, setUsername] = useState(existing.username ?? "");
  const [fullName, setFullName] = useState(existing.full_name ?? "");
  const [upiId, setUpiId] = useState(existing.upi_id ?? "");

  const mutation = useMutation({
    mutationFn: async () => {
      const cleanUsername = username.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
        throw new Error(
          "Username must be 3–20 chars: letters, numbers, underscores.",
        );
      }
      if (!upiId.includes("@")) {
        throw new Error("Enter a valid UPI ID (e.g. name@bank).");
      }
      if (cleanUsername !== existing.username) {
        const taken = await findUserByUsername(cleanUsername);
        if (taken) throw new Error("That username is already taken.");
      }
      return updateProfile(userId, {
        username: cleanUsername,
        full_name: fullName.trim() || null,
        upi_id: upiId.trim(),
      });
    },
    onSuccess: () => {
      toast.success("Profile updated!");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="space-y-1.5">
        <Label>Full name (optional)</Label>
        <Input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Jane Doe"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Username</Label>
        <div className="relative">
          <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="janedoe"
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>UPI ID</Label>
        <div className="relative">
          <Smartphone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="jane@okaxis"
            required
          />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        {submitLabel}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Signed in as {email}
      </p>
    </form>
  );
}
