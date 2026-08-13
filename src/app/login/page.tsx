import { connection } from "next/server";
import { redirect } from "next/navigation";
import LoginPageClient from "./page-client";
import { getCurrentUser } from "@/app/actions/auth-actions";

export default async function LoginPage() {
  await connection();

  if (process.env.LAB_SSO_ENABLED === "true" && await getCurrentUser()) {
    redirect("/dashboard");
  }

  return <LoginPageClient />;
}
