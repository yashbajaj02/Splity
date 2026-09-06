import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  X,
  Send,
  Pencil,
  Trash2,
  Lock,
  Users,
  Clock,
  Loader2,
  Check,
  AlertCircle,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import {
  getGroupMessages,
  sendGroupMessage,
  editGroupMessage,
  deleteGroupMessage,
  getFriends,
} from "@/lib/api";
import type { GroupMessage, Profile, GroupMember, Group } from "@/lib/app-types";
import { cn, getInitials } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface GroupChatPageProps {
  group: Group;
  currentUserId: string;
  members: GroupMember[];
  profileMap: Map<string, Profile>;
  onClose: () => void;
}

export function GroupChatPage({
  group,
  currentUserId,
  members,
  profileMap,
  onClose,
}: GroupChatPageProps) {
  const queryClient = useQueryClient();
  const [inputText, setInputText] = useState("");
  const [editingMessage, setEditingMessage] = useState<GroupMessage | null>(null);
  const [mentionMenuOpen, setMentionMenuOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [selectedMentionUserId, setSelectedMentionUserId] = useState<string | null>(null);
  const [selectedMentionAll, setSelectedMentionAll] = useState(false);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [isTableMissing, setIsTableMissing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Query friends to prioritize them in mentions
  const friendsQuery = useQuery({
    queryKey: ["friends", currentUserId],
    queryFn: () => getFriends(currentUserId),
    staleTime: 30_000,
  });

  const friendIdsSet = useMemo(() => {
    return new Set((friendsQuery.data ?? []).map((f) => f.friend_id));
  }, [friendsQuery.data]);

  // Group members sorted with friends first, then alphabetically
  const sortedMembers = useMemo(() => {
    return [...members]
      .filter((m) => m.status === "accepted")
      .map((m) => {
        const p = profileMap.get(m.user_id);
        const name =
          m.user_id === currentUserId
            ? "You"
            : p?.full_name?.trim() || p?.username?.trim() || "User";
        const username = p?.username?.replace(/^@/, "").trim() || "";
        const rawName = p?.full_name?.trim() || p?.username?.trim() || name;
        const isFriend = friendIdsSet.has(m.user_id);
        return {
          userId: m.user_id,
          name,
          username,
          avatar_url: p?.avatar_url || null,
          fallbackInitials: getInitials(rawName, "U"),
          isFriend,
        };
      })
      .sort((a, b) => {
        // Friends show first
        if (a.isFriend && !b.isFriend) return -1;
        if (!a.isFriend && b.isFriend) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [members, profileMap, currentUserId, friendIdsSet]);

  // Messages Query
  const messagesQuery = useQuery({
    queryKey: ["group-messages", group.id],
    queryFn: async () => {
      const msgs = await getGroupMessages(group.id, 50);
      return msgs;
    },
    refetchOnWindowFocus: false,
    staleTime: 10_000,
  });

  const messages = useMemo(() => {
    const raw = messagesQuery.data ?? [];
    const now = Date.now();
    // Filter out expired messages client-side
    return raw.filter((msg) => {
      if (!msg.expires_at) return true;
      return new Date(msg.expires_at).getTime() > now;
    });
  }, [messagesQuery.data]);

  // Realtime Subscription for this group's messages
  useEffect(() => {
    const channel = supabase
      .channel(`group-chat-room-${group.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_messages",
          filter: `group_id=eq.${group.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newMsg = payload.new as GroupMessage;
            queryClient.setQueryData<GroupMessage[]>(
              ["group-messages", group.id],
              (prev) => {
                if (!prev) return [newMsg];
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              },
            );
            setTimeout(scrollToBottom, 50);
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as GroupMessage;
            queryClient.setQueryData<GroupMessage[]>(
              ["group-messages", group.id],
              (prev) => (prev ? prev.map((m) => (m.id === updated.id ? updated : m)) : []),
            );
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as { id: string };
            queryClient.setQueryData<GroupMessage[]>(
              ["group-messages", group.id],
              (prev) => (prev ? prev.filter((m) => m.id !== deleted.id) : []),
            );
          }
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("Realtime group chat channel error");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [group.id, queryClient]);

  // Auto-scroll to bottom on mount and message update
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length]);

  // Send Mutation
  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      return sendGroupMessage({
        groupId: group.id,
        senderId: currentUserId,
        messageText: text,
        mentionedUserId: selectedMentionUserId,
        mentionedAll: selectedMentionAll,
      });
    },
    onSuccess: (newMsg) => {
      queryClient.setQueryData<GroupMessage[]>(
        ["group-messages", group.id],
        (prev) => [...(prev ?? []), newMsg],
      );
      setInputText("");
      setSelectedMentionUserId(null);
      setSelectedMentionAll(false);
      setTimeout(scrollToBottom, 50);
    },
    onError: (err: any) => {
      if (err?.message?.includes("group_messages") || err?.code === "PGRST205") {
        setIsTableMissing(true);
      }
      toast.error(err?.message || "Failed to send message");
    },
  });

  // Edit Mutation
  const editMutation = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      return editGroupMessage(id, text);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<GroupMessage[]>(
        ["group-messages", group.id],
        (prev) => (prev ? prev.map((m) => (m.id === updated.id ? updated : m)) : []),
      );
      setEditingMessage(null);
      setInputText("");
      toast.success("Message edited");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to edit message"),
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return deleteGroupMessage(id);
    },
    onSuccess: (_, id) => {
      queryClient.setQueryData<GroupMessage[]>(
        ["group-messages", group.id],
        (prev) => (prev ? prev.filter((m) => m.id !== id) : []),
      );
      toast.success("Message deleted");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to delete message"),
  });

  // Handle Text Change & @Mention trigger
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    const atIndex = val.lastIndexOf("@");
    if (atIndex !== -1 && (atIndex === 0 || val[atIndex - 1] === " ")) {
      const query = val.slice(atIndex + 1);
      if (!query.includes(" ")) {
        setMentionFilter(query.toLowerCase());
        setMentionMenuOpen(true);
        return;
      }
    }
    setMentionMenuOpen(false);
  };

  // Select Mention from dropdown
  const handleSelectMention = (target: { type: "all" } | { type: "user"; userId: string; username: string }) => {
    const atIndex = inputText.lastIndexOf("@");
    const prefix = inputText.slice(0, atIndex);

    if (target.type === "all") {
      setInputText(`${prefix}@all `);
      setSelectedMentionAll(true);
      setSelectedMentionUserId(null);
    } else {
      const handle = target.username || "user";
      setInputText(`${prefix}@${handle} `);
      setSelectedMentionUserId(target.userId);
      setSelectedMentionAll(false);
    }
    setMentionMenuOpen(false);
    inputRef.current?.focus();
  };

  // Keyboard navigation for @mentions on PC
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!mentionMenuOpen) return;
    const totalOptions = 1 + filteredMentions.length; // 0 is @all, 1..N are members

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedMentionIndex((prev) => (prev + 1) % totalOptions);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedMentionIndex((prev) => (prev - 1 + totalOptions) % totalOptions);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedMentionIndex === 0) {
        handleSelectMention({ type: "all" });
      } else {
        const target = filteredMentions[selectedMentionIndex - 1];
        if (target) {
          handleSelectMention({ type: "user", userId: target.userId, username: target.username });
        }
      }
    } else if (e.key === "Escape") {
      setMentionMenuOpen(false);
    }
  };

  // Submit message or edit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    if (editingMessage) {
      editMutation.mutate({ id: editingMessage.id, text: inputText });
    } else {
      sendMutation.mutate(inputText);
    }
  };

  const handleStartEdit = (msg: GroupMessage) => {
    setEditingMessage(msg);
    setInputText(msg.message_text);
    inputRef.current?.focus();
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setInputText("");
  };

  // Filtered members for autocomplete
  const filteredMentions = useMemo(() => {
    return sortedMembers.filter(
      (m) =>
        m.name.toLowerCase().includes(mentionFilter) ||
        m.username.toLowerCase().includes(mentionFilter),
    );
  }, [sortedMembers, mentionFilter]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col max-w-[480px] mx-auto shadow-2xl overflow-hidden animate-in fade-in duration-200">
      {/* ── Top Bar ── */}
      <header className="h-14 px-3 border-b border-border/70 bg-card/95 backdrop-blur-md flex items-center justify-between shrink-0 select-none shadow-2xs">
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 hover:bg-secondary active:scale-95 transition-all"
          aria-label="Back to group"
        >
          <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
        </button>

        <div className="flex items-center gap-2 min-w-0 max-w-[260px] text-center">
          <Avatar className="w-8 h-8 rounded-full shrink-0 shadow-2xs">
            <AvatarImage src={group.avatar_url || undefined} alt={group.name} />
            <AvatarFallback className="bg-emerald-600 text-white font-bold text-xs">
              {group.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 text-left">
            <h1 className="font-display font-bold text-sm text-foreground truncate leading-tight">
              {group.name}
            </h1>
            <p className="text-[10px] text-muted-foreground font-medium">
              {sortedMembers.length} members • Group Chat
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-secondary active:scale-95 transition-all"
          aria-label="Close chat"
        >
          <X className="w-5 h-5 stroke-[2.2]" />
        </button>
      </header>

      {/* ── Optional Notice if SQL migration is pending ── */}
      {isTableMissing && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="truncate">
              Run <code className="font-bold">supabase_group_messages.sql</code> in Supabase SQL editor.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(`See supabase_group_messages.sql`);
              toast.success("Script filename copied!");
            }}
            className="px-2 py-1 bg-amber-200/60 dark:bg-amber-800 rounded font-semibold text-[10px] shrink-0"
          >
            Copy File Info
          </button>
        </div>
      )}

      {/* ── Scrollable Message History ── */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50 dark:bg-transparent"
      >
        {messagesQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mb-3">
              <Users className="w-6 h-6 stroke-[2]" />
            </div>
            <p className="font-display font-bold text-foreground text-sm">Welcome to {group.name} Chat</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
              Chat with members, mention @someone, or share updates with @all.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSender = msg.sender_id === currentUserId;
            const senderProfile = profileMap.get(msg.sender_id);
            const senderName = isSender
              ? "You"
              : senderProfile?.full_name?.trim() ||
              senderProfile?.username?.replace(/^@/, "").trim() ||
              "Member";

            const isDirectMention = !!msg.mentioned_user_id;
            const isTargetOfMention = msg.mentioned_user_id === currentUserId;
            const mentionedProfile = msg.mentioned_user_id
              ? profileMap.get(msg.mentioned_user_id)
              : null;
            const mentionedName = mentionedProfile?.username
              ? `@${mentionedProfile.username}`
              : "user";

            // Can edit within 5 minutes
            const ageMs = Date.now() - new Date(msg.created_at).getTime();
            const canEdit = isSender && ageMs < 5 * 60 * 1000;
            const canDelete = isSender;

            const timeStr = format(new Date(msg.created_at), "h:mm a");

            return (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-2 group transition-all items-end animate-in fade-in slide-in-from-bottom-2 duration-200",
                  isSender ? "justify-end" : "justify-start",
                )}
              >
                {!isSender && (
                  <Avatar className="w-7 h-7 rounded-full shrink-0 mb-1 shadow-2xs">
                    <AvatarImage src={senderProfile?.avatar_url || undefined} alt={senderName} />
                    <AvatarFallback className="bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      {senderName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    "flex flex-col max-w-[82%]",
                    isSender ? "items-end" : "items-start",
                  )}
                >
                  {/* Sender Header */}
                  {!isSender && (
                    <span className="text-[11px] font-bold text-slate-500 mb-1 px-1">
                      {senderName}
                    </span>
                  )}

                {/* Message Bubble */}
                <div
                  className={cn(
                    "relative max-w-[82%] px-3.5 py-2.5 rounded-2xl shadow-xs transition-all",
                    isSender
                      ? "bg-emerald-600 text-white rounded-tr-xs"
                      : "bg-white dark:bg-card border border-border/80 text-foreground rounded-tl-xs",
                    isDirectMention && (isTargetOfMention || isSender) && "ring-2 ring-emerald-400/40",
                  )}
                >
                  {/* Mention Pill Badges */}
                  {msg.mentioned_all && (
                    <div className="mb-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-400/20 text-amber-200">
                      @all
                    </div>
                  )}

                  {isDirectMention && (
                    <div
                      className={cn(
                        "mb-1 flex items-center gap-1 text-[10px] font-semibold",
                        isSender ? "text-emerald-100" : "text-emerald-600",
                      )}
                    >
                      <Lock className="w-3 h-3 stroke-[2.5]" />
                      <span>
                        {isTargetOfMention
                          ? `Direct to you (deletes in 24h)`
                          : `Direct to ${mentionedName} (deletes in 24h)`}
                      </span>
                    </div>
                  )}

                  {/* Message Content */}
                  <p className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed">
                    {msg.message_text}
                  </p>

                  {/* Bubble Footer: Time + Edited mark + Sent checkmark */}
                  <div
                    className={cn(
                      "flex items-center justify-end gap-1 mt-1 text-[10px]",
                      isSender ? "text-emerald-100/80" : "text-muted-foreground",
                    )}
                  >
                    <span>{timeStr}</span>
                    {msg.is_edited && <span>(edited)</span>}
                    {isSender && <Check className="w-3 h-3 text-emerald-200 stroke-[2.5]" />}
                  </div>
                </div>

                {/* Actions on Sender's message */}
                {isSender && (
                  <div className="flex items-center gap-2 mt-1 px-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleStartEdit(msg)}
                        className="text-[10px] font-semibold text-slate-400 hover:text-emerald-600 flex items-center gap-0.5 transition-colors"
                        title="Edit message (within 5 min)"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                        <span>Edit</span>
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("Delete this message?")) {
                            deleteMutation.mutate(msg.id);
                          }
                        }}
                        className="text-[10px] font-semibold text-slate-400 hover:text-rose-600 flex items-center gap-0.5 transition-colors"
                        title="Delete message"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Mention Autocomplete Dropdown ── */}
      {mentionMenuOpen && (
        <div className="mx-3 -mb-1 bg-card border border-border shadow-xl rounded-2xl overflow-hidden z-20 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
          <div className="p-2 border-b border-border/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Mention Member
          </div>

          {/* @all option */}
          <button
            type="button"
            onClick={() => handleSelectMention({ type: "all" })}
            className={cn(
              "w-full px-3 py-2 text-left flex items-center gap-2.5 transition-colors",
              selectedMentionIndex === 0
                ? "bg-emerald-50 dark:bg-emerald-950/50 border-l-2 border-emerald-500 font-semibold"
                : "hover:bg-secondary",
            )}
          >
            <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-[10px]">
              @
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">@all</p>
              <p className="text-[10px] text-muted-foreground">Notify everyone in this group</p>
            </div>
          </button>

          {/* Individual Members */}
          {filteredMentions.map((m, idx) => {
            const isSelected = selectedMentionIndex === idx + 1;
            return (
              <button
                key={m.userId}
                type="button"
                onClick={() =>
                  handleSelectMention({
                    type: "user",
                    userId: m.userId,
                    username: m.username,
                  })
                }
                className={cn(
                  "w-full px-3 py-2 text-left flex items-center gap-2.5 transition-colors border-t border-border/30",
                  isSelected
                    ? "bg-emerald-50 dark:bg-emerald-950/50 border-l-2 border-emerald-500 font-semibold"
                    : "hover:bg-secondary",
                )}
              >
                <Avatar className="w-7 h-7 rounded-full shrink-0 shadow-2xs">
                  <AvatarImage src={m.avatar_url || undefined} alt={m.name} />
                  <AvatarFallback className="bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px]">
                    {m.fallbackInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-foreground truncate">{m.name}</p>
                    {m.isFriend && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                        Friend
                      </span>
                    )}
                  </div>
                  {m.username && (
                    <p className="text-[10px] text-muted-foreground truncate">@{m.username}</p>
                  )}
                </div>
                <span className="text-[9px] text-slate-400">24h auto-delete</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Edit State Indicator ── */}
      {editingMessage && (
        <div className="px-4 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border-t border-emerald-200/60 flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-200">
          <span className="flex items-center gap-1.5 font-medium">
            <Pencil className="w-3.5 h-3.5 text-emerald-600" />
            Editing message
          </span>
          <button
            type="button"
            onClick={handleCancelEdit}
            className="text-[11px] font-bold text-rose-600 hover:underline"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Bottom Input Field ── */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-border/80 bg-card/95 backdrop-blur-md flex items-center gap-2 shrink-0"
      >
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type message or @name..."
            className="w-full h-11 bg-secondary/70 border border-border/80 rounded-2xl px-4 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={!inputText.trim() || sendMutation.isPending || editMutation.isPending}
          className={cn(
            "w-11 h-11 rounded-2xl flex items-center justify-center text-white transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:pointer-events-none shrink-0",
            editingMessage
              ? "bg-emerald-700 hover:bg-emerald-800"
              : "bg-emerald-600 hover:bg-emerald-700",
          )}
          aria-label={editingMessage ? "Save edit" : "Send message"}
        >
          {sendMutation.isPending || editMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : editingMessage ? (
            <Check className="w-4 h-4 stroke-[2.5]" />
          ) : (
            <Send className="w-4 h-4 stroke-[2.2] translate-x-0.5" />
          )}
        </button>
      </form>
    </div>
  );
}
