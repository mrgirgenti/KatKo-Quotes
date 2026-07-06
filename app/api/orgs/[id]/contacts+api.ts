import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';
import { formatPhoneOrNull } from '@/utils/phone';

function toContact(c: any) {
  return {
    id: c.id,
    organizationId: c.organizationId ?? undefined,
    firstName: c.firstName,
    lastName: c.lastName,
    title: c.title ?? undefined,
    role: c.role ?? undefined,
    email: c.email ?? undefined,
    phone: c.phone ?? undefined,
    department: c.department ?? undefined,
    notes: c.notes ?? undefined,
    isPrimary: c.isPrimary ?? false,
    linkedUserId: c.linkedUserId ?? undefined,
    // Extended profile fields
    preferredName: c.preferredName ?? undefined,
    mobilePhone: c.mobilePhone ?? undefined,
    officePhone: c.officePhone ?? undefined,
    extension: c.extension ?? undefined,
    preferredContactMethod: c.preferredContactMethod ?? undefined,
    birthday: c.birthday ?? undefined,
    weddingAnniversary: c.weddingAnniversary ?? undefined,
    spouseName: c.spouseName ?? undefined,
    children: c.children ?? undefined,
    favoriteSportsTeam: c.favoriteSportsTeam ?? undefined,
    favoriteDrink: c.favoriteDrink ?? undefined,
    shirtSize: c.shirtSize ?? undefined,
    hatSize: c.hatSize ?? undefined,
    personalNotes: c.personalNotes ?? undefined,
    preferredDecorationMethod: c.preferredDecorationMethod ?? undefined,
    preferredApparelBrand: c.preferredApparelBrand ?? undefined,
    typicalOrderSize: c.typicalOrderSize ?? undefined,
    taxExempt: c.taxExempt ?? false,
    purchaseOrderRequired: c.purchaseOrderRequired ?? false,
    preferredShippingMethod: c.preferredShippingMethod ?? undefined,
    createdAt: new Date(c.createdAt).toISOString(),
  };
}

export async function POST(request: Request, { id }: { id: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  try {
    const body = await request.json();

    if (body.email) {
      const existing = await pool.query(
        `SELECT id FROM "Contact" WHERE "organizationId" = $1 AND LOWER(email) = LOWER($2) LIMIT 1`,
        [id, body.email],
      );
      if (existing.rows[0]) {
        const updated = await pool.query(
          `UPDATE "Contact"
           SET "linkedUserId" = $1, "updatedAt" = NOW()
           WHERE id = $2
           RETURNING *`,
          [body.linkedUserId ?? null, existing.rows[0].id],
        );
        const c = updated.rows[0];
        return Response.json(toContact(c), { status: 200 });
      }
    }

    const result = await pool.query(
      `INSERT INTO "Contact" (
        id, "organizationId", "firstName", "lastName", email, phone, title, role,
        notes, "isPrimary", "linkedUserId", department,
        "preferredName", "mobilePhone", "officePhone", extension, "preferredContactMethod",
        birthday, "weddingAnniversary", "spouseName", children,
        "favoriteSportsTeam", "favoriteDrink", "shirtSize", "hatSize", "personalNotes",
        "preferredDecorationMethod", "preferredApparelBrand", "typicalOrderSize",
        "taxExempt", "purchaseOrderRequired", "preferredShippingMethod",
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13, $14, $15, $16,
        $17, $18, $19, $20,
        $21, $22, $23, $24, $25,
        $26, $27, $28,
        $29, $30, $31,
        NOW(), NOW()
      ) RETURNING *`,
      [
        id,
        body.firstName || '',
        body.lastName || '',
        body.email ?? null,
        formatPhoneOrNull(body.phone),
        body.title ?? null,
        body.role ?? null,
        body.notes ?? null,
        body.isPrimary ?? false,
        body.linkedUserId ?? null,
        body.department ?? null,
        body.preferredName ?? null,
        formatPhoneOrNull(body.mobilePhone),
        formatPhoneOrNull(body.officePhone),
        body.extension ?? null,
        body.preferredContactMethod ?? null,
        body.birthday ?? null,
        body.weddingAnniversary ?? null,
        body.spouseName ?? null,
        body.children ?? null,
        body.favoriteSportsTeam ?? null,
        body.favoriteDrink ?? null,
        body.shirtSize ?? null,
        body.hatSize ?? null,
        body.personalNotes ?? null,
        body.preferredDecorationMethod ?? null,
        body.preferredApparelBrand ?? null,
        body.typicalOrderSize ?? null,
        body.taxExempt ?? false,
        body.purchaseOrderRequired ?? false,
        body.preferredShippingMethod ?? null,
      ],
    );
    return Response.json(toContact(result.rows[0]), { status: 201 });
  } catch (err) {
    console.error('[POST /api/orgs/:id/contacts]', err);
    return Response.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}
