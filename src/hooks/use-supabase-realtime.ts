import { useEffect } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getMyGroups } from "@/lib/api";

export function useSupabaseRealtime(userId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: groups } = useQuery({
    queryKey: ["my-groups-realtime", userId],
    queryFn: () => (userId ? getMyGroups(userId) : Promise.resolve([])),
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;

    const channels: ReturnType<typeof supabase.channel>[] = [];

    const globalChannel = supabase
      .channel("schema-db-changes-global")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members", filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["my-groups", userId] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `sender_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "expense_splits" }, () => {
        queryClient.invalidateQueries({ queryKey: ["group-splits"] });
        queryClient.invalidateQueries({ queryKey: ["settle", userId] });
        queryClient.invalidateQueries({ queryKey: ["expense-breakdown"] });
        queryClient.invalidateQueries({ queryKey: ["qr-expense-breakdown"] });
      })
      .subscribe();

    channels.push(globalChannel);

    if (groups) {
      for (const group of groups) {
        const groupChannel = supabase
          .channel(`schema-db-changes-${group.id}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "expenses", filter: `group_id=eq.${group.id}` },
            () => {
              queryClient.invalidateQueries({ queryKey: ["group-expenses", group.id] });
              queryClient.invalidateQueries({ queryKey: ["group-splits", group.id] });
              queryClient.invalidateQueries({ queryKey: ["settle", userId] });
              queryClient.invalidateQueries({ queryKey: ["expense-breakdown"] });
              queryClient.invalidateQueries({ queryKey: ["qr-expense-breakdown"] });
            },
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "group_members",
              filter: `group_id=eq.${group.id}`,
            },
            () => {
              queryClient.invalidateQueries({ queryKey: ["group-members", group.id] });
            },
          )
          .subscribe();
        channels.push(groupChannel);
      }
    }

    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [userId, queryClient, groups]);
}
