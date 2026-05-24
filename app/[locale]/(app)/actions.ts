"use server";

import { signOut } from "@/lib/auth";

export async function signOutAction(locale: string) {
  await signOut({ redirectTo: `/${locale}` });
}
