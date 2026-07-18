import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function useSupabaseRealtime(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    // Create a single global channel for schema changes
    const channel = supabase
      .channel("schema-db-changes")
      // 1. Listen for expense changes
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses" },
        (payload) => {
          const newRow = payload.new as any;
          const oldRow = payload.old as any;
          const groupId = newRow?.group_id || oldRow?.group_id;
          if (groupId) {
            queryClient.invalidateQueries({
              queryKey: ["group-expenses", groupId],
            });
            queryClient.invalidateQueries({
              queryKey: ["settle", userId],
            });
          }
        }
      )
      // 2. Listen for expense_splits changes
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expense_splits" },
        () => {
          // Splits affect group-splits globally (or per group but we don't have groupId on splits)
          queryClient.invalidateQueries({ queryKey: ["group-splits"] });
          queryClient.invalidateQueries({ queryKey: ["settle", userId] });
        }
      )
      // 3. Listen for groups changes
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "groups" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
        }
      )
      // 4. Listen for group_members changes
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members" },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
          const newRow = payload.new as any;
          const oldRow = payload.old as any;
          const groupId = newRow?.group_id || oldRow?.group_id;
          if (groupId) {
            queryClient.invalidateQueries({
              queryKey: ["group-members", groupId],
            });
          }
        }
      )
      // 5. Listen for notifications changes
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        (payload) => {
          const newRow = payload.new as any;
          const oldRow = payload.old as any;
          if (
            newRow?.recipient_id === userId ||
            oldRow?.recipient_id === userId ||
            newRow?.sender_id === userId ||
            oldRow?.sender_id === userId
          ) {
            queryClient.invalidateQueries({
              queryKey: ["notifications", userId],
            });
          }
        }
      )
      .subscribe();

    // Cleanup subscription when user logs out or component unmounts
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
