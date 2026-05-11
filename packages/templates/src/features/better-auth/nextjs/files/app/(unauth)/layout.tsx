import { redirect } from "next/navigation";
import type { PropsWithChildren } from "react";
import { isAuthenticated } from "@/lib/auth-server";

export default async function UnauthLayout({ children }: PropsWithChildren) {
  if (await isAuthenticated()) {
    redirect("/");
  }
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
