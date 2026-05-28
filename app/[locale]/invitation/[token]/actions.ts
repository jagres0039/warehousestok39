"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { acceptInvitation, InvitationError } from "@/lib/invitations";
import { acceptInvitationSchema } from "@/lib/member-schemas";

export interface AcceptResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function acceptInvitationAction(
  _prev: AcceptResult | undefined,
  formData: FormData,
): Promise<AcceptResult> {
  const token = String(formData.get("token") ?? "");
  const locale = String(formData.get("locale") ?? "id");
  const mode = String(formData.get("mode") ?? "existing");
  const password = String(formData.get("password") ?? "");
  const nameRaw = formData.get("name");

  const parsed = acceptInvitationSchema.safeParse({
    token,
    mode,
    password,
    name: typeof nameRaw === "string" ? nameRaw.trim() : undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  let accepted;
  try {
    accepted = await acceptInvitation({
      token: parsed.data.token,
      mode: parsed.data.mode,
      password: parsed.data.password,
      name: parsed.data.name,
    });
  } catch (err) {
    if (err instanceof InvitationError) {
      return { ok: false, error: err.code };
    }
    throw err;
  }

  // Sign the user in. For newly created users this is their first session;
  // for existing users this may overwrite an existing session — but since
  // NextAuth's authorize picks the first (oldest) membership, the active org
  // will still be their original one. The accept-success page tells them how
  // to switch.
  try {
    await signIn("credentials", {
      email: accepted.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch {
    // If sign-in fails for any reason (eg. NextAuth quirk), fall through to
    // the dashboard redirect; the user will be bounced to the login page if
    // there's no session.
  }

  redirect(`/${locale}/dashboard?accepted=1`);
}
