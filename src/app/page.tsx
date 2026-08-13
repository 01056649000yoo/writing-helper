import { redirect } from "next/navigation";
import { withBasePath } from "@/lib/app-path";

export default function Home() {
  redirect(withBasePath("/dashboard"));
}
