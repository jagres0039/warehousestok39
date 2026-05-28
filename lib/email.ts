// Email service stub. For Sprint 8 the invitation link is always shown
// directly in the UI so the OWNER can copy/paste it manually. A real provider
// (Resend, SES, Mailgun, ...) can plug in by replacing this module without
// touching callers.

interface InvitationEmailPayload {
  to: string;
  organizationName: string;
  inviterName: string;
  inviteUrl: string;
  expiresAt: Date;
}

export interface SendResult {
  delivered: boolean;
  // Truthy when a transport was actually configured. In dev/mock mode we
  // return false so the UI can show the invite URL inline.
  transport: "noop";
}

export async function sendInvitationEmail(payload: InvitationEmailPayload): Promise<SendResult> {
  console.info(
    "[email:invitation] to=%s org=%s inviter=%s url=%s expiresAt=%s",
    payload.to,
    payload.organizationName,
    payload.inviterName,
    payload.inviteUrl,
    payload.expiresAt.toISOString(),
  );
  return { delivered: false, transport: "noop" };
}
