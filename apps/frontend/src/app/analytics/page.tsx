"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthWrapper from "../wrappers/AuthWrapper";
import { useUserStore } from "@/stores/useUserStore";
import AnalyticsDashboard from "@/components/analytics/AnalyticsDashboard";

function AdminAnalytics() {
  const user = useUserStore(state => state.user);
  const router = useRouter();
  useEffect(() => {
    if (user?.role !== "admin") router.replace("/");
  }, [user?.role, router]);
  // The API independently checks the authenticated role and current database permissions.
  return user?.role === "admin" ? <AnalyticsDashboard /> : null;
}

export default function AnalyticsPage() {
  // Outside (main): no station navigation or footer on the focused analytics page.
  return <AuthWrapper><AdminAnalytics /></AuthWrapper>;
}
