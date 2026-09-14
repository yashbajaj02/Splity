import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createGroup, uploadToCloudinary } from "@/lib/api";
import { getCleanErrorMessage } from "@/lib/utils";
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
  DialogFooter,
} from "@/components/ui/dialog";

export function CreateGroupModal({
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
              className="w-full rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
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
