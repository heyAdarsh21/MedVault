"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { setAuthToken } from "@/lib/api";

export function ReactQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const { setToken } = useAuthStore();

  useEffect(() => {
    const stored = localStorage.getItem("medvault_token");
    if (stored) {
      setToken(stored);
      setAuthToken(stored);
    }
  }, [setToken]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
