import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./errors";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // Ретраим только сетевые сбои и только идемпотентные запросы.
        if (!(error instanceof ApiError)) return false;
        if (error.kind === "network" || error.kind === "timeout")
          return failureCount < 2;
        return false;
      },
    },
    mutations: { retry: false },
  },
});
