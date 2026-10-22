"use client";
import AuthWrapper from "../wrappers/AuthWrapper";
import AnalyticsDashboard from "@/components/analytics/AnalyticsDashboard";

export default function AnalyticsPage() {
  return <AuthWrapper><AnalyticsDashboard /></AuthWrapper>;
}
