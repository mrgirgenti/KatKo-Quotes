import {
  sendEmail,
  buildClientInviteEmail,
  buildQuoteEmail,
  buildSubmissionConfirmationEmail,
  buildQuoteApprovedNotificationEmail,
} from '@/lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type } = body;

    if (type === 'client_invite') {
      const { clientEmail, clientName, orgName, portalUrl } = body;
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

    if (type === 'submission_confirmation') {
      const { clientEmail, clientName, projectName, orgName, inHandsDate, lineItems, notes, portalUrl } = body;
      if (!clientEmail || !clientName || !projectName || !orgName) {
        return Response.json({ error: 'Missing required fields' }, { status: 400 });
      }
      const { subject, html, text } = buildSubmissionConfirmationEmail({
        clientName,
        projectName,
        orgName,
        inHandsDate: inHandsDate || '',
        lineItems: Array.isArray(lineItems) ? lineItems : [],
        notes: notes || '',
        portalUrl: portalUrl || '',
      });
      const result = await sendEmail({ to: clientEmail, subject, html, text });
      if (result.error) {
        console.error('[send-email] submission_confirmation failed:', result.error);
        return Response.json({ error: result.error }, { status: 500 });
      }
      return Response.json({ ok: true, id: result.id });
    }

    if (type === 'quote_approved') {
      const { projectName, orgName, submittedBy, total, adminUrl } = body;
      if (!projectName || !orgName) {
        return Response.json({ error: 'Missing required fields: projectName, orgName' }, { status: 400 });
      }
      const { subject, html, text } = buildQuoteApprovedNotificationEmail({
        projectName,
        orgName,
        submittedBy: submittedBy || 'Client',
        total: total ?? null,
        adminUrl: adminUrl || '',
      });
      const result = await sendEmail({ to: 'jobs@katalystko.com', subject, html, text });
      if (result.error) {
        console.error('[send-email] quote_approved notification failed:', result.error);
        return Response.json({ error: result.error }, { status: 500 });
      }
      return Response.json({ ok: true, id: result.id });
    }

    return Response.json({ error: 'Unknown email type. Use: client_invite | quote | submission_confirmation | quote_approved' }, { status: 400 });
  } catch (err: any) {
    console.error('[POST /api/send-email]', err);
    return Response.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
