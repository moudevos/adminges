import { redirect } from "next/navigation";
import { DEFAULT_APP_HREF } from "@/components/shell/navigation";

export default function Home() {
  redirect(DEFAULT_APP_HREF);
}
