import { redirect } from "next/navigation";
import { DEFAULT_APP_HREF } from "@/config/navigation";

export default function Home() {
  redirect(DEFAULT_APP_HREF);
}
