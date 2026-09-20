import { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const createRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes — data is fresh for 5 min after fetch
        gcTime: 30 * 60 * 1000, // 30 minutes — keep in-memory cache across navigations
        refetchOnWindowFocus: false, // Relies on realtime subscriptions
      },
    },
  });

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};

export const getRouter = createRouter;
