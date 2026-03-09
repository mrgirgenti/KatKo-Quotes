import { Quote, LineItem } from '@/types/quote';
import { calculateLineItemSubtotal } from '@/utils/quoteCalculations';
import { formatDate } from '@/utils/textFormatting';

export interface ExportLineItem {
  designName: string;
  applicator: string;
  source: string;
  product: string;
  color: string;
  service: string;
  location: string;
  qty: number;
  productCostTotal: number;
  serviceCostTotal: number;
  feesTotal: number;
  markupPerPiece: number;
  markupTotal: number;
  lineSubtotalNoFees: number;
  pricePerPieceNoFees: number;
  lineSubtotalWithFees: number;
}

export interface QuoteExportPayload {
  exportDate: string;
  invoiceNumber: string;
  orderDate: string;
  client: string;
  project: string;
  onlineFee: number;
  cardFee: number;
  salesTax: number;
  quoteSubtotal: number;
  quotePricePerPieceNoFees: number;
  quoteMarkupTotal: number;
  total: number;
  lineItems: ExportLineItem[];
  // Debug fields to trace code execution
  debug_codeVersion: string;
  debug_hasLineItems: boolean;
  debug_lineItemCount: number;
  debug_timestamp: string;
}

export interface DetailedLineItemRow {
  // Quote-level fields (first row only)
  exportDate: string;
  invoiceNumber: string;
  orderDate: string;
  client: string;
  project: string;
  onlineFee: number | null;
  cardFee: number | null;
  salesTax: number | null;
  subtotal: number | null;
  pricePerPieceNoFees: number | null;
  markupTotal: number | null;
  total: number | null;
  // Line-item fields (every row)
  applicator: string;
  source: string;
  product: string;
  color: string;
  service: string;
  locationNotes: string;
  totalQty: number;
  productCost: number;
  serviceCost: number;
  fees: number;
  markupPerPiece: number;
  isFirstLineItem: boolean;
}

function getLineItemQuantity(item: LineItem): number {
  const isPromotional = item.serviceStyle === 'Promotional';
  if (isPromotional) {
    return item.sizes.flat;
  }
  return item.sizes.xs + item.sizes.s + item.sizes.m + item.sizes.l + 
         item.sizes.xl + item.sizes.xxl + item.sizes.xxxl + item.sizes.xxxxl;
}

function buildLocationNotes(item: LineItem): string {
  const locations = [item.location1, item.location2].filter(Boolean).join(', ');
  const notes = item.locationDetails || '';
  if (locations && notes) {
    return `${locations} - ${notes}`;
  }
  return locations || notes || '';
}

function buildDetailedLineItemRows(sale: Quote): DetailedLineItemRow[] {
  const exportDate = formatDate(new Date().toISOString().split('T')[0]);
  const rows: DetailedLineItemRow[] = [];
  
  const salesDataLineItemCosts = sale.salesData?.lineItemCosts || [];
  
  sale.lineItems.forEach((item, index) => {
    const isFirstLineItem = index === 0;
    const qty = getLineItemQuantity(item);
    const lineItemCalc = calculateLineItemSubtotal(item);
    
    const lineItemCostData = salesDataLineItemCosts.find(c => c.lineItemId === item.id) || salesDataLineItemCosts[index];
    
    const applicator = lineItemCostData?.applicator || item.applicator || 'N/A';
    const source = lineItemCostData?.productVendor || item.apparelProvider || 'N/A';
    
    const row: DetailedLineItemRow = {
      // Quote-level fields (first row only)
      exportDate: isFirstLineItem ? exportDate : '',
      invoiceNumber: isFirstLineItem ? (sale.invoiceNumber || 'N/A') : '',
      orderDate: isFirstLineItem ? formatDate(sale.orderDate) : '',
      client: isFirstLineItem ? sale.personOrganization : '',
      project: isFirstLineItem ? sale.projectName : '',
      onlineFee: isFirstLineItem ? sale.calculations.onlineFee : null,
      cardFee: isFirstLineItem ? sale.calculations.cardFee : null,
      salesTax: isFirstLineItem ? sale.calculations.salesTax : null,
      subtotal: isFirstLineItem ? sale.calculations.subtotal : null,
      pricePerPieceNoFees: isFirstLineItem ? sale.calculations.totalPerPiece : null,
      markupTotal: isFirstLineItem ? sale.calculations.markupAmount : null,
      total: isFirstLineItem ? sale.calculations.total : null,
      // Line-item fields (every row)
      applicator: applicator,
      source: source,
      product: item.product || 'N/A',
      color: item.productColor || 'N/A',
      service: item.serviceStyle || 'N/A',
      locationNotes: buildLocationNotes(item),
      totalQty: qty,
      productCost: lineItemCalc.productCostTotal,
      serviceCost: lineItemCalc.serviceCostTotal,
      fees: lineItemCalc.serviceFeeTotal,
      markupPerPiece: item.markupEach || 0,
      isFirstLineItem: isFirstLineItem,
    };
    
    rows.push(row);
  });
  
  return rows;
}

export interface SaleExportPayload {
  rows: DetailedLineItemRow[];
  saleId: string;
  totalLineItems: number;
}

export function buildSaleExportPayload(sale: Quote): SaleExportPayload {
  const rows = buildDetailedLineItemRows(sale);
  
  return {
    rows: rows,
    saleId: sale.id,
    totalLineItems: sale.lineItems.length,
  };
}

function buildLocation(item: LineItem): string {
  const locations = [item.location1, item.location2].filter(Boolean).join(', ');
  const notes = item.locationDetails || '';
  if (locations && notes) {
    return `${locations} - ${notes}`;
  }
  return locations || notes || '';
}

export function buildQuoteExportPayload(sale: Quote): QuoteExportPayload {
  const exportDate = formatDate(new Date().toISOString().split('T')[0]);
  const salesDataLineItemCosts = sale.salesData?.lineItemCosts || [];
  
  console.log('=== Building Export Payload ===');
  console.log('Sale ID:', sale.id);
  console.log('Sale object keys:', Object.keys(sale));
  console.log('Sale lineItems exists:', !!sale.lineItems);
  console.log('Sale lineItems is array:', Array.isArray(sale.lineItems));
  console.log('Sale lineItems count:', sale.lineItems?.length || 0);
  console.log('Sales data lineItemCosts count:', salesDataLineItemCosts.length);
  
  // Ensure lineItems is an array
  const saleLineItems = Array.isArray(sale.lineItems) ? sale.lineItems : [];
  
  if (saleLineItems.length === 0) {
    console.log('WARNING: No line items found in sale! Raw lineItems value:', JSON.stringify(sale.lineItems));
  } else {
    console.log('Line items raw data:', JSON.stringify(saleLineItems.map(item => ({
      id: item.id,
      product: item.product,
      serviceStyle: item.serviceStyle,
      sizes: item.sizes
    }))));
  }
  
  const lineItems: ExportLineItem[] = saleLineItems.map((item, index) => {
    const qty = getLineItemQuantity(item);
    const lineItemCalc = calculateLineItemSubtotal(item);
    const lineItemCostData = salesDataLineItemCosts.find(c => c.lineItemId === item.id) || salesDataLineItemCosts[index];
    
    const applicator = lineItemCostData?.applicator || item.applicator || 'N/A';
    const source = lineItemCostData?.productVendor || item.apparelProvider || 'N/A';
    
    // Calculate line item values matching UI exactly
    // Raw values from line item for cost calculation
    const rawProductCostEach = item.productCostEach || 0;
    const rawServiceCostEach = item.serviceCostEach || 0;
    const rawServiceFeeEach = item.serviceFeeEach || 0;
    
    console.log(`Line Item ${index + 1} RAW VALUES:`);
    console.log(`  productCostEach: ${rawProductCostEach}`);
    console.log(`  serviceCostEach: ${rawServiceCostEach}`);
    console.log(`  serviceFeeEach: ${rawServiceFeeEach}`);
    console.log(`  qty: ${qty}`);
    
    const productCostTotal = lineItemCalc.productCostTotal;
    const serviceCostTotal = lineItemCalc.serviceCostTotal;
    const feesTotal = lineItemCalc.serviceFeeTotal;
    const markupPerPiece = item.markupEach || 0;
    const markupTotal = markupPerPiece * qty;
    
    console.log(`Line Item ${index + 1} CALCULATED VALUES:`);
    console.log(`  productCostTotal: ${productCostTotal}`);
    console.log(`  serviceCostTotal: ${serviceCostTotal}`);
    console.log(`  feesTotal: ${feesTotal}`);
    console.log(`  markupTotal: ${markupTotal}`);
    
    // lineSubtotalNoFees = productCostTotal + serviceCostTotal + markupTotal (excludes fees)
    const lineSubtotalNoFees = productCostTotal + serviceCostTotal + markupTotal;
    
    // lineSubtotalWithFees includes fees - this is the UI "Line Item Subtotal"
    const lineSubtotalWithFees = lineSubtotalNoFees + feesTotal;
    
    // pricePerPiece MUST match UI which shows subtotal WITH fees divided by qty
    // UI shows: "100 pcs @ $14.25/ea" where $14.25 = $1425 / 100
    const pricePerPiece = qty > 0 ? lineSubtotalWithFees / qty : 0;
    
    
    const exportItem: ExportLineItem = {
      designName: item.designName || `Design ${index + 1}`,
      applicator: applicator,
      source: source,
      product: item.product || 'N/A',
      color: item.productColor || 'N/A',
      service: item.serviceStyle || 'N/A',
      location: buildLocation(item),
      qty: qty,
      productCostTotal: parseFloat(productCostTotal.toFixed(2)),
      serviceCostTotal: parseFloat(serviceCostTotal.toFixed(2)),
      feesTotal: parseFloat(feesTotal.toFixed(2)),
      markupPerPiece: parseFloat(markupPerPiece.toFixed(2)),
      markupTotal: parseFloat(markupTotal.toFixed(2)),
      lineSubtotalNoFees: parseFloat(lineSubtotalNoFees.toFixed(2)),
      pricePerPieceNoFees: parseFloat(pricePerPiece.toFixed(2)), // This is the UI price per piece (WITH fees)
      lineSubtotalWithFees: parseFloat(lineSubtotalWithFees.toFixed(2)),
    };
    
    console.log(`Line Item ${index + 1} FINAL EXPORT OBJECT:`);
    console.log(`  designName: ${exportItem.designName}`);
    console.log(`  qty: ${exportItem.qty}`);
    console.log(`  productCostTotal: ${exportItem.productCostTotal}`);
    console.log(`  serviceCostTotal: ${exportItem.serviceCostTotal}`);
    console.log(`  feesTotal: ${exportItem.feesTotal}`);
    console.log(`  markupPerPiece: ${exportItem.markupPerPiece}`);
    console.log(`  markupTotal: ${exportItem.markupTotal}`);
    console.log(`  lineSubtotalNoFees: ${exportItem.lineSubtotalNoFees}`);
    console.log(`  pricePerPieceNoFees: ${exportItem.pricePerPieceNoFees}`);
    console.log(`  lineSubtotalWithFees: ${exportItem.lineSubtotalWithFees}`);
    console.log(`  Full export item object:`, JSON.stringify(exportItem));
    
    return exportItem;
  });
  
  // Calculate quote-level totals from line items
  const quoteSubtotal = lineItems.reduce((sum, item) => sum + item.lineSubtotalWithFees, 0);
  const quoteMarkupTotal = lineItems.reduce((sum, item) => sum + item.markupTotal, 0);
  
  const payload: QuoteExportPayload = {
    exportDate: exportDate,
    invoiceNumber: sale.invoiceNumber || 'N/A',
    orderDate: formatDate(sale.orderDate),
    client: sale.personOrganization,
    project: sale.projectName,
    onlineFee: parseFloat(sale.calculations.onlineFee.toFixed(2)),
    cardFee: parseFloat(sale.calculations.cardFee.toFixed(2)),
    salesTax: parseFloat(sale.calculations.salesTax.toFixed(2)),
    quoteSubtotal: parseFloat(quoteSubtotal.toFixed(2)),
    quotePricePerPieceNoFees: parseFloat((quoteSubtotal / sale.calculations.totalQuantity).toFixed(2)),
    quoteMarkupTotal: parseFloat(quoteMarkupTotal.toFixed(2)),
    total: parseFloat(sale.calculations.total.toFixed(2)),
    lineItems: lineItems,
    // Debug fields - if you see these, NEW code is running
    debug_codeVersion: 'v4.2-2026-01-26-cost-fields-fix',
    debug_hasLineItems: lineItems.length > 0,
    debug_lineItemCount: lineItems.length,
    debug_timestamp: new Date().toISOString(),
  };
  
  console.log('=== PAYLOAD VERIFICATION ===');
  console.log('Payload has lineItems key:', 'lineItems' in payload);
  console.log('Payload lineItems is array:', Array.isArray(payload.lineItems));
  console.log('Payload lineItems count:', payload.lineItems.length);
  console.log('Full payload:', JSON.stringify(payload, null, 2));
  
  return payload;
}

export async function exportToGoogleSheets(
  webAppUrl: string, 
  sales: Quote[]
): Promise<{ success: boolean; message: string }> {
  if (!webAppUrl || !webAppUrl.trim()) {
    return { 
      success: false, 
      message: 'No Google Sheets URL configured. Please add your Google Apps Script web app URL in Profile settings.' 
    };
  }

  let url = webAppUrl.trim();
  
  console.log('=== EXPORT START ===');
  console.log('Original URL:', url);
  
  if (!url.includes('script.google.com') && !url.includes('macros')) {
    console.log('ERROR: Invalid URL format');
    return { 
      success: false, 
      message: 'Invalid URL. Please use a Google Apps Script web app URL (starts with https://script.google.com/).' 
    };
  }

  if (url.includes('/dev')) {
    console.log('Warning: Using /dev endpoint. Consider using /exec for production.');
  }

  const exportPayloads = sales.map(sale => buildQuoteExportPayload(sale));

  try {
    console.log('=== Google Sheets Export ===' );
    console.log('URL:', url);
    console.log('Sales count:', sales.length);
    
    // Verify lineItems are included in each payload
    exportPayloads.forEach((payload, index) => {
      console.log(`Payload ${index + 1} - Invoice: ${payload.invoiceNumber}, LineItems count: ${payload.lineItems?.length || 0}`);
      if (payload.lineItems && payload.lineItems.length > 0) {
        payload.lineItems.forEach((item, itemIndex) => {
          console.log(`  LineItem ${itemIndex + 1}: ${item.product} - ${item.service} - Qty: ${item.qty}`);
        });
      } else {
        console.log('  WARNING: No line items in this payload!');
      }
    });
    
    console.log('Export payloads:', JSON.stringify(exportPayloads, null, 2));

    const requestBody = { 
      action: 'append',
      data: exportPayloads 
    };
    
    console.log('=== FINAL REQUEST BODY ===');
    console.log('Action:', requestBody.action);
    console.log('Data array length:', requestBody.data.length);
    
    // Detailed verification of each payload
    requestBody.data.forEach((item, idx) => {
      console.log(`\n--- Quote ${idx + 1} Details ---`);
      console.log(`Invoice: ${item.invoiceNumber}`);
      console.log(`Client: ${item.client}`);
      console.log(`Has lineItems key: ${'lineItems' in item}`);
      console.log(`lineItems is array: ${Array.isArray(item.lineItems)}`);
      console.log(`lineItems count: ${item.lineItems?.length || 0}`);
      
      if (item.lineItems && item.lineItems.length > 0) {
        item.lineItems.forEach((li, liIdx) => {
          console.log(`  Line Item ${liIdx + 1}: ${li.product} | ${li.service} | Qty: ${li.qty} | Markup/ea: ${li.markupPerPiece}`);
        });
      } else {
        console.log('  ERROR: No line items in this payload!');
      }
    });
    
    const payload = JSON.stringify(requestBody);
    console.log('\n=== SERIALIZED PAYLOAD ===');
    console.log('Payload length:', payload.length);
    
    // Verify lineItems survived JSON serialization
    const parsedBack = JSON.parse(payload);
    console.log('After JSON parse - data[0] has lineItems:', parsedBack.data[0]?.lineItems?.length || 0);
    
    console.log('\nFull payload being sent:');
    console.log(payload);

    let response: Response;
    let responseText: string;
    
    console.log('=== SENDING FETCH REQUEST ===');
    console.log('URL:', url);
    console.log('Payload size:', payload.length, 'bytes');
    
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: payload,
      });
      
      console.log('=== FETCH RESPONSE ===');
      console.log('Response status:', response.status);
      console.log('Response type:', response.type);
      console.log('Response ok:', response.ok);
      console.log('Response URL:', response.url);
      
      responseText = await response.text();
      console.log('Response text:', responseText.substring(0, 500));
    } catch (fetchError) {
      console.log('=== FETCH ERROR ===' );
      console.log('Fetch error type:', fetchError instanceof TypeError ? 'TypeError' : 'Other');
      console.log('Fetch error message:', fetchError instanceof Error ? fetchError.message : String(fetchError));
      console.log('Full fetch error:', fetchError);
      
      try {
        console.log('Attempting no-cors mode as fallback...');
        const noCorsResponse = await fetch(url, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: payload,
        });
        
        console.log('No-cors response type:', noCorsResponse.type);
        
        return { 
          success: true, 
          message: `Export sent to Google Sheets (no-cors mode). Please check your spreadsheet to verify the data appeared.` 
        };
      } catch (noCorsError) {
        console.log('No-cors fetch also failed:', noCorsError);
        throw fetchError;
      }
    }

    if (response.ok) {
      try {
        const result = JSON.parse(responseText);
        console.log('Parsed response:', result);
        
        if (result.success === true) {
          return {
            success: true,
            message: result.message || `Successfully exported ${sales.length} sale(s) to Google Sheets!`
          };
        } else if (result.success === false) {
          return {
            success: false,
            message: result.error || result.message || 'Export failed on server side'
          };
        }
        
        if (result.rowsAdded !== undefined) {
          return {
            success: true,
            message: `Successfully added ${result.rowsAdded} row(s) to Google Sheets!`
          };
        }
      } catch {
        console.log('Response is not JSON, checking for success indicators...');
        const lowerResponse = responseText.toLowerCase();
        
        if (lowerResponse.includes('success') || lowerResponse.includes('added')) {
          return { 
            success: true, 
            message: `Successfully exported ${sales.length} sale(s) to Google Sheets!` 
          };
        }
        
        if (lowerResponse.includes('error') || lowerResponse.includes('exception')) {
          return {
            success: false,
            message: 'Server returned an error. Check your Google Apps Script logs.'
          };
        }
      }
      
      return { 
        success: true, 
        message: `Successfully exported ${sales.length} sale(s) to Google Sheets!` 
      };
    }
    
    if (response.status === 302 || response.status === 301) {
      console.log('Redirect response - request likely succeeded');
      return { 
        success: true, 
        message: `Export sent to Google Sheets. Please verify the data appeared in your spreadsheet.` 
      };
    }
    
    console.log('Non-OK response:', response.status, responseText);
    return { 
      success: false, 
      message: `Server returned status ${response.status}. Please verify your Google Apps Script is deployed correctly with "Anyone" access.` 
    };
    
  } catch (error) {
    console.log('Export error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
      return { 
        success: false, 
        message: 'Network error. Please check your internet connection and ensure your Google Apps Script URL is correct.' 
      };
    }
    
    if (errorMessage.includes('CORS') || error instanceof TypeError) {
      return { 
        success: false, 
        message: 'Connection blocked. Please ensure your Google Apps Script is:\n1. Deployed as "Web app"\n2. Execute as "Me"\n3. Who has access: "Anyone"\n4. Using the /exec URL (not /dev)' 
      };
    }
    
    return { 
      success: false, 
      message: `Export failed: ${errorMessage}. Please check the Google Apps Script setup.` 
    };
  }
}

export async function exportSingleSaleToSheets(
  webAppUrl: string,
  sale: Quote
): Promise<{ success: boolean; message: string }> {
  console.log('=== exportSingleSaleToSheets called ===');
  console.log('Sale ID:', sale.id);
  console.log('Sale has lineItems:', !!sale.lineItems);
  console.log('Sale lineItems length:', sale.lineItems?.length || 0);
  
  // Pre-validation: ensure lineItems exist
  if (!sale.lineItems || !Array.isArray(sale.lineItems) || sale.lineItems.length === 0) {
    console.log('ERROR: Sale has no line items!');
    console.log('Sale object:', JSON.stringify(sale, null, 2));
    return {
      success: false,
      message: 'Export failed: This sale has no line items. Please verify the sale data is complete.'
    };
  }
  
  // Log each line item to verify data
  sale.lineItems.forEach((item, idx) => {
    console.log(`Line Item ${idx + 1}:`, {
      id: item.id,
      product: item.product,
      service: item.serviceStyle,
      sizes: item.sizes
    });
  });
  
  return exportToGoogleSheets(webAppUrl, [sale]);
}

export const GOOGLE_SCRIPT_TEMPLATE = `
// Google Apps Script - Sales Export with Full Line Item Details
// ================================================================
// VERSION: 4.1 - Updated January 2026 - Price Per Piece fix
// 
// SETUP INSTRUCTIONS:
// 1. Open your Google Sheet where you want sales data
// 2. Go to Extensions > Apps Script
// 3. Delete any existing code and paste this ENTIRE script
// 4. Click the Save icon (or Ctrl+S)
// 5. Click "Deploy" > "New deployment"
// 6. Click the gear icon and select "Web app"
// 7. Set "Execute as" to "Me" (your email)
// 8. Set "Who has access" to "Anyone"
// 9. Click "Deploy"
// 10. Click "Authorize access" and allow permissions
// 11. Copy the Web App URL (starts with https://script.google.com/macros/s/...)
// 12. Paste that URL in your app's Profile settings
//
// IMPORTANT: If you update this script, you must create a NEW deployment
// for changes to take effect! Old deployments will use old code.
//
// PAYLOAD STRUCTURE (v4.0 - what the app sends):
// {
//   "action": "append",
//   "data": [{
//     "exportDate": "Jan 26, 2026",
//     "invoiceNumber": "Invoice #",
//     "orderDate": "Jan 20, 2026",
//     "client": "Person Organization",
//     "project": "Project Name",
//     "onlineFee": 52.81,
//     "cardFee": 67.52,
//     "salesTax": 149.44,
//     "quoteSubtotal": 1800.48,
//     "quotePricePerPieceNoFees": 14.52,
//     "quoteMarkupTotal": 248.00,
//     "total": 2070.25,
//     "lineItems": [{
//       "designName": "Team Tees",
//       "applicator": "Katalyst Ko Printshop",
//       "source": "McCreary's",
//       "product": "Gildan 5000",
//       "color": "Black",
//       "service": "Direct to Film",
//       "location": "Front",
//       "qty": 100,
//       "productCostTotal": 500,
//       "serviceCostTotal": 700,
//       "feesTotal": 25,
//       "markupPerPiece": 2,
//       "markupTotal": 200,
//       "lineSubtotalNoFees": 1400,
//       "pricePerPieceNoFees": 14,
//       "lineSubtotalWithFees": 1425
//     }]
//   }]
// }

function doPost(e) {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var rawContents = e.postData.contents;
    
    console.log('=== RECEIVED PAYLOAD (v4.0) ===');
    console.log('Raw contents length:', rawContents.length);
    console.log('Raw contents:', rawContents.substring(0, 2000));
    
    var data = JSON.parse(rawContents);
    
    console.log('Parsed data action:', data.action);
    console.log('Parsed data.data length:', data.data ? data.data.length : 'undefined');
    
    if (!data.data || !Array.isArray(data.data)) {
      console.log('ERROR: data.data is missing or not an array');
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Invalid payload structure: data.data is missing or not an array'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var salesSheet = spreadsheet.getSheetByName('Sales');
    if (!salesSheet) {
      salesSheet = spreadsheet.insertSheet('Sales');
    }
    
    // Setup headers if needed (v4.0 column order)
    if (salesSheet.getLastRow() === 0) {
      var headers = [
        // Quote-level (first row only)
        'Export Date', 'Invoice #', 'Order Date', 'Client', 'Project',
        'Online Fee', 'Card Fee', 'Sales Tax', 'Subtotal', 'Price/Pc (no fees)', 'Markup Total', 'Total',
        // Line-item details (every row)
        'Design Name', 'Applicator', 'Source', 'Product', 'Color', 'Service', 'Location & Notes',
        'Qty', 'Product Cost', 'Service Cost', 'Fees', 'Markup/ea', 'Markup Total (Line)',
        'Subtotal (no fees)', 'Price/Pc', 'Subtotal (with fees)'
      ];
      salesSheet.appendRow(headers);
      var headerRange = salesSheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4285f4');
      headerRange.setFontColor('#ffffff');
      salesSheet.setFrozenRows(1);
    }
    
    var rowsAdded = 0;
    var salesData = data.data;
    
    for (var i = 0; i < salesData.length; i++) {
      var quote = salesData[i];
      
      console.log('Processing quote ' + (i+1) + ':');
      console.log('  Invoice:', quote.invoiceNumber);
      console.log('  Has lineItems key:', quote.hasOwnProperty('lineItems'));
      console.log('  lineItems count:', quote.lineItems ? quote.lineItems.length : 0);
      console.log('  quoteSubtotal:', quote.quoteSubtotal);
      console.log('  quoteMarkupTotal:', quote.quoteMarkupTotal);
      
      var lineItems = quote.lineItems;
      
      if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
        console.log('WARNING: No line items for quote ' + quote.invoiceNumber);
        var rowData = [
          quote.exportDate || '',
          quote.invoiceNumber || '',
          quote.orderDate || '',
          quote.client || '',
          quote.project || '',
          quote.onlineFee || 0,
          quote.cardFee || 0,
          quote.salesTax || 0,
          quote.quoteSubtotal || 0,
          quote.quotePricePerPieceNoFees || 0,
          quote.quoteMarkupTotal || 0,
          quote.total || 0,
          'NO LINE ITEMS', '', '', '', '', '', '',
          0, 0, 0, 0, 0, 0, 0, 0, 0
        ];
        salesSheet.appendRow(rowData);
        rowsAdded++;
        continue;
      }
      
      console.log('Processing ' + lineItems.length + ' line items');
      
      for (var j = 0; j < lineItems.length; j++) {
        var item = lineItems[j];
        var isFirst = (j === 0);
        
        console.log('  Line item ' + (j+1) + ': ' + item.designName + ' | Qty: ' + item.qty + ' | MarkupTotal: ' + item.markupTotal);
        
        var rowData = [
          // Quote-level fields (first row only)
          isFirst ? (quote.exportDate || '') : '',
          isFirst ? (quote.invoiceNumber || '') : '',
          isFirst ? (quote.orderDate || '') : '',
          isFirst ? (quote.client || '') : '',
          isFirst ? (quote.project || '') : '',
          isFirst ? (quote.onlineFee || 0) : '',
          isFirst ? (quote.cardFee || 0) : '',
          isFirst ? (quote.salesTax || 0) : '',
          isFirst ? (quote.quoteSubtotal || 0) : '',
          isFirst ? (quote.quotePricePerPieceNoFees || 0) : '',
          isFirst ? (quote.quoteMarkupTotal || 0) : '',
          isFirst ? (quote.total || 0) : '',
          // Line-item fields (every row)
          item.designName || 'Untitled',
          item.applicator || '',
          item.source || '',
          item.product || '',
          item.color || '',
          item.service || '',
          item.location || '',
          item.qty || 0,
          item.productCostTotal || 0,
          item.serviceCostTotal || 0,
          item.feesTotal || 0,
          item.markupPerPiece || 0,
          item.markupTotal || 0,
          item.lineSubtotalNoFees || 0,
          item.pricePerPieceNoFees || 0,
          item.lineSubtotalWithFees || 0
        ];
        
        salesSheet.appendRow(rowData);
        rowsAdded++;
      }
    }
    
    salesSheet.autoResizeColumns(1, 28);
    
    console.log('=== SUCCESS ===');
    console.log('Successfully added ' + rowsAdded + ' rows');
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Successfully added ' + rowsAdded + ' row(s)',
      rowsAdded: rowsAdded
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    console.error('=== ERROR ===');
    console.error('Error in doPost:', error.toString());
    console.error('Stack:', error.stack);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    message: 'Google Sheets integration is working! Use POST to send data.',
    version: '4.0'
  })).setMimeType(ContentService.MimeType.JSON);
}

// Test function with 3 line items (qty 100, 8, 16) - run manually to verify
function testScript() {
  var testData = {
    action: 'append',
    data: [{
      exportDate: 'January 26, 2026',
      invoiceNumber: 'KKP#TEST-CAPTURE',
      orderDate: 'January 20, 2026',
      client: 'Test Client',
      project: 'Test Project',
      onlineFee: 52.81,
      cardFee: 67.52,
      salesTax: 149.44,
      quoteSubtotal: 1800.48,
      quotePricePerPieceNoFees: 14.52,
      quoteMarkupTotal: 248.00,
      total: 2070.25,
      lineItems: [
        {
          designName: 'Team Tees',
          applicator: 'Katalyst Ko Printshop',
          source: "McCreary's",
          product: 'Next Level 6210',
          color: 'Black',
          service: 'Screen Printing',
          location: 'Left Chest',
          qty: 100,
          productCostTotal: 500.00,
          serviceCostTotal: 700.00,
          feesTotal: 25.00,
          markupPerPiece: 2.00,
          markupTotal: 200.00,
          lineSubtotalNoFees: 1400.00,
          pricePerPieceNoFees: 14.00,
          lineSubtotalWithFees: 1425.00
        },
        {
          designName: 'Staff Polos',
          applicator: 'Show & Tell Tees',
          source: 'SS Activewear',
          product: 'Bella+Canvas 3001',
          color: 'White',
          service: 'Direct to Film',
          location: 'Full Back',
          qty: 8,
          productCostTotal: 40.00,
          serviceCostTotal: 56.00,
          feesTotal: 10.00,
          markupPerPiece: 3.00,
          markupTotal: 24.00,
          lineSubtotalNoFees: 120.00,
          pricePerPieceNoFees: 15.00,
          lineSubtotalWithFees: 130.00
        },
        {
          designName: 'Event Shirts',
          applicator: 'Express SP',
          source: 'San Mar',
          product: 'Gildan 5000',
          color: 'Navy',
          service: 'Screen Printing',
          location: 'Front, Back',
          qty: 16,
          productCostTotal: 64.00,
          serviceCostTotal: 112.00,
          feesTotal: 15.00,
          markupPerPiece: 1.50,
          markupTotal: 24.00,
          lineSubtotalNoFees: 200.00,
          pricePerPieceNoFees: 12.50,
          lineSubtotalWithFees: 215.00
        }
      ]
    }]
  };
  
  var e = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };
  
  var result = doPost(e);
  console.log('Test result:', result.getContent());
}
`;
