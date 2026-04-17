import { pool } from '@/lib/pool';

function frontendStatusToQuoteStatus(s: string): string {
  switch (s) {
    case 'draft': return 'DRAFT';
    case 'quoted': return 'SENT';
    case 'active':
    case 'production_started':
    case 'completed': return 'APPROVED';
    case 'expired': return 'EXPIRED';
    default: return 'DRAFT';
  }
}

export async function POST(_req: Request, { id }: { id: string }) {
  try {
    const projectResult = await pool.query(
      `SELECT * FROM "Project" WHERE id = $1`,
      [id],
    );
    if (!projectResult.rows[0]) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }
    const p = projectResult.rows[0];
    const calc = p.calculations || {};
    const quoteStatus = frontendStatusToQuoteStatus(p.frontendStatus || 'draft');

    const subtotal = parseFloat(calc.subtotal ?? calc.cogTotal ?? 0) || 0;
    const taxAmount = parseFloat(calc.salesTax ?? 0) || 0;
    const onlineFee = parseFloat(calc.onlineFee ?? 0) || 0;
    const cardFee = parseFloat(calc.cardFee ?? 0) || 0;
    const setupFees = onlineFee + cardFee;
    const total = parseFloat(calc.total ?? 0) || 0;

    const existing = await pool.query(
      `SELECT id FROM "Quote" WHERE "projectId" = $1 ORDER BY "versionNumber" DESC LIMIT 1`,
      [id],
    );
    if (existing.rows[0]) {
      return Response.json({ quoteId: existing.rows[0].id, created: false });
    }

    const result = await pool.query(
      `INSERT INTO "Quote" (
        id, "projectId", "versionNumber", status,
        subtotal, "setupFees", "designFees", "shippingCost", "taxAmount", total,
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, 1, $2::"QuoteStatus",
        $3, $4, 0, 0, $5, $6,
        NOW(), NOW()
      ) RETURNING id`,
      [id, quoteStatus, subtotal, setupFees, taxAmount, total],
    );

    return Response.json({ quoteId: result.rows[0].id, created: true }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/projects/:id/quote]', err);
    return Response.json({ error: 'Failed to create quote record' }, { status: 500 });
  }
}
