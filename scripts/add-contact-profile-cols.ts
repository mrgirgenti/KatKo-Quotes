import { pool } from '../lib/pool';

const alters = [
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "preferredName" text`,
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "mobilePhone" text`,
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "officePhone" text`,
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "extension" text`,
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "preferredContactMethod" text`,
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "birthday" text`,
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "weddingAnniversary" text`,
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "spouseName" text`,
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "children" text`,
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "favoriteSportsTeam" text`,
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "favoriteDrink" text`,
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "shirtSize" text`,
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "hatSize" text`,
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "personalNotes" text`,
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "preferredDecorationMethod" text`,
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "preferredApparelBrand" text`,
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "typicalOrderSize" text`,
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "taxExempt" boolean NOT NULL DEFAULT false`,
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "purchaseOrderRequired" boolean NOT NULL DEFAULT false`,
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "preferredShippingMethod" text`,
];

async function run() {
  for (const sql of alters) {
    await pool.query(sql);
    console.log('✓', sql.slice(0, 70));
  }
  await pool.end();
  console.log('\nAll contact profile columns added successfully.');
}

run().catch((e) => { console.error(e); process.exit(1); });
