import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, AtSign, Mail, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { updateProfile, findUserByUsername } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/app-types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm({
  userId,
  email,
  existing,
  onDone,
  onCancel,
  showAvatar = false,
  showEmailField = false,
  hideSignedInText = false,
  submitLabel = "Save changes",
}: {
  userId: string;
  email: string;
  existing: Profile;
  onDone: () => void;
  onCancel?: () => void;
  showAvatar?: boolean;
  showEmailField?: boolean;
  hideSignedInText?: boolean;
  submitLabel?: string;
}) {
  const [username, setUsername] = useState(existing.username ?? "");
  const [fullName, setFullName] = useState(existing.full_name ?? "");
  const [upiId, setUpiId] = useState(existing.upi_id ?? "");

  const mutation = useMutation({
    mutationFn: async () => {
      const cleanUsername = username.trim().toLowerCase();
      const cleanFullName = fullName.trim();
      const cleanUpiId = upiId.trim();
      if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
        throw new Error(
          "Username must be 3–20 chars: letters, numbers, underscores.",
        );
      }
      if (!cleanUpiId.includes("@")) {
        throw new Error("Enter a valid UPI ID (e.g. name@bank).");
      }
      if (cleanUsername !== existing.username) {
        const taken = await findUserByUsername(cleanUsername);
        if (taken) throw new Error("That username is already taken.");
      }
      const profile = await updateProfile(userId, {
        username: cleanUsername,
        full_name: cleanFullName || null,
        upi_id: cleanUpiId,
        email,
      });

      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: cleanFullName || null,
          name: cleanFullName || null,
          display_name: cleanFullName || null,
          username: cleanUsername,
        },
      });
      if (error) throw error;

      return profile;
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
      {showAvatar && (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-secondary/45 px-4 py-5 text-center">
          <Avatar className="h-20 w-20 border border-border">
            <AvatarImage src={existing.avatar_url ?? undefined} alt={fullName || email} />
            <AvatarFallback className="bg-card font-display text-xl text-primary">
              {getInitials(fullName, email)}
            </AvatarFallback>
          </Avatar>
          <p className="text-xs text-muted-foreground">Avatar</p>
        </div>
      )}
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
      {showEmailField && (
        <div className="space-y-1.5">
          <Label>Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={email} readOnly aria-readonly />
          </div>
        </div>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" className={onCancel ? "" : "w-full"} disabled={mutation.isPending}>
          {mutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {submitLabel}
        </Button>
      </div>
      {!hideSignedInText && (
        <p className="text-center text-xs text-muted-foreground">
          Signed in as {email}
        </p>
      )}
    </form>
  );
}

function getInitials(name: string, email: string) {
  const source = name.trim() || email.trim();
  if (!source) return "SP";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
