import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { Quote, LineItem, SIZE_LABELS } from '@/types/quote';
import { formatCurrency } from '@/utils/quoteCalculations';
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
        <span class="design-name">${item.designName || 'Untitled Design'}</span>
      </div>
      <table class="details-table">
        <tr><td class="label">Product:</td><td>${item.product}</td></tr>
        <tr><td class="label">Color:</td><td>${item.productColor}</td></tr>
        <tr><td class="label">Source:</td><td>${item.apparelProvider}</td></tr>
        <tr><td class="label">Service:</td><td>${item.serviceStyle}</td></tr>
        <tr><td class="label">Location:</td><td>${[item.location1, item.location2].filter(Boolean).join(', ') || 'N/A'}${item.locationDetails ? ` - ${item.locationDetails}` : ''}</td></tr>
        <tr><td class="label">Sizes:</td><td>${getTotalSizeQuantities(item)}</td></tr>
        <tr><td class="label">Quantity:</td><td>${getItemQuantity(item)} pcs</td></tr>
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
      </div>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; font-size: 12px; }
        .header { border-bottom: 2px solid #FF5A00; padding-bottom: 20px; margin-bottom: 24px; }
        .header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
        .company-info { }
        .company-name { font-size: 20px; font-weight: 700; color: #FF5A00; }
        .company-details { font-size: 11px; color: #666; margin-top: 4px; }
        .quote-badge { background: #FF5A00; color: white; padding: 6px 12px; border-radius: 4px; font-weight: 600; font-size: 11px; }
        .sale-badge { background: #059669; }
        .client-info { margin-top: 16px; }
        .client-name { font-size: 18px; font-weight: 700; }
        .project-name { font-size: 14px; color: #666; margin-top: 2px; }
        .invoice-number { font-size: 12px; color: #FF5A00; font-weight: 600; margin-top: 8px; }
        .section { margin-bottom: 20px; }
        .section-title { font-size: 14px; font-weight: 700; margin-bottom: 12px; color: #1a1a1a; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .info-item { }
        .info-label { font-size: 10px; color: #666; text-transform: uppercase; }
        .info-value { font-size: 13px; font-weight: 600; margin-top: 2px; }
        .line-item { background: #f8f8f8; border-radius: 8px; padding: 14px; margin-bottom: 12px; }
        .line-item-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #e0e0e0; }
        .line-number { background: #FF5A00; color: white; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
        .design-name { font-weight: 600; font-size: 13px; }
        .details-table { width: 100%; font-size: 11px; }
        .details-table td { padding: 3px 0; }
        .details-table .label { color: #666; width: 80px; }
        .costs-row { display: flex; gap: 10px; margin-top: 12px; }
        .cost-item { flex: 1; background: white; padding: 8px; border-radius: 6px; text-align: center; }
        .cost-label { display: block; font-size: 10px; color: #666; }
        .cost-value { display: block; font-size: 12px; font-weight: 600; margin-top: 2px; }
        .summary-card { background: #f8f8f8; border-radius: 8px; padding: 16px; }
        .summary-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; }
        .summary-row.bold { font-weight: 700; }
        .summary-divider { height: 1px; background: #e0e0e0; margin: 8px 0; }
        .total-box { background: #FF5A00; color: white; border-radius: 8px; padding: 14px; margin-top: 12px; }
        .total-row { display: flex; justify-content: space-between; align-items: center; }
        .total-label { font-size: 14px; font-weight: 700; }
        .total-value { font-size: 22px; font-weight: 700; }
        .per-piece-row { display: flex; justify-content: space-between; margin-top: 6px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.3); font-size: 12px; }
        .sales-section { margin-top: 20px; }
        .profit-box { background: #059669; color: white; border-radius: 8px; padding: 14px; margin-top: 12px; }
        .profit-box.negative { background: #dc2626; }
        .profit-label { font-size: 12px; font-weight: 700; }
        .profit-value { font-size: 20px; font-weight: 700; text-align: right; }
        .profit-margin { font-size: 11px; opacity: 0.8; text-align: right; margin-top: 4px; }
        .comparison-box { background: #FFF0E6; border-radius: 8px; padding: 12px; margin-top: 12px; }
        .comparison-title { font-size: 11px; font-weight: 600; color: #FF5A00; margin-bottom: 8px; }
        .comparison-row { display: flex; justify-content: space-between; font-size: 11px; padding: 3px 0; }
        .positive { color: #059669; }
        .negative { color: #dc2626; }
        .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #e0e0e0; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-top">
          <div class="company-info">
            <div class="company-name">${user?.businessName || 'Print Shop Quote'}</div>
            ${user?.email || user?.phone ? `<div class="company-details">${[user.email, user.phone].filter(Boolean).join(' • ')}</div>` : ''}
          </div>
          <div class="quote-badge ${quote.status === 'sale' ? 'sale-badge' : ''}">${quote.status === 'sale' ? 'SALE' : 'QUOTE'}</div>
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
          <div class="info-item">
            <div class="info-label">Order Date</div>
            <div class="info-value">${quote.orderDate || 'N/A'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">In-Hands Date</div>
            <div class="info-value">${quote.inHandsDate || 'N/A'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Order Type</div>
            <div class="info-value">${quote.orderType}</div>
          </div>
          <div class="info-item">
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
        <div class="summary-card">
          <div class="summary-row">
            <span>Product Cost</span>
            <span>${formatCurrency(quote.calculations.productCostTotal)}</span>
          </div>
          <div class="summary-row">
            <span>Service Cost</span>
            <span>${formatCurrency(quote.calculations.serviceCostTotal)}</span>
          </div>
          <div class="summary-row">
            <span>Service Fees</span>
            <span>${formatCurrency(quote.calculations.serviceFeeTotal)}</span>
          </div>
          <div class="summary-divider"></div>
          <div class="summary-row bold">
            <span>Cost of Goods</span>
            <span>${formatCurrency(quote.calculations.cogTotal)}</span>
          </div>
          <div class="summary-row">
            <span>Markup (${quote.calculations.markupPercentage.toFixed(1)}%)</span>
            <span>${formatCurrency(quote.calculations.markupAmount)}</span>
          </div>
          <div class="summary-divider"></div>
          <div class="summary-row">
            <span>Subtotal</span>
            <span>${formatCurrency(quote.calculations.subtotal)}</span>
          </div>
          ${quote.hasOnlineFee ? `<div class="summary-row"><span>Online Fee (2.9% + $0.60)</span><span>${formatCurrency(quote.calculations.onlineFee)}</span></div>` : ''}
          ${quote.hasSalesTax ? `<div class="summary-row"><span>Sales Tax (8.3%)</span><span>${formatCurrency(quote.calculations.salesTax)}</span></div>` : ''}
          ${quote.hasCardFee ? `<div class="summary-row"><span>Card Fee (3.75%)</span><span>${formatCurrency(quote.calculations.cardFee)}</span></div>` : ''}
          <div class="total-box">
            <div class="total-row">
              <span class="total-label">TOTAL</span>
              <span class="total-value">${formatCurrency(quote.calculations.total)}</span>
            </div>
            <div class="per-piece-row">
              <span>Per Piece</span>
              <span>${formatCurrency(quote.calculations.totalPerPiece)}</span>
            </div>
          </div>
        </div>
      </div>

      ${quote.status === 'sale' && quote.salesData ? generateSalesHTML(quote) : ''}

      <div class="footer">
        Generated on ${new Date().toLocaleDateString()} • ${user?.businessName || 'Print Shop Quote System'}
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
    serviceFeesCost + quote.salesData.actualOtherCosts + onlineFee + salesTax + cardFee;
  const actualProfit = quote.salesData.amountCollected - actualCOG + serviceFeesProfit;
  const actualProfitMargin = quote.salesData.amountCollected > 0
    ? ((actualProfit / quote.salesData.amountCollected) * 100)
    : 0;
  const quotedVsActualCOGDiff = quote.calculations.cogTotal - actualCOG;
  const quotedVsActualProfitDiff = actualProfit - quote.calculations.markupAmount;

  return `
    <div class="section sales-section">
      <div class="section-title">Sales Tracking</div>
      <div class="summary-card">
        <div class="summary-row">
          <span>Converted Date</span>
          <span>${quote.salesData.convertedDate}</span>
        </div>
        ${quote.salesData.completedDate ? `<div class="summary-row"><span>Completed Date</span><span>${quote.salesData.completedDate}</span></div>` : ''}
        <div class="summary-divider"></div>
        <div class="summary-row">
          <span>Actual Product Cost</span>
          <span>${formatCurrency(quote.salesData.actualProductCost)}</span>
        </div>
        ${quote.salesData.productVendors?.length ? `<div class="summary-row"><span>Vendor(s)</span><span>${quote.salesData.productVendors.join(', ')}</span></div>` : ''}
        <div class="summary-row">
          <span>Actual Service Cost</span>
          <span>${formatCurrency(quote.salesData.actualServiceCost)}</span>
        </div>
        ${quote.salesData.applicator ? `<div class="summary-row"><span>Applicator</span><span>${quote.salesData.applicator}</span></div>` : ''}
        <div class="summary-row">
          <span>Service Fees (Cost)</span>
          <span>${formatCurrency(serviceFeesCost)}</span>
        </div>
        ${serviceFeesProfit > 0 ? `<div class="summary-row"><span>Service Fees (Profit)</span><span class="positive">+${formatCurrency(serviceFeesProfit)}</span></div>` : ''}
        ${quote.salesData.actualOtherCosts > 0 ? `<div class="summary-row"><span>Other Costs</span><span>${formatCurrency(quote.salesData.actualOtherCosts)}</span></div>` : ''}
        ${onlineFee > 0 ? `<div class="summary-row"><span>Online Fee</span><span>${formatCurrency(onlineFee)}</span></div>` : ''}
        ${salesTax > 0 ? `<div class="summary-row"><span>Sales Tax</span><span>${formatCurrency(salesTax)}</span></div>` : ''}
        ${cardFee > 0 ? `<div class="summary-row"><span>Card Fee</span><span>${formatCurrency(cardFee)}</span></div>` : ''}
        <div class="summary-divider"></div>
        <div class="summary-row bold">
          <span>Actual COG</span>
          <span>${formatCurrency(actualCOG)}</span>
        </div>
        <div class="summary-row">
          <span>Amount Collected</span>
          <span>${formatCurrency(quote.salesData.amountCollected)}</span>
        </div>
        <div class="profit-box ${actualProfit < 0 ? 'negative' : ''}">
          <div class="profit-label">ACTUAL PROFIT</div>
          <div class="profit-value">${formatCurrency(actualProfit)}</div>
          <div class="profit-margin">${actualProfitMargin.toFixed(1)}% margin</div>
        </div>
        <div class="comparison-box">
          <div class="comparison-title">Quoted vs Actual</div>
          <div class="comparison-row">
            <span>COG Difference</span>
            <span class="${quotedVsActualCOGDiff >= 0 ? 'positive' : 'negative'}">${quotedVsActualCOGDiff >= 0 ? '+' : ''}${formatCurrency(quotedVsActualCOGDiff)}</span>
          </div>
          <div class="comparison-row">
            <span>Profit Difference</span>
            <span class="${quotedVsActualProfitDiff >= 0 ? 'positive' : 'negative'}">${quotedVsActualProfitDiff >= 0 ? '+' : ''}${formatCurrency(quotedVsActualProfitDiff)}</span>
          </div>
        </div>
        ${quote.salesData.notes ? `<div class="summary-divider"></div><div class="summary-row"><span>Notes:</span><span>${quote.salesData.notes}</span></div>` : ''}
      </div>
    </div>
  `;
}

export async function generateAndSharePDF(quote: Quote, user?: UserProfile | null): Promise<void> {
  try {
    console.log('Generating PDF for quote:', quote.id);
    const html = generateQuoteHTML(quote, user);

    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    console.log('PDF generated at:', uri);

    if (Platform.OS === 'web') {
      const link = document.createElement('a');
      link.href = uri;
      link.download = `${quote.status === 'sale' ? 'Sale' : 'Quote'}_${quote.projectName.replace(/\s+/g, '_')}.pdf`;
      link.click();
    } else {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share ${quote.status === 'sale' ? 'Sale' : 'Quote'} PDF`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        console.log('Sharing is not available on this device');
        throw new Error('Sharing is not available on this device');
      }
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}

export async function printQuote(quote: Quote, user?: UserProfile | null): Promise<void> {
  try {
    console.log('Printing quote:', quote.id);
    const html = generateQuoteHTML(quote, user);
    await Print.printAsync({ html });
  } catch (error) {
    console.error('Error printing:', error);
    throw error;
  }
}
