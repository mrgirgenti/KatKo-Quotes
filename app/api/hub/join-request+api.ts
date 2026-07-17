import { pool } from '@/lib/pool';
import { sendEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, orgId } = body ?? {};
    if (!email || !orgId) {
      return Response.json({ error: 'email and orgId required' }, { status: 400 });
    }

    const orgResult = await pool.query(
      `SELECT id, name, email AS "orgEmail" FROM "Organization" WHERE id = $1`,
      [orgId],
    );
    if (!orgResult.rows[0]) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }
    const org = orgResult.rows[0];

    // Find super admins of this org to notify
    const adminResult = await pool.query(
      `SELECT u.email, u."firstName", u."lastName"
       FROM "OrganizationMembership" om
       JOIN "User" u ON u.id = om."userId"
       WHERE om."organizationId" = $1 AND om.role = 'ORG_ADMIN' AND u."userType" = 'CLIENT'`,
      [orgId],
    );

    const origin = request.headers.get('origin') || '';
    const internalUrl = `${origin}/(tabs)/crm`;
    const subject = `Client Hub Join Request — ${org.name}`;
    const htmlBody = `
      <p><strong>${email}</strong> has requested to join the Client Hub for <strong>${org.name}</strong>.</p>
      <p>Log in to your dashboard to review and approve or deny this request.</p>
      <p><a href="${internalUrl}">View in Dashboard →</a></p>
    `;

    // Notify internal admin (Katalyst Ko)
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'hello@katalystko.com';
    await sendEmail({
      to: adminEmail,
      subject,
      html: `<p>New join request received.</p>${htmlBody}`,
      text: `${email} has requested to join the Client Hub for ${org.name}. Review at: ${internalUrl}`,
    }).catch(() => {});

    // Notify org super admins
    for (const admin of adminResult.rows) {
      await sendEmail({
        to: admin.email,
        subject: `New Request to Join Your Client Hub — ${org.name}`,
        html: `<p>Hi ${admin.firstName || 'there'},</p>${htmlBody}`,
        text: `${email} has requested to join the Client Hub for ${org.name}.`,
      }).catch(() => {});
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/hub/join-request]', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
