// src/app/_layout.tsx
// Root layout — wraps the entire app with all global providers.

import "../global.css";
import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "../stores/auth.store";
import NetworkBanner from "../components/shared/NetworkBanner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry:             2,
      staleTime:         30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  const hydrate   = useAuthStore((s) => s.hydrate);

  // Rehydrate tokens from SecureStore on app start
  useEffect(() => { hydrate(); }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <NetworkBanner />
          <Stack screenOptions={{ headerShown: false }} />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
