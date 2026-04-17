import { pool } from '@/lib/pool';

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
    const salesData = p.salesData || {};

    const existingInvoice = await pool.query(
      `SELECT id FROM "Invoice" WHERE "projectId" = $1 LIMIT 1`,
      [id],
    );
    if (existingInvoice.rows[0]) {
      return Response.json({ invoiceId: existingInvoice.rows[0].id, created: false });
    }

    let quoteId: string | null = null;
    const quoteResult = await pool.query(
      `SELECT id FROM "Quote" WHERE "projectId" = $1 ORDER BY "versionNumber" DESC LIMIT 1`,
      [id],
    );
    if (quoteResult.rows[0]) {
      quoteId = quoteResult.rows[0].id;
    } else {
      const subtotal = parseFloat(calc.subtotal ?? 0) || 0;
      const taxAmount = parseFloat(calc.salesTax ?? 0) || 0;
      const onlineFee = parseFloat(calc.onlineFee ?? 0) || 0;
      const cardFee = parseFloat(calc.cardFee ?? 0) || 0;
      const total = parseFloat(calc.total ?? 0) || 0;
      const q = await pool.query(
        `INSERT INTO "Quote" (
          id, "projectId", "versionNumber", status,
          subtotal, "setupFees", "designFees", "shippingCost", "taxAmount", total,
          "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), $1, 1, 'APPROVED'::"QuoteStatus",
          $2, $3, 0, 0, $4, $5,
          NOW(), NOW()
        ) RETURNING id`,
        [id, subtotal, onlineFee + cardFee, taxAmount, total],
      );
      quoteId = q.rows[0].id;
    }

    const amountCollected = parseFloat(salesData.amountCollected ?? 0) || 0;
    const actualTax = parseFloat(salesData.actualSalesTax ?? calc.salesTax ?? 0) || 0;
    const invoiceTotal = amountCollected > 0 ? amountCollected : (parseFloat(calc.total ?? 0) || 0);
    const invoiceStatus = amountCollected > 0 ? 'PAID' : 'DRAFT';
    const paidAt = salesData.completedDate
      ? new Date(salesData.completedDate)
      : amountCollected > 0 ? new Date() : null;

    const result = await pool.query(
      `INSERT INTO "Invoice" (
        id, "projectId", "quoteId", "invoiceNumber", status,
        subtotal, "taxAmount", total, "amountPaid", "paidAt",
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4::"InvoiceStatus",
        $5, $6, $7, $8, $9,
        NOW(), NOW()
      ) RETURNING id`,
      [
        id,
        quoteId,
        p.invoiceNumber || null,
        invoiceStatus,
        invoiceTotal,
        actualTax,
        invoiceTotal,
        amountCollected,
        paidAt,
      ],
    );

    return Response.json({ invoiceId: result.rows[0].id, created: true }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/projects/:id/invoice]', err);
    return Response.json({ error: 'Failed to create invoice record' }, { status: 500 });
  }
}
