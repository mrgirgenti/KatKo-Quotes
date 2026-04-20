import { sendEmail, buildClientInviteEmail, buildQuoteEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type } = body;

    if (type === 'client_invite') {
      const { clientName, orgName, portalUrl, clientEmail } = body;
      if (!clientEmail || !clientName || !orgName || !portalUrl) {
        return Response.json({ error: 'Missing required fields: clientEmail, clientName, orgName, portalUrl' }, { status: 400 });
      }
      const { subject, html, text } = buildClientInviteEmail({ clientName, orgName, portalUrl });
      const result = await sendEmail({ to: clientEmail, subject, html, text });
      if (result.error) return Response.json({ error: result.error }, { status: 500 });
      return Response.json({ ok: true, id: result.id });
    }

    if (type === 'quote') {
      const { clientEmail, clientName, projectName, total, portalUrl, waveLink } = body;
      if (!clientEmail || !clientName || !projectName || !portalUrl) {
        return Response.json({ error: 'Missing required fields: clientEmail, clientName, projectName, portalUrl' }, { status: 400 });
      }
      const { subject, html, text } = buildQuoteEmail({ clientName, projectName, total: total ?? null, portalUrl, waveLink });
      const result = await sendEmail({ to: clientEmail, subject, html, text });
      if (result.error) return Response.json({ error: result.error }, { status: 500 });
      return Response.json({ ok: true, id: result.id });
    }

    return Response.json({ error: 'Unknown email type. Use: client_invite | quote' }, { status: 400 });
  } catch (err: any) {
    console.error('[POST /api/send-email]', err);
    return Response.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
