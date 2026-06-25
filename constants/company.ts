// Single source of truth for Katalyst Ko company identity used across the
// Project Document system (Quote / Invoice / Production Punch Sheet / Order Detail),
// both the on-screen Client Hub view and the generated PDFs.
//
// LOGO: The primary brand asset is the horizontal "KATALYST KO | KO." wordmark
// (ko-logo-horizontal.png). logoUrl is embedded as a base64 data URI so it
// renders correctly in every context: native expo-print, web print dialog,
// downloaded HTML file, and iframes — no network request required.

import { KO_LOGO_HORIZONTAL_URI } from '@/constants/logoDataUri';

export const COMPANY = {
  name: 'Katalyst Ko',
  tagline: 'Custom Apparel Printshop',
  phone: '(480) 559-9033',
  web: 'www.katalystko.com',
  email: 'jobs@katalystko.com',
  addressLines: ['921 S Val Vista Dr Unit 116', 'Mesa, Arizona 85204', 'United States'],
  logoUrl: KO_LOGO_HORIZONTAL_URI,
  logoFallback: '/ko-logo-horizontal.png',
} as const;
