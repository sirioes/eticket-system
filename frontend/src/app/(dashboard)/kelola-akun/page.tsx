import type { Metadata } from "next";
import { UsersPage } from "@/components/users/users-page";

export const metadata: Metadata = {
  title: "Kelola Akun",
};

export default function Page() {
  return <UsersPage />;
}
