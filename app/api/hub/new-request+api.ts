import { pool } from '@/lib/pool';
import { sendEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyName, firstName, lastName, email, phone, team = [] } = body ?? {};
    if (!companyName || !firstName || !email) {
      return Response.json({ error: 'companyName, firstName, and email are required.' }, { status: 400 });
    }

    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'hello@katalystko.com';
    const teamLines = (team as { name: string; email: string }[])
      .filter(m => m.email)
      .map(m => `  • ${m.name || '(no name)'} — ${m.email}`)
      .join('\n');

    const subject = `New Client Hub Request — ${companyName}`;
    const html = `
      <h2>New Client Hub Request</h2>
      <table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">
        <tr><td><strong>Company</strong></td><td>${companyName}</td></tr>
        <tr><td><strong>Name</strong></td><td>${firstName} ${lastName || ''}</td></tr>
        <tr><td><strong>Email</strong></td><td>${email}</td></tr>
        ${phone ? `<tr><td><strong>Phone</strong></td><td>${phone}</td></tr>` : ''}
        ${teamLines ? `<tr><td><strong>Team</strong></td><td><pre style="margin:0">${teamLines}</pre></td></tr>` : ''}
      </table>
      <br>
      <p>Log in to your dashboard to review this request and create their account.</p>
    `;
    const text = [
      `New Client Hub Request`,
      `Company: ${companyName}`,
      `Name: ${firstName} ${lastName || ''}`,
      `Email: ${email}`,
      phone ? `Phone: ${phone}` : '',
      teamLines ? `Team:\n${teamLines}` : '',
    ].filter(Boolean).join('\n');

    await sendEmail({ to: adminEmail, subject, html, text });

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/hub/new-request]', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
