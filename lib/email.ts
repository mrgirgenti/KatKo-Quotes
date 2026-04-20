import { Resend } from 'resend';

const FROM = 'Katalyst Ko <jobs@katalystko.com>';
const REPLY_TO = 'jobs@katalystko.com';

async function getResendClient(): Promise<Resend> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (hostname && xReplitToken) {
    try {
      const data = await fetch(
        `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=resend`,
        {
          headers: {
            Accept: 'application/json',
            'X-Replit-Token': xReplitToken,
          },
        }
      ).then((r) => r.json());

      const apiKey = data.items?.[0]?.settings?.api_key;
      if (apiKey) return new Resend(apiKey);
    } catch {}
  }

  const envKey = process.env.RESEND_API_KEY;
  if (envKey) return new Resend(envKey);

  throw new Error('Resend not configured — add your API key via the Resend integration or RESEND_API_KEY secret.');
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ id?: string; error?: string }> {
  try {
    const resend = await getResendClient();
    const result = await resend.emails.send({
      from: FROM,
      reply_to: opts.replyTo ?? REPLY_TO,
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (result.error) {
      console.error('[email] Resend error:', result.error);
      return { error: result.error.message };
    }
    return { id: result.data?.id };
  } catch (err: any) {
    console.error('[email] sendEmail failed:', err?.message || err);
    return { error: err?.message || 'Unknown email error' };
  }
}

export function buildClientInviteEmail(opts: {
  clientName: string;
  orgName: string;
  portalUrl: string;
}): { subject: string; html: string; text: string } {
  const { clientName, orgName, portalUrl } = opts;
  const subject = `You've been invited to the ${orgName} client hub`;
  const text = [
    `Hi ${clientName},`,
    '',
    `You've been invited to the ${orgName} client portal by Katalyst Ko Printshop.`,
    '',
    `Access your portal here:`,
    `  ${portalUrl}`,
    '',
    `Through your portal you can:`,
    `  • Submit print requests`,
    `  • Review and approve quotes`,
    `  • View project status`,
    '',
    `Questions? Reply to this email or reach us at jobs@katalystko.com`,
    '',
    `— Katalyst Ko Printshop`,
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background:#FF5A00;padding:28px 32px;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;">KATALYST KO</p>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">Custom Apparel Printshop</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111;">You're invited!</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
            Hi ${clientName}, you've been invited to the <strong>${orgName}</strong> client portal by Katalyst Ko Printshop.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="background:#FF5A00;border-radius:8px;padding:0;">
              <a href="${portalUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#fff;text-decoration:none;">
                Access Your Portal →
              </a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#111;">Through your portal you can:</p>
          <ul style="margin:0 0 24px;padding-left:20px;color:#555;font-size:14px;line-height:1.8;">
            <li>Submit print requests</li>
            <li>Review and approve quotes</li>
            <li>View project status</li>
          </ul>
          <p style="margin:0;font-size:13px;color:#888;">
            Questions? Reply to this email or reach us at
            <a href="mailto:jobs@katalystko.com" style="color:#FF5A00;text-decoration:none;">jobs@katalystko.com</a>
          </p>
        </td></tr>
        <tr><td style="background:#F9FAFB;padding:20px 32px;border-top:1px solid #E5E7EB;">
          <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;">
            Quote prepared by Katalyst Ko Printshop · <a href="mailto:jobs@katalystko.com" style="color:#9CA3AF;">jobs@katalystko.com</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

export function buildQuoteEmail(opts: {
  clientName: string;
  projectName: string;
  total: number | null;
  portalUrl: string;
  waveLink?: string;
}): { subject: string; html: string; text: string } {
  const { clientName, projectName, total, portalUrl, waveLink } = opts;
  const formattedTotal =
    total != null
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total)
      : null;
  const subject = `Your quote from Katalyst Ko is ready — ${projectName}`;

  const textLines = [
    `Hi ${clientName},`,
    '',
    `Your quote from Katalyst Ko is ready! Here's a quick summary:`,
    '',
    `  Project: ${projectName}`,
    ...(formattedTotal ? [`  Total: ${formattedTotal}`] : []),
    '',
    `Review your full quote here:`,
    `  ${portalUrl}`,
    '',
    ...(waveLink
      ? [`To pay your invoice:`, `  ${waveLink}`, '']
      : []),
    `Questions? Reply to this email or reach us at jobs@katalystko.com`,
    '',
    `— Katalyst Ko Printshop`,
  ];

  const text = textLines.join('\n');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background:#FF5A00;padding:28px 32px;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;">KATALYST KO</p>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">Custom Apparel Printshop</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111;">Your quote is ready!</h1>
          <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">Hi ${clientName}, here's a summary of your quote from Katalyst Ko.</p>
          <table cellpadding="0" cellspacing="0" width="100%" style="background:#F9FAFB;border-radius:10px;margin-bottom:24px;">
            <tr><td style="padding:20px;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;">Project</p>
              <p style="margin:0;font-size:17px;font-weight:700;color:#111;">${projectName}</p>
              ${formattedTotal ? `<p style="margin:12px 0 0;font-size:24px;font-weight:800;color:#FF5A00;">${formattedTotal}</p>` : ''}
            </td></tr>
          </table>
          <table cellpadding="0" cellspacing="0" style="margin-bottom:${waveLink ? '16px' : '24px'};">
            <tr><td style="background:#FF5A00;border-radius:8px;">
              <a href="${portalUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#fff;text-decoration:none;">
                Review Your Quote →
              </a>
            </td></tr>
          </table>
          ${waveLink ? `
          <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td style="background:#16A34A;border-radius:8px;">
              <a href="${waveLink}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#fff;text-decoration:none;">
                Pay Invoice →
              </a>
            </td></tr>
          </table>` : ''}
          <p style="margin:0;font-size:13px;color:#888;">
            Questions? Reply to this email or reach us at
            <a href="mailto:jobs@katalystko.com" style="color:#FF5A00;text-decoration:none;">jobs@katalystko.com</a>
          </p>
        </td></tr>
        <tr><td style="background:#F9FAFB;padding:20px 32px;border-top:1px solid #E5E7EB;">
          <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;">
            Quote prepared by Katalyst Ko Printshop · <a href="mailto:jobs@katalystko.com" style="color:#9CA3AF;">jobs@katalystko.com</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
