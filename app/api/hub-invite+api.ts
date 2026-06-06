import { pool } from '@/lib/pool';
import { sendEmail, buildClientInviteEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgId, name, email, orgName, portalUrl } = body;
    if (!orgId || !email || !name) {
      return Response.json({ error: 'orgId, name, and email are required' }, { status: 400 });
    }

    const emailLower = email.trim().toLowerCase();

    // Find or create the client User
    const existing = await pool.query(
      `SELECT id, status FROM "User" WHERE LOWER(email) = $1`,
      [emailLower],
    );

    let userId: string;
    if (existing.rows[0]) {
      userId = existing.rows[0].id;
      if (existing.rows[0].status === 'DISABLED') {
        return Response.json({ error: 'This user account is disabled. Re-enable it first.' }, { status: 409 });
      }
    } else {
      const nameParts = (name.trim()).split(/\s+/);
      const firstName = nameParts[0] || 'User';
      const lastName = nameParts.slice(1).join(' ') || '';
      const newUser = await pool.query(
        `INSERT INTO "User" (id, "firstName", "lastName", email, "userType", status, "internalRole", "avatarColor", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, 'CLIENT'::"UserType", 'INVITED'::"UserStatus", 'SALES'::"InternalRole", '#6366F1', NOW(), NOW())
         RETURNING id`,
        [firstName, lastName, emailLower],
      );
      userId = newUser.rows[0].id;
    }

    // Upsert membership and stamp inviteSentAt
    const membershipRes = await pool.query(
      `INSERT INTO "OrganizationMembership" (
        id, "organizationId", "userId", role,
        "isPrimaryContact", "canManageUsers", "canSubmitProjects",
        "canViewProjects", "canViewInvoices", "canPayInvoices", "canApproveQuotes",
        "inviteSentAt", "createdAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, 'MEMBER'::"MembershipRole",
        false, false, true, true, false, false, false,
        NOW(), NOW()
      )
      ON CONFLICT ("organizationId", "userId") DO UPDATE SET
        "inviteSentAt" = NOW()
      RETURNING id`,
      [orgId, userId],
    );
    const membershipId = membershipRes.rows[0].id;

    // Send invite email
    const { subject, html, text } = buildClientInviteEmail({
      clientName: name.trim(),
      orgName: orgName || 'your organization',
      portalUrl: portalUrl || `/portal/${orgId}`,
    });
    const emailResult = await sendEmail({ to: emailLower, subject, html, text });
    if (emailResult.error) {
      console.error('[hub-invite] Email failed:', emailResult.error);
    }

    // Log activity
    await pool.query(
      `INSERT INTO "ActivityLog" (id, "organizationId", "actionType", "actionSummary", metadata, "createdAt")
       VALUES (gen_random_uuid(), $1, 'hub_invite_sent', $2, $3, NOW())`,
      [
        orgId,
        `Hub invite sent to ${name.trim()} (${emailLower})`,
        JSON.stringify({ email: emailLower, name: name.trim(), membershipId, emailSent: !emailResult.error }),
      ],
    );

    return Response.json({ ok: true, userId, membershipId, emailSent: !emailResult.error });
  } catch (err: any) {
    console.error('[POST /api/hub-invite]', err);
    if (err?.code === '23505') {
      return Response.json({ error: 'A user with this email already exists in this hub.' }, { status: 409 });
    }
    return Response.json({ error: 'Failed to send invite' }, { status: 500 });
  }
}
