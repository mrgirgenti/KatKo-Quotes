import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { Quote, LineItem, SIZE_LABELS } from '@/types/quote';
import { formatCurrency } from '@/utils/quoteCalculations';
import { formatPhone } from '@/utils/phone';
import { UserProfile } from '@/types/user';

function getTotalSizeQuantities(item: LineItem): string {
  const sizes: string[] = [];
  SIZE_LABELS.forEach(({ key, label }) => {
    if (item.sizes[key] > 0) {
      sizes.push(`${label}: ${item.sizes[key]}`);
    }
  });
  if (item.sizes.flat > 0) {
    sizes.push(`Flat: ${item.sizes.flat}`);
  }
  return sizes.join(', ') || 'No quantities';
}

function getItemQuantity(item: LineItem): number {
  return Object.values(item.sizes).reduce((sum, qty) => sum + qty, 0);
}

function generateQuoteHTML(quote: Quote, user?: UserProfile | null): string {
  const lineItemsHTML = quote.lineItems.map((item, index) => `
    <div class="line-item">
      <div class="line-item-header">
        <span class="line-number">#${index + 1}</span>
        <div class="line-header-info">
          <span class="design-name">${item.designName || 'Untitled Design'}</span>
          <span class="line-service">${item.serviceStyle}${item.applicator ? ` · ${item.applicator}` : ''}</span>
        </div>
        <span class="line-qty">${getItemQuantity(item)} pcs</span>
      </div>
      <table class="details-table">
        <tr><td class="label">Product:</td><td>${item.product} — ${item.productColor}</td></tr>
        <tr><td class="label">Source:</td><td>${item.apparelProvider}</td></tr>
        <tr><td class="label">Location:</td><td>${[item.location1, item.location2].filter(Boolean).join(', ') || 'N/A'}${item.locationDetails ? ` — ${item.locationDetails}` : ''}</td></tr>
        <tr><td class="label">Sizes:</td><td>${getTotalSizeQuantities(item)}</td></tr>
      </table>
      <div class="costs-row">
        <div class="cost-item">
          <span class="cost-label">Product Cost</span>
          <span class="cost-value">${formatCurrency(item.productCostEach)}/ea</span>
        </div>
        <div class="cost-item">
          <span class="cost-label">Service Cost</span>
          <span class="cost-value">${formatCurrency(item.serviceCostEach)}/ea</span>
        </div>
        <div class="cost-item">
          <span class="cost-label">Service Fees</span>
          <span class="cost-value">${formatCurrency(item.serviceFeeEach)}/ea</span>
        </div>
        <div class="cost-item">
          <span class="cost-label">Markup</span>
          <span class="cost-value">${formatCurrency(item.markupEach || 0)}/ea</span>
        </div>
      </div>
    </div>
  `).join('');

  const statusLabel = quote.status === 'active' ? 'ACTIVE' : quote.status === 'completed' ? 'COMPLETED' : 'QUOTE';
  const statusClass = quote.status === 'active' || quote.status === 'completed' ? 'sale-badge' : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${quote.personOrganization} — ${quote.projectName}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 36px; color: #1a1a1a; font-size: 12px; }
        .header { border-bottom: 3px solid #FF5A00; padding-bottom: 18px; margin-bottom: 20px; }
        .header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
        .company-name { font-size: 22px; font-weight: 700; color: #FF5A00; }
        .company-details { font-size: 11px; color: #666; margin-top: 3px; }
        .quote-badge { background: #FF5A00; color: white; padding: 6px 14px; border-radius: 4px; font-weight: 700; font-size: 12px; letter-spacing: 1px; }
        .sale-badge { background: #059669; }
        .client-info { margin-top: 14px; }
        .client-name { font-size: 20px; font-weight: 700; }
        .project-name { font-size: 14px; color: #444; margin-top: 3px; }
        .invoice-number { font-size: 12px; color: #FF5A00; font-weight: 600; margin-top: 6px; }
        .section { margin-bottom: 20px; }
        .section-title { font-size: 11px; font-weight: 700; margin-bottom: 10px; color: #fff; background: #111; padding: 6px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .info-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
        .info-value { font-size: 13px; font-weight: 600; margin-top: 2px; }
        .line-item { border: 1px solid #e5e5e5; border-radius: 8px; margin-bottom: 10px; overflow: hidden; }
        .line-item-header { display: flex; align-items: center; gap: 10px; background: #111; padding: 10px 14px; }
        .line-number { background: #FF5A00; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; flex-shrink: 0; }
        .line-header-info { flex: 1; }
        .design-name { font-weight: 600; font-size: 13px; color: #fff; display: block; }
        .line-service { font-size: 11px; color: rgba(255,255,255,0.6); display: block; margin-top: 1px; }
        .line-qty { font-size: 12px; font-weight: 700; color: #FF5A00; flex-shrink: 0; }
        .details-table { width: 100%; font-size: 11px; padding: 10px 14px; }
        .details-table td { padding: 3px 0; }
        .details-table .label { color: #888; width: 70px; font-weight: 600; }
        .costs-row { display: flex; gap: 8px; padding: 10px 14px; background: #f9f9f9; border-top: 1px solid #eee; }
        .cost-item { flex: 1; text-align: center; }
        .cost-label { display: block; font-size: 10px; color: #888; text-transform: uppercase; }
        .cost-value { display: block; font-size: 12px; font-weight: 600; margin-top: 2px; }
        .summary-table { width: 100%; border-collapse: collapse; }
        .summary-table td { padding: 5px 0; font-size: 12px; }
        .summary-table .label-col { color: #555; }
        .summary-table .val-col { text-align: right; font-weight: 500; }
        .summary-table .bold td { font-weight: 700; color: #111; }
        .summary-table .divider td { border-top: 1px solid #e5e5e5; padding-top: 8px; margin-top: 4px; }
        .total-box { background: #FF5A00; color: white; border-radius: 8px; padding: 14px 16px; margin-top: 12px; display: flex; justify-content: space-between; align-items: center; }
        .total-label { font-size: 14px; font-weight: 700; letter-spacing: 1px; }
        .total-values { text-align: right; }
        .total-main { font-size: 24px; font-weight: 800; }
        .total-per-piece { font-size: 12px; opacity: 0.8; margin-top: 2px; }
        .markup-highlight { color: #16A34A; font-weight: 700; }
        .sales-section { margin-top: 20px; }
        .profit-box { color: white; border-radius: 8px; padding: 14px; margin-top: 12px; display: flex; justify-content: space-between; align-items: center; }
        .profit-positive { background: #059669; }
        .profit-negative { background: #dc2626; }
        .profit-label { font-size: 12px; font-weight: 700; letter-spacing: 0.5px; }
        .profit-values { text-align: right; }
        .profit-amount { font-size: 22px; font-weight: 800; }
        .profit-margin { font-size: 11px; opacity: 0.8; }
        .footer { margin-top: 28px; text-align: center; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 14px; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-top">
          <div>
            <div class="company-name">${user?.businessName || 'Katalyst Ko Printshop'}</div>
            ${user?.email || user?.phone ? `<div class="company-details">${[user.email, formatPhone(user.phone)].filter(Boolean).join(' · ')}</div>` : ''}
          </div>
          <div class="quote-badge ${statusClass}">${statusLabel}</div>
        </div>
        <div class="client-info">
          <div class="client-name">${quote.personOrganization}</div>
          <div class="project-name">${quote.projectName}</div>
          ${quote.invoiceNumber ? `<div class="invoice-number">Invoice #${quote.invoiceNumber}</div>` : ''}
        </div>
      </div>

      <div class="section">
        <div class="section-title">Order Information</div>
        <div class="info-grid">
          <div>
            <div class="info-label">Order Date</div>
            <div class="info-value">${quote.orderDate || 'N/A'}</div>
          </div>
          <div>
            <div class="info-label">In-Hands Date</div>
            <div class="info-value">${quote.inHandsDate || 'N/A'}</div>
          </div>
          <div>
            <div class="info-label">Order Type</div>
            <div class="info-value">${quote.orderType}</div>
          </div>
          <div>
            <div class="info-label">Total Quantity</div>
            <div class="info-value">${quote.calculations.totalQuantity} pcs</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Line Items (${quote.lineItems.length})</div>
        ${lineItemsHTML}
      </div>

      <div class="section">
        <div class="section-title">Pricing Summary</div>
        <table class="summary-table">
          <tr><td class="label-col">Product Cost</td><td class="val-col">${formatCurrency(quote.calculations.productCostEach)}/ea</td><td class="val-col">${formatCurrency(quote.calculations.productCostTotal)}</td></tr>
          <tr><td class="label-col">Service Cost</td><td class="val-col">${formatCurrency(quote.calculations.serviceCostEach)}/ea</td><td class="val-col">${formatCurrency(quote.calculations.serviceCostTotal)}</td></tr>
          <tr><td class="label-col">Service Fees</td><td class="val-col">${formatCurrency(quote.calculations.serviceFeeEach)}/ea</td><td class="val-col">${formatCurrency(quote.calculations.serviceFeeTotal)}</td></tr>
          <tr class="divider bold"><td class="label-col">Cost of Goods</td><td class="val-col">${formatCurrency(quote.calculations.cogEach)}/ea</td><td class="val-col">${formatCurrency(quote.calculations.cogTotal)}</td></tr>
          <tr><td class="label-col markup-highlight">Markup (${quote.calculations.markupPercentage.toFixed(1)}%)</td><td class="val-col markup-highlight">${formatCurrency(quote.calculations.totalQuantity > 0 ? quote.calculations.markupAmount / quote.calculations.totalQuantity : 0)}/ea</td><td class="val-col markup-highlight">${formatCurrency(quote.calculations.markupAmount)}</td></tr>
          <tr class="divider bold"><td class="label-col">Subtotal</td><td class="val-col">${formatCurrency(quote.calculations.totalQuantity > 0 ? quote.calculations.subtotal / quote.calculations.totalQuantity : 0)}/ea</td><td class="val-col">${formatCurrency(quote.calculations.subtotal)}</td></tr>
          ${quote.hasOnlineFee ? `<tr><td class="label-col">Online Fee (2.9% + $0.60)</td><td></td><td class="val-col">${formatCurrency(quote.calculations.onlineFee)}</td></tr>` : ''}
          ${quote.hasSalesTax ? `<tr><td class="label-col">Sales Tax (8.3%)</td><td></td><td class="val-col">${formatCurrency(quote.calculations.salesTax)}</td></tr>` : ''}
          ${quote.hasCardFee ? `<tr><td class="label-col">Card Fee (3.75%)</td><td></td><td class="val-col">${formatCurrency(quote.calculations.cardFee)}</td></tr>` : ''}
        </table>
        <div class="total-box">
          <span class="total-label">TOTAL</span>
          <div class="total-values">
            <div class="total-main">${formatCurrency(quote.calculations.total)}</div>
            <div class="total-per-piece">${formatCurrency(quote.calculations.totalPerPiece)}/ea · ${quote.calculations.totalQuantity} pcs</div>
          </div>
        </div>
      </div>

      ${(quote.status === 'active' || quote.status === 'completed') && quote.salesData ? generateSalesHTML(quote) : ''}

      <div class="footer">
        Generated ${new Date().toLocaleDateString()} · ${user?.businessName || 'Katalyst Ko Printshop'}
      </div>
    </body>
    </html>
  `;
}

function generateSalesHTML(quote: Quote): string {
  if (!quote.salesData) return '';

  const serviceFeesCost = quote.salesData.actualServiceFeesCost ?? 0;
  const serviceFeesProfit = quote.salesData.actualServiceFeesProfit ?? 0;
  const onlineFee = quote.salesData.actualOnlineFee ?? 0;
  const salesTax = quote.salesData.actualSalesTax ?? 0;
  const cardFee = quote.salesData.actualCardFee ?? 0;

  const actualCOG = quote.salesData.actualProductCost + quote.salesData.actualServiceCost +
    serviceFeesCost + quote.salesData.actualOtherCosts;
  const actualTotalWithFees = actualCOG + onlineFee + salesTax + cardFee;
  const actualProfit = quote.salesData.amountCollected - actualTotalWithFees + serviceFeesProfit;
  const actualProfitMargin = quote.salesData.amountCollected > 0
    ? ((actualProfit / quote.salesData.amountCollected) * 100)
    : 0;
  const quotedVsActualCOGDiff = quote.calculations.cogTotal - actualCOG;
  const quotedVsActualProfitDiff = actualProfit - quote.calculations.markupAmount;

  return `
    <div class="section sales-section">
      <div class="section-title">Sales Tracking</div>
      <table class="summary-table">
        <tr><td class="label-col">Product Cost</td><td class="val-col" style="color:#888">Quoted: ${formatCurrency(quote.calculations.productCostTotal)}</td><td class="val-col">Actual: ${formatCurrency(quote.salesData.actualProductCost)}</td></tr>
        <tr><td class="label-col">Service Cost</td><td class="val-col" style="color:#888">Quoted: ${formatCurrency(quote.calculations.serviceCostTotal)}</td><td class="val-col">Actual: ${formatCurrency(quote.salesData.actualServiceCost)}</td></tr>
        <tr><td class="label-col">Service Fees</td><td class="val-col" style="color:#888">Quoted: ${formatCurrency(quote.calculations.serviceFeeTotal)}</td><td class="val-col">Actual: ${formatCurrency(serviceFeesCost)}</td></tr>
        ${quote.salesData.actualOtherCosts > 0 ? `<tr><td class="label-col">Other Costs</td><td></td><td class="val-col">${formatCurrency(quote.salesData.actualOtherCosts)}</td></tr>` : ''}
        <tr class="divider bold"><td class="label-col">Cost of Goods</td><td class="val-col" style="color:#888">${formatCurrency(quote.calculations.cogTotal)}</td><td class="val-col">${formatCurrency(actualCOG)}</td></tr>
        ${onlineFee > 0 ? `<tr><td class="label-col">Online Fee</td><td></td><td class="val-col">${formatCurrency(onlineFee)}</td></tr>` : ''}
        ${salesTax > 0 ? `<tr><td class="label-col">Sales Tax</td><td></td><td class="val-col">${formatCurrency(salesTax)}</td></tr>` : ''}
        ${cardFee > 0 ? `<tr><td class="label-col">Card Fee</td><td></td><td class="val-col">${formatCurrency(cardFee)}</td></tr>` : ''}
        <tr class="divider"><td class="label-col" style="font-weight:600">Amount Collected</td><td></td><td class="val-col" style="font-weight:700;font-size:14px">${formatCurrency(quote.salesData.amountCollected)}</td></tr>
      </table>
      <div class="profit-box ${actualProfit >= 0 ? 'profit-positive' : 'profit-negative'}">
        <span class="profit-label">ACTUAL PROFIT</span>
        <div class="profit-values">
          <div class="profit-amount">${formatCurrency(actualProfit)}</div>
          <div class="profit-margin">${actualProfitMargin.toFixed(1)}% margin</div>
        </div>
      </div>
      ${quote.salesData.notes ? `<p style="margin-top:12px;font-size:12px;color:#666;font-style:italic">${quote.salesData.notes}</p>` : ''}
    </div>
  `;
}

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9 _\-]/g, '').trim().replace(/\s+/g, '_').slice(0, 40);
}

// ─── Work Order ───────────────────────────────────────────────────────────────

function groupLineItemsByApplicator(lineItems: LineItem[]): Map<string, LineItem[]> {
  const map = new Map<string, LineItem[]>();
  lineItems.forEach((item) => {
    const key = (item.applicator || 'Unassigned').trim() || 'Unassigned';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  });
  return map;
}

function generateSizeGrid(item: LineItem): string {
  const sizeRows = SIZE_LABELS
    .filter(({ key }) => item.sizes[key] > 0)
    .map(({ key, label }) => `<td class="sz-cell">${item.sizes[key]}</td>`)
    .join('');
  const sizeHeaders = SIZE_LABELS
    .filter(({ key }) => item.sizes[key] > 0)
    .map(({ label }) => `<th class="sz-cell">${label}</th>`)
    .join('');
  const hasFlat = item.sizes.flat > 0;
  if (!sizeHeaders && !hasFlat) return '<p style="color:#888;font-size:11px">No quantities set</p>';
  return `
    <table class="sz-table">
      <thead><tr>${sizeHeaders}${hasFlat ? '<th class="sz-cell">Flat</th>' : ''}</tr></thead>
      <tbody><tr>${sizeRows}${hasFlat ? `<td class="sz-cell">${item.sizes.flat}</td>` : ''}</tr></tbody>
    </table>`;
}

const LOGO_URL = 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/4xwcbfcj6r2usqk7tds89';

function generateWorkOrderHTML(
  quote: Quote,
  applicator: string,
  items: LineItem[],
  user?: UserProfile | null,
): string {
  const totalQty = items.reduce((sum, i) => sum + getItemQuantity(i), 0);

  const lineItemsHTML = items.map((item, index) => {
    const qty = getItemQuantity(item);
    const locations = [item.location1, item.location2, item.location3, item.location4].filter(Boolean).join(', ') || 'N/A';

    const variants: Array<{ product: string; color: string; sizes: typeof item.sizes }> =
      item.garmentVariants && item.garmentVariants.length > 0
        ? item.garmentVariants
        : [{ product: item.product, color: item.productColor, sizes: item.sizes }];

    const variantSectionsHTML = variants.map((v, vi) => {
      const vQty = getItemQuantity({ ...item, sizes: v.sizes });
      const sizeGridHTML = generateSizeGrid({ ...item, sizes: v.sizes });
      return `
        <div class="variant-card">
          <div class="variant-card-header">
            <span class="variant-card-name">${v.product || '—'}${v.color ? ` — ${v.color}` : ''}</span>
            <span class="variant-card-qty">${vQty} pcs</span>
          </div>
          <div class="variant-card-body">
            <div class="sizes-label">Sizes &amp; Quantities</div>
            ${sizeGridHTML}
          </div>
        </div>`;
    }).join('');

    return `
    <div class="line-item">
      <div class="line-item-header">
        <span class="line-number">#${index + 1}</span>
        <div class="line-header-info">
          <span class="design-name">${item.designName || 'Untitled Design'}</span>
          <span class="line-service">${item.serviceStyle}</span>
        </div>
        <span class="line-qty">${qty} pcs</span>
      </div>
      <div class="line-body">
        ${item.mockupUri ? `<div class="mockup-wrap"><img src="${item.mockupUri}" class="mockup-img" alt="Mockup" /></div>` : ''}
        <div class="line-details">
          <table class="details-table">
            <tr><td class="label">Source:</td><td>${item.apparelProvider || 'N/A'}</td></tr>
            <tr><td class="label">Service:</td><td>${item.serviceStyle}</td></tr>
            <tr><td class="label">Location(s):</td><td>${locations}</td></tr>
            ${item.locationDetails ? `<tr><td class="label">Notes:</td><td>${item.locationDetails}</td></tr>` : ''}
          </table>
          ${variantSectionsHTML}
        </div>
      </div>
    </div>`;
  }).join('');

  const companyName = user?.businessName || 'Katalyst Ko Printshop';
  const companyDetails = [user?.email, formatPhone(user?.phone)].filter(Boolean).join(' · ');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Work Order — ${applicator} — ${quote.projectName}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #1a1a1a; font-size: 12px; }
        .header { border-bottom: 3px solid #FF5A00; padding-bottom: 16px; margin-bottom: 20px; }
        .header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
        .company-logo { height: 52px; width: auto; object-fit: contain; }
        .company-details { font-size: 11px; color: #666; margin-top: 4px; }
        .wo-badge { background: #111; color: white; padding: 6px 14px; border-radius: 4px; font-weight: 700; font-size: 12px; letter-spacing: 1px; white-space: nowrap; align-self: flex-start; }
        .client-block { margin-top: 12px; }
        .client-name { font-size: 20px; font-weight: 700; }
        .project-name { font-size: 14px; color: #444; margin-top: 3px; }
        .applicator-banner { background: #FF5A00; color: white; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
        .applicator-label { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; opacity: 0.8; }
        .applicator-name { font-size: 18px; font-weight: 800; margin-top: 2px; }
        .applicator-qty { font-size: 14px; font-weight: 700; text-align: right; flex-shrink: 0; }
        .applicator-qty-label { font-size: 10px; opacity: 0.8; margin-top: 2px; text-align: right; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 16px; background: #f9f9f9; border-radius: 8px; padding: 14px; border: 1px solid #eee; }
        .info-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
        .info-value { font-size: 13px; font-weight: 600; margin-top: 2px; }
        .section-title { font-size: 11px; font-weight: 700; margin-bottom: 10px; color: #fff; background: #111; padding: 6px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px; }
        .line-item { border: 1px solid #e5e5e5; border-radius: 8px; margin-bottom: 14px; overflow: hidden; }
        .line-item-header { display: flex; align-items: center; gap: 10px; background: #111; padding: 10px 14px; }
        .line-number { background: #FF5A00; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; flex-shrink: 0; }
        .line-header-info { flex: 1; min-width: 0; }
        .design-name { font-weight: 600; font-size: 14px; color: #fff; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .line-service { font-size: 11px; color: rgba(255,255,255,0.6); display: block; margin-top: 1px; }
        .line-qty { font-size: 13px; font-weight: 700; color: #FF5A00; flex-shrink: 0; white-space: nowrap; }
        .line-body { padding: 14px; }
        .mockup-wrap { float: left; margin: 0 14px 10px 0; }
        .mockup-img { width: 110px; height: 110px; object-fit: contain; border: 1px solid #eee; border-radius: 6px; display: block; }
        .line-details { overflow: hidden; }
        .details-table { width: 100%; font-size: 11px; margin-bottom: 12px; }
        .details-table td { padding: 3px 0; vertical-align: top; }
        .details-table .label { color: #888; width: 80px; font-weight: 600; white-space: nowrap; }
        .variant-card { border: 1px solid #e5e5e5; border-radius: 6px; overflow: hidden; margin-bottom: 8px; }
        .variant-card-header { background: #111; display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; gap: 8px; }
        .variant-card-name { font-size: 12px; font-weight: 700; color: #fff; flex: 1; min-width: 0; }
        .variant-card-qty { font-size: 12px; font-weight: 700; color: #FF5A00; white-space: nowrap; flex-shrink: 0; }
        .variant-card-body { padding: 10px 12px; background: #f9f9f9; }
        .sizes-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; font-weight: 600; }
        .sz-table { border-collapse: collapse; font-size: 11px; width: 100%; }
        .sz-cell { border: 1px solid #ddd; padding: 4px 6px; text-align: center; }
        thead .sz-cell { background: #eee; font-weight: 700; color: #444; }
        tbody .sz-cell { font-weight: 600; color: #111; background: #fff; }
        .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 12px; clear: both; }
        @media (max-width: 480px) {
          body { padding: 16px; }
          .info-grid { grid-template-columns: 1fr 1fr; }
          .mockup-wrap { float: none; margin: 0 0 10px 0; }
          .mockup-img { width: 100%; height: 140px; }
        }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-top">
          <div>
            <img src="${LOGO_URL}" class="company-logo" alt="${companyName}" />
            ${companyDetails ? `<div class="company-details">${companyDetails}</div>` : ''}
          </div>
          <div class="wo-badge">WORK ORDER</div>
        </div>
        <div class="client-block">
          <div class="client-name">${quote.personOrganization || 'N/A'}</div>
          <div class="project-name">${quote.projectName || 'N/A'}</div>
        </div>
      </div>

      <div class="applicator-banner">
        <div>
          <div class="applicator-label">Applicator</div>
          <div class="applicator-name">${applicator}</div>
        </div>
        <div>
          <div class="applicator-qty">${totalQty} pcs</div>
          <div class="applicator-qty-label">${items.length} item${items.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <div class="info-grid">
        <div>
          <div class="info-label">Order Date</div>
          <div class="info-value">${quote.orderDate || 'N/A'}</div>
        </div>
        <div>
          <div class="info-label">In-Hands Date</div>
          <div class="info-value">${quote.inHandsDate || 'N/A'}</div>
        </div>
        <div>
          <div class="info-label">Total for Applicator</div>
          <div class="info-value">${totalQty} pcs</div>
        </div>
      </div>

      <div class="section-title">Line Items (${items.length})</div>
      ${lineItemsHTML}

      <div class="footer">
        Work Order · Generated ${new Date().toLocaleDateString()} · ${companyName}
      </div>
    </body>
    </html>
  `;
}

export async function generateWorkOrderPDFs(quote: Quote, user?: UserProfile | null): Promise<void> {
  const groups = groupLineItemsByApplicator(quote.lineItems);
  const project = sanitizeFilename(quote.projectName || 'Project');

  for (const [applicator, items] of groups.entries()) {
    const html = generateWorkOrderHTML(quote, applicator, items, user);
    const applicatorSafe = sanitizeFilename(applicator);

    if (Platform.OS === 'web') {
      downloadHtmlAsFile(html, `Work_Order_${applicatorSafe}_${project}.html`);
      await new Promise((r) => setTimeout(r, 400));
    } else {
      try {
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Work Order — ${applicator}`,
            UTI: 'com.adobe.pdf',
          });
        }
      } catch (err) {
        console.error('Work order PDF error:', err);
        throw err;
      }
    }
  }
}

function downloadHtmlAsFile(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openHtmlInNewWindow(html: string): Window | null {
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
  return win;
}

export async function generateAndSharePDF(quote: Quote, user?: UserProfile | null): Promise<void> {
  try {
    const html = generateQuoteHTML(quote, user);

    if (Platform.OS === 'web') {
      const client = sanitizeFilename(quote.personOrganization || 'Client');
      const project = sanitizeFilename(quote.projectName || 'Quote');
      downloadHtmlAsFile(html, `${client}_${project}.html`);
      return;
    }

    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share Quote PDF`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}

export async function printQuote(quote: Quote, user?: UserProfile | null): Promise<void> {
  try {
    const html = generateQuoteHTML(quote, user);

    if (Platform.OS === 'web') {
      const win = openHtmlInNewWindow(html);
      if (!win) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }
      setTimeout(() => {
        try { win.print(); } catch (_) {}
      }, 800);
      return;
    }

    await Print.printAsync({ html });
  } catch (error) {
    console.error('Error printing:', error);
    throw error;
  }
}
