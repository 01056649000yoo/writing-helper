import { getCurrentUser } from "@/app/actions/auth-actions";
import ResetPasswordClient from "./reset-password-client";

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();

  return <ResetPasswordClient initialReady={Boolean(user)} />;
}
