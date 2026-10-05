import type { Viewport } from "next";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export const viewport: Viewport = {
  themeColor: "#d0dcdc",
};

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return <DashboardShell>{children}</DashboardShell>;
}