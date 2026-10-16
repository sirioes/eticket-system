import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { cookies } from "next/headers";
import { LoginExperience } from "@/components/auth/login-experience";
import { INTRO_COOKIE } from "@/lib/login-intro";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Masuk",
};

export const viewport: Viewport = {
  themeColor: "#d0dcdc",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { reason } = await searchParams;
  const introSeen = (await cookies()).has(INTRO_COOKIE);

  return (
    <LoginExperience
      skipIntro={introSeen || typeof reason === "string"}
      expired={reason === "expired"}
      fontClassName={manrope.className}
    />
  );
}
