// src/app/(app)/dashboard/admin.tsx
// Admin panel — deprecated, redirects to dashboard.
import { useEffect } from "react";
import { useRouter } from "expo-router";
import BrandedLoader from "../../../components/brand/BrandedLoader";
import { COLORS } from "../../../constants/theme";

export default function AdminDashboard() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/(app)/dashboard");
  }, []);
  return (
    <BrandedLoader />
  );
}
