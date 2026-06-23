// Single source of truth for Katalyst Ko company identity used across the
// Project Document system (Quote / Invoice / Production Punch Sheet / Order Detail),
// both the on-screen Client Hub view and the generated PDFs.

export const COMPANY = {
  name: 'Katalyst Ko',
  tagline: 'Custom Apparel Printshop',
  phone: '(480) 559-9033',
  web: 'www.katalystko.com',
  email: 'jobs@katalystko.com',
  addressLines: ['921 S Val Vista Dr Unit 116', 'Mesa, Arizona 85204', 'United States'],
  // Absolute URL works in every context (native expo-print, web iframe, downloaded html).
  logoUrl: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/4xwcbfcj6r2usqk7tds89',
  logoFallback: '/katalyst-logo.png',
} as const;
