// ─────────────────────────────────────────────────────────────────────────────
// Project Document HTML — the ONE canonical template that renders a project as a
// document. The SAME html is embedded in the Client Hub Order Detail (web, via an
// iframe) AND fed to expo-print / file download for the Quote / Invoice / Production
// PDFs. There is exactly one layout; `mode` only flips which sections are visible.
//
// SECURITY: every interpolated string is escaped via esc(); image URLs are passed
// through an allowlist (http/https/data:image/relative). Internal cost/markup/COGS
// never reaches this file — it consumes the customer-safe ProjectDocumentModel.
// ─────────────────────────────────────────────────────────────────────────────

import { COMPANY } from '@/constants/company';
import {
  BuildOptions,
  DOC_APPROVAL_CALLOUT,
  DOC_DISCLAIMER,
  DOC_FOOTER,
  DOC_NOTE_BULLETS,
  DocLineItem,
  DocumentMode,
  DocumentSource,
  PRODUCTION_CHECKLIST,
  ProjectDocumentModel,
  buildProjectDocumentModel,
  isValidImageUrl,
} from '@/utils/projectDocument';

const BRAND = '#FF5A00';

function esc(value: unknown): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(n: number): string {
  const v = isNaN(n) ? 0 : n;
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function safeImg(url: string, className: string): string {
  if (!isValidImageUrl(url)) return '';
  return `<img class="${className}" src="${esc(url)}" alt="" />`;
}

const ICONS = {
  phone:
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="#FF5A00"><path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24 11.36 11.36 0 0 0 3.57.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.36 11.36 0 0 0 .57 3.57 1 1 0 0 1-.24 1.02l-2.21 2.2z"/></svg>',
  web:
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#FF5A00" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"/></svg>',
  pin:
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="#FF5A00"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
};

function renderHeader(model: ProjectDocumentModel): string {
  const v = model.visibility;
  const contactRows = [
    `<div class="contact-row">${ICONS.phone}<span><strong>Phone:</strong> ${esc(COMPANY.phone)}</span></div>`,
    `<div class="contact-row">${ICONS.web}<span><strong>Web:</strong> ${esc(COMPANY.web)}</span></div>`,
    `<div class="contact-row contact-addr">${ICONS.pin}<span>${COMPANY.addressLines.map(esc).join('<br/>')}</span></div>`,
  ].join('');

  const metaRows = [
    // Always show the number row — dash if no number has been assigned yet
    `<div class="title-meta"><span class="meta-key">${esc(v.numberLabel)}:</span> ${model.documentNumber ? esc(model.documentNumber) : '—'}</div>`,
    model.date
      ? `<div class="title-meta"><strong>Date:</strong> ${esc(model.date)}</div>`
      : '',
    v.secondaryDateLabel && model.secondaryDate
      ? `<div class="title-meta"><strong>${esc(v.secondaryDateLabel)}:</strong> ${esc(model.secondaryDate)}</div>`
      : '',
  ].join('');

  return `
    <div class="doc-header">
      <div class="doc-logo">${safeImg(COMPANY.logoUrl, 'logo-img')}</div>
      <div class="doc-contact">${contactRows}</div>
      <div class="doc-title-block">
        <div class="doc-title${v.title.length > 14 ? ' doc-title-wrap' : ''}">${esc(v.title)}</div>
        ${metaRows}
      </div>
    </div>
    <div class="brand-divider"></div>`;
}

function renderInfoRow(model: ProjectDocumentModel): string {
  const c = model.customer;
  const custLines = [
    `<div class="info-strong">${esc(c.name)}</div>`,
    ...c.addressLines.map((l) => `<div class="info-line">${esc(l)}</div>`),
    c.phone ? `<div class="info-line">Phone: ${esc(c.phone)}</div>` : '',
  ].join('');

  const notesLines = esc(model.notes)
    .split('\n')
    .map((l) => `<div class="info-line">${l}</div>`)
    .join('');

  return `
    <div class="info-grid">
      <div class="info-col">
        <div class="info-label">CUSTOMER:</div>
        ${custLines}
      </div>
      <div class="info-col">
        <div class="info-label">PROJECT:</div>
        <div class="info-strong">${esc(model.projectName)}</div>
      </div>
      <div class="info-col">
        <div class="info-label">NOTES:</div>
        ${notesLines}
      </div>
    </div>`;
}

function renderSizeTable(li: DocLineItem): string {
  const head = li.singleQtyColumn
    ? `<tr><th colspan="2">QTY</th></tr>`
    : `<tr><th>SIZE</th><th>QTY</th></tr>`;
  const body = li.sizeRows
    .map((r) =>
      li.singleQtyColumn
        ? `<tr><td colspan="2" class="qty-center">${esc(r.qty)}</td></tr>`
        : `<tr><td>${esc(r.label)}</td><td>${esc(r.qty)}</td></tr>`,
    )
    .join('');
  return `
    <table class="mini">
      <thead>${head}</thead>
      <tbody>${body}</tbody>
      <tfoot><tr class="mini-total"><td>TOTAL QTY</td><td>${esc(li.totalQty)}</td></tr></tfoot>
    </table>`;
}

function renderPricingTable(li: DocLineItem): string {
  // Unpriced items (e.g. a not-yet-quoted project on the hub) render an em dash
  // rather than a misleading $0.00.
  const cell = (n: number) => (n > 0 ? money(n) : '—');
  const body = li.sizeRows
    .map((r) => `<tr><td>${cell(li.perPiece)}</td><td>${cell(li.perPiece * r.qty)}</td></tr>`)
    .join('');
  return `
    <table class="mini">
      <thead><tr><th>PER PIECE</th><th>TOTAL</th></tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr class="mini-total"><td>ITEM TOTAL</td><td>${cell(li.itemTotal)}</td></tr></tfoot>
    </table>`;
}

function renderLineItemRow(li: DocLineItem, model: ProjectDocumentModel): string {
  const v = model.visibility;
  const mocks = li.mockups.length
    ? li.mockups.map((m) => safeImg(m, 'li-mock')).join('')
    : '<div class="li-mock li-mock-empty">No mockup</div>';

  const locationsHtml = li.locations.map((l) => `<div class="li-loc">${esc(l)}</div>`).join('');

  const fourthCell = v.showPricing
    ? `<td class="cell-pricing">${renderPricingTable(li)}</td>`
    : `<td class="cell-notes"><div class="notes-lines"><span></span><span></span><span></span><span></span></div></td>`;

  return `
    <tr class="li-row">
      <td class="cell-lineitem">
        <div class="li-num">${esc(li.number)}</div>
        <div class="li-mocks">${mocks}</div>
      </td>
      <td class="cell-details">
        <div class="li-name">${esc(li.name)}</div>
        <div class="li-field"><span class="li-label">Product:</span> <span>${esc(li.product)}</span></div>
        <div class="li-field"><span class="li-label">Decoration:</span> <span>${esc(li.decoration)}</span></div>
        <div class="li-field"><span class="li-label">Locations:</span> ${locationsHtml}</div>
        <div class="li-field"><span class="li-label">Project Notes:</span> <span>${esc(li.notes)}</span></div>
      </td>
      <td class="cell-sizes">${renderSizeTable(li)}</td>
      ${fourthCell}
    </tr>`;
}

function renderTable(model: ProjectDocumentModel): string {
  const v = model.visibility;
  const fourthHead = v.showPricing ? 'PRICING' : 'NOTES';
  const rows = model.lineItems.map((li) => renderLineItemRow(li, model)).join('');
  return `
    <div class="doc-table-wrap">
      <table class="doc-table">
        <thead>
          <tr class="table-head">
            <th>LINE ITEM</th>
            <th>ITEM DETAILS</th>
            <th>SIZES &amp; QUANTITIES</th>
            <th>${fourthHead}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderOrderTotals(model: ProjectDocumentModel): string {
  const rows = model.totals
    .map((t) =>
      t.isGrandTotal
        ? `<div class="ot-row ot-grand"><span>TOTAL</span><span>${money(t.value)}</span></div>`
        : `<div class="ot-row"><span>${esc(t.label)}</span><span>${money(t.value)}</span></div>`,
    )
    .join('');
  return `
    <div class="ot-box">
      <div class="box-head">ORDER TOTAL</div>
      <div class="ot-body">${rows}</div>
    </div>`;
}

function renderNotesBox(model: ProjectDocumentModel): string {
  const bullets = DOC_NOTE_BULLETS.map((b) => `<li>${esc(b)}</li>`).join('');
  const callout = model.visibility.showApprovalCallout
    ? `<div class="approval-callout">
         <div class="approval-icon">${ICONS.pin}</div>
         <div>
           <div class="approval-title">${esc(DOC_APPROVAL_CALLOUT.title)}</div>
           <div class="approval-body">${esc(DOC_APPROVAL_CALLOUT.body)}</div>
         </div>
       </div>`
    : '';
  return `
    <div class="notes-col">
      <div class="notes-box">
        <div class="box-head">NOTES</div>
        <ul class="notes-list">${bullets}</ul>
      </div>
      <div class="disclaimer">${esc(DOC_DISCLAIMER)}</div>
      ${callout}
    </div>`;
}

function renderProductionNotesBox(): string {
  return `
    <div class="notes-col">
      <div class="prod-notes-box">
        <div class="prod-notes-head">PRODUCTION NOTES / SPECIAL INSTRUCTIONS</div>
        <div class="prod-notes-content">
          <div class="prod-notes-lines">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </div>`;
}

function renderChecklist(): string {
  const items = PRODUCTION_CHECKLIST.map(
    (c) => `<div class="check-row"><span class="check-box"></span><span>${esc(c)}</span></div>`,
  ).join('');
  return `
    <div class="checklist-box">
      <div class="checklist-head">CHECKLIST</div>
      <div class="checklist-body">${items}</div>
    </div>`;
}

function renderBottom(model: ProjectDocumentModel): string {
  const v = model.visibility;
  if (v.showChecklist || v.showProductionNotesBox) {
    return `
      <div class="bottom-grid">
        ${renderProductionNotesBox()}
        <div class="bottom-right">${renderChecklist()}</div>
      </div>`;
  }
  // Pricing is pending (no totals yet) — show the notes box full width rather than
  // an empty / $0.00 ORDER TOTAL box.
  if (!model.totals.length) {
    return `<div class="bottom-grid">${renderNotesBox(model)}</div>`;
  }
  return `
    <div class="bottom-grid">
      ${renderNotesBox(model)}
      <div class="bottom-right">${renderOrderTotals(model)}</div>
    </div>`;
}

function renderFooter(model: ProjectDocumentModel): string {
  if (!model.visibility.showThankYouFooter) {
    return `<div class="brand-divider footer-divider"></div>`;
  }
  return `
    <div class="brand-divider footer-divider"></div>
    <div class="doc-footer">
      <div class="footer-thanks">${esc(DOC_FOOTER.line1)}</div>
      <div class="footer-sub">${esc(DOC_FOOTER.line2)}</div>
    </div>`;
}

function styles(): string {
  return `
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{background:#fff;color:#111;font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact;overflow-x:auto}
    .doc-page{max-width:900px;min-width:680px;margin:0 auto;padding:28px 32px 36px}

    /* Header */
    .doc-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
    .doc-logo{flex:0 0 auto;width:34%}
    .logo-img{max-width:240px;width:100%;height:auto;object-fit:contain}
    .doc-contact{flex:1 1 auto;padding-top:6px;font-size:12px;color:#222}
    .contact-row{display:flex;align-items:flex-start;gap:7px;margin-bottom:6px}
    .contact-row svg{flex:0 0 auto;margin-top:1px}
    .contact-addr span{color:#444}
    .doc-title-block{flex:0 0 auto;text-align:right;min-width:200px;max-width:240px;background:#f5f5f5;border-radius:8px;padding:12px 16px}
    .doc-title{font-size:34px;font-weight:800;letter-spacing:-0.5px;line-height:1.04;color:#111;margin-bottom:8px}
    .doc-title-wrap{font-size:22px;letter-spacing:0;word-break:break-word;white-space:normal;line-height:1.2}
    .title-meta{font-size:12px;color:#222;margin-top:3px}
    .meta-key{color:#111;font-weight:700}

    .brand-divider{height:2px;background:${BRAND};border-radius:2px;margin:18px 0}
    .footer-divider{margin:22px 0 12px}

    /* Info row */
    .info-grid{display:flex;gap:24px;margin-bottom:18px}
    .info-col{flex:1 1 0}
    .info-label{color:${BRAND};font-weight:700;font-size:12px;margin-bottom:6px}
    .info-strong{font-weight:700;font-size:14px;color:#111;margin-bottom:3px}
    .info-line{color:#333;margin-bottom:2px}

    /* Main table */
    .doc-table-wrap{border:1px solid #e0e0e0;border-radius:10px;overflow:hidden}
    .doc-table{width:100%;border-collapse:collapse;table-layout:fixed}
    .table-head th{background:#111;color:#fff;font-size:11px;font-weight:700;letter-spacing:0.4px;text-align:center;padding:9px 8px}
    .doc-table td{border-top:1px solid #ececec;border-right:1px solid #ececec;padding:12px 10px;vertical-align:top}
    .doc-table td:last-child{border-right:none}
    .doc-table col,.doc-table th:nth-child(1){width:24%}
    .table-head th:nth-child(1){width:24%}
    .table-head th:nth-child(2){width:30%}
    .table-head th:nth-child(3){width:22%}
    .table-head th:nth-child(4){width:24%}

    /* Line item cell */
    .cell-lineitem{position:relative}
    .li-num{position:absolute;top:8px;left:8px;width:22px;height:22px;background:#111;color:#fff;border-radius:5px;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;z-index:2}
    .li-mocks{display:flex;flex-direction:column;gap:6px;padding-top:4px}
    .li-mock{width:100%;height:140px;object-fit:contain;background:#fafafa;border:1px solid #eee;border-radius:6px;display:block}
    .li-mock-empty{display:flex;align-items:center;justify-content:center;color:#bbb;font-size:10px}

    /* Item details */
    .li-name{font-weight:700;font-size:14px;color:#111;margin-bottom:7px}
    .li-field{font-size:11px;color:#333;margin-bottom:5px}
    .li-label{color:${BRAND};font-weight:700;display:inline-block;margin-right:4px}
    .li-loc{color:#333}

    /* Mini tables (sizes / pricing) */
    .mini{width:100%;border-collapse:collapse;font-size:11px}
    .mini th{background:#111;color:#fff;font-weight:700;padding:5px 8px;text-align:left;font-size:10.5px}
    .mini th:last-child{text-align:right}
    .mini td{padding:4px 8px;border-bottom:1px solid #f0f0f0;color:#222}
    .mini td:last-child{text-align:right;font-weight:600}
    .mini .qty-center{text-align:center;font-weight:600}
    .mini-total td{color:${BRAND};font-weight:800;border-bottom:none;border-top:1px solid #eee;padding-top:6px;white-space:nowrap}

    /* Production blank notes column */
    .cell-notes .notes-lines{display:flex;flex-direction:column;gap:18px;padding-top:6px}
    .cell-notes .notes-lines span{display:block;border-bottom:1px solid #e3e3e3;height:1px}

    /* Bottom section */
    .bottom-grid{display:flex;gap:20px;margin-top:22px;align-items:flex-start}
    .notes-col{flex:1.35 1 0}
    .bottom-right{flex:1 1 0}
    .box-head{background:#111;color:#fff;font-weight:700;font-size:12px;text-align:center;padding:7px 10px;border-radius:8px 8px 0 0}
    .notes-box{border:1px solid #e6e6e6;border-radius:8px;overflow:hidden}
    .notes-list{list-style:disc;padding:10px 14px 10px 28px}
    .notes-list li{font-size:10.5px;color:#333;margin-bottom:4px}
    .disclaimer{font-size:9.5px;color:#888;text-align:center;margin-top:12px;line-height:1.5;padding:0 8px}
    .approval-callout{display:flex;gap:10px;align-items:center;background:#fff6f0;border:1px solid #ffd9c2;border-radius:8px;padding:10px 12px;margin-top:12px}
    .approval-icon{flex:0 0 auto;width:28px;height:28px;background:${BRAND};border-radius:6px;display:flex;align-items:center;justify-content:center}
    .approval-icon svg{filter:brightness(0) invert(1)}
    .approval-title{font-weight:700;font-size:12px;color:#111}
    .approval-body{font-size:10.5px;color:#555}

    /* Order total */
    .ot-box{border:1px solid #e6e6e6;border-radius:8px;overflow:hidden}
    .ot-body{padding:4px 14px 12px}
    .ot-row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #efefef;font-size:12px;color:#222}
    .ot-row:first-child{font-weight:700}
    .ot-grand{border-bottom:none;border-top:2px solid #111;margin-top:4px;padding-top:12px;font-size:18px;font-weight:800;color:#111}
    .ot-grand span:last-child{color:${BRAND}}

    /* Production bottom */
    .prod-notes-box{border:1px solid #e6e6e6;border-radius:8px;overflow:hidden}
    .prod-notes-head{background:#111;color:#fff;font-weight:700;font-size:12px;text-align:center;padding:7px 10px}
    .prod-notes-content{padding:12px 14px}
    .prod-notes-lines{display:flex;flex-direction:column;gap:22px}
    .prod-notes-lines span{display:block;border-bottom:1px solid #d9d9d9;height:1px}
    .checklist-box{border:1px solid #e6e6e6;border-radius:8px;overflow:hidden}
    .checklist-head{background:#111;color:#fff;font-weight:700;font-size:12px;text-align:center;padding:7px 10px}
    .checklist-body{padding:12px 14px}
    .check-row{display:flex;align-items:center;gap:9px;margin-bottom:10px;font-size:12px;color:#222}
    .check-box{flex:0 0 auto;width:14px;height:14px;border:1.5px solid #999;border-radius:3px}

    /* Footer */
    .doc-footer{text-align:center;padding-bottom:6px}
    .footer-thanks{color:${BRAND};font-weight:700;font-size:15px;font-family:Georgia,'Times New Roman',serif;font-style:italic}
    .footer-sub{color:#444;font-size:12px;margin-top:2px}

    @media print{ .doc-page{padding:18px 20px} @page{margin:14mm} }
  `;
}

/** The complete, self-contained HTML document. */
export function buildProjectDocumentHTML(
  source: DocumentSource,
  mode: DocumentMode,
  opts: BuildOptions = {},
): string {
  const model = buildProjectDocumentModel(source, mode, opts);
  return buildProjectDocumentHTMLFromModel(model);
}

/** Render directly from a prebuilt model (used when caller already has one). */
export function buildProjectDocumentHTMLFromModel(model: ProjectDocumentModel): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(model.visibility.title)} — ${esc(COMPANY.name)}</title>
<style>${styles()}</style>
</head>
<body>
  <div class="doc-page">
    ${renderHeader(model)}
    ${renderInfoRow(model)}
    ${renderTable(model)}
    ${renderBottom(model)}
    ${renderFooter(model)}
  </div>
</body>
</html>`;
}
