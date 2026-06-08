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

interface AlertEmailPayload {
  to: string[];
  organizationName: string;
  alertCount: number;
  // First few alerts shown inline so the email body is informative even
  // without opening the dashboard.
  preview: Array<{ title: string; body: string }>;
}

// Aggregate alert digest. The cron endpoint calls this once per organisation
// per run with the new alerts so admins get one email rather than N.
export async function sendAlertDigestEmail(payload: AlertEmailPayload): Promise<SendResult> {
  console.info(
    "[email:alerts] org=%s recipients=%d count=%d preview=%j",
    payload.organizationName,
    payload.to.length,
    payload.alertCount,
    payload.preview.slice(0, 3),
  );
  return { delivered: false, transport: "noop" };
}
