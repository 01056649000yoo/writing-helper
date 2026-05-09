import { connection } from "next/server";
import LoginPageClient from "./page-client";

export default async function LoginPage() {
  await connection();

  return <LoginPageClient />;
}
