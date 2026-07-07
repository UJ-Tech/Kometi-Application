// src/app/index.tsx
// App entry — redirects to auth or app based on session state.

import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuthStore } from "../stores/auth.store";
import BrandedLoader from "../components/brand/BrandedLoader";

export default function EntryRedirect() {
  const router          = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading       = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      router.replace("/(app)/dashboard");
    } else {
      router.replace("/(auth)/welcome");
    }
  }, [isAuthenticated, isLoading]);

  return (
    <BrandedLoader />
  );
}
