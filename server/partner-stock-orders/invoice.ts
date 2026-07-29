import type { PartnerAdmin, PartnerStockOrder } from '../../types/index.js';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pence / 100);
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function compactOrderRef(order: PartnerStockOrder): string {
  return order.id.slice(0, 8).toUpperCase();
}

function formatStatusLabel(status: PartnerStockOrder['status']): string {
  const labels: Record<PartnerStockOrder['status'], string> = {
    club_submitted: 'Club submitted',
    invoiced: 'Invoiced',
    sellshirts_order: 'Sellshirts order',
    sellshirts_dispatched: 'Sellshirts Dispatched',
    at_utc: 'At UTC',
    with_club: 'With Club',
    cancelled: 'Cancelled',
    archived: 'Archived',
  };

  return labels[status] ?? status.replace(/_/g, ' ');
}

export function buildPartnerStockOrderInvoiceFilename(
  order: PartnerStockOrder,
  partner: Pick<PartnerAdmin, 'slug'>,
): string {
  return `utc-partner-stock-invoice-${partner.slug}-${compactOrderRef(order)}.html`;
}

export function buildPartnerStockOrderInvoiceHtml(
  order: PartnerStockOrder,
  partner: Pick<PartnerAdmin, 'name' | 'slug'>,
): string {
  const items = order.items ?? [];
  const createdAt = formatDateTime(order.createdAt);
  const updatedAt = formatDateTime(order.updatedAt);
  const totalPieces = order.totalPieces;
  const totalValue = formatMoney(order.totalValue);
  const itemRows = items.length > 0
    ? items.map((item) => `
        <tr>
          <td>
            <div class="item-title">${escapeHtml(item.title)}</div>
            <div class="muted">${escapeHtml(item.color)} · ${escapeHtml(item.size)}</div>
          </td>
          <td class="right">${item.quantity}</td>
          <td class="right">${formatMoney(item.unitPrice)}</td>
          <td class="right">${formatMoney(item.unitPrice * item.quantity)}</td>
        </tr>
      `).join('')
    : `
        <tr>
          <td colspan="4" class="muted">No line items were recorded on this stock order.</td>
        </tr>
      `;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>UTC Partner Stock Invoice ${escapeHtml(compactOrderRef(order))}</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #0b1531;
        background: #f4f1ea;
      }
      .page { max-width: 980px; margin: 0 auto; padding: 32px 24px 40px; }
      .card {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 24px;
        box-shadow: 0 18px 50px rgba(5, 13, 31, 0.08);
        overflow: hidden;
      }
      .header {
        padding: 28px 32px;
        background: linear-gradient(180deg, #06122c 0%, #0a1736 100%);
        color: #fff;
      }
      .header h1 { margin: 0; font-size: 30px; line-height: 1.1; letter-spacing: -0.03em; }
      .header p { margin: 8px 0 0; color: rgba(255,255,255,0.75); }
      .meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; padding: 24px 32px 0; }
      .meta-item, .panel, .totals {
        border: 1px solid #e5e7eb;
        border-radius: 18px;
        padding: 16px;
        background: #fafafa;
      }
      .meta-item .label, .section-label {
        margin: 0;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: #8a8f9c;
      }
      .meta-item .value {
        margin: 8px 0 0;
        font-size: 15px;
        font-weight: 700;
        color: #0b1531;
        word-break: break-word;
      }
      .section { padding: 24px 32px 0; }
      .section h2 { margin: 0 0 12px; font-size: 18px; line-height: 1.2; }
      .address-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
      .panel p { margin: 0; line-height: 1.6; color: #374151; }
      .panel .strong { font-weight: 700; color: #0b1531; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      thead th {
        text-align: left;
        font-size: 11px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #8a8f9c;
        padding: 0 0 10px;
        border-bottom: 1px solid #e5e7eb;
      }
      tbody td {
        padding: 12px 0;
        border-bottom: 1px solid #f1f5f9;
        vertical-align: top;
      }
      .right { text-align: right; }
      .muted { color: #6b7280; }
      .item-title { font-weight: 700; color: #0b1531; }
      .summary { display: grid; grid-template-columns: 1fr 260px; gap: 16px; align-items: start; }
      .totals { background: #f8fafc; }
      .totals-row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        margin: 0 0 8px;
        font-size: 13px;
      }
      .totals-row.total {
        padding-top: 8px;
        margin-top: 8px;
        border-top: 1px solid #e5e7eb;
        font-size: 15px;
        font-weight: 800;
      }
      .badge-row { display: flex; flex-wrap: wrap; gap: 8px; }
      .badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 6px 10px;
        background: #fff;
        border: 1px solid #e5e7eb;
        font-size: 12px;
        font-weight: 700;
      }
      .badge.success { background: #ecfdf5; border-color: #a7f3d0; color: #047857; }
      .badge.warning { background: #fffbeb; border-color: #fde68a; color: #92400e; }
      .footer {
        padding: 24px 32px 32px;
        color: #6b7280;
        font-size: 12px;
        line-height: 1.6;
      }
      @media print {
        body { background: #fff; }
        .page { padding: 0; max-width: none; }
        .card { border-radius: 0; box-shadow: none; border: none; }
      }
      @media (max-width: 800px) {
        .meta,
        .address-grid,
        .summary { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="card">
        <div class="header">
          <h1>UTC Partner Stock Invoice</h1>
          <p>Internal invoice document for club stock orders.</p>
        </div>

        <div class="meta">
          <div class="meta-item">
            <p class="label">Invoice ref</p>
            <p class="value">${escapeHtml(compactOrderRef(order))}</p>
          </div>
          <div class="meta-item">
            <p class="label">Club</p>
            <p class="value">${escapeHtml(partner.name)}</p>
          </div>
          <div class="meta-item">
            <p class="label">Club code</p>
            <p class="value">${escapeHtml(partner.slug.toUpperCase())}</p>
          </div>
          <div class="meta-item">
            <p class="label">Generated</p>
            <p class="value">${escapeHtml(createdAt)}</p>
          </div>
        </div>

        <div class="section">
          <div class="badge-row">
            <span class="badge ${order.status === 'invoiced' ? 'success' : 'warning'}">${escapeHtml(formatStatusLabel(order.status))}</span>
            <span class="badge ${order.invoicePaid ? 'success' : 'warning'}">Invoice ${order.invoicePaid ? 'paid' : 'unpaid'}</span>
            <span class="badge">Updated ${escapeHtml(updatedAt)}</span>
          </div>
        </div>

        <div class="section">
          <div class="summary">
            <div>
              <h2>Order details</h2>
              <div class="address-grid">
                <div class="panel">
                  <p class="section-label">Partner</p>
                  <p class="strong">${escapeHtml(partner.name)}</p>
                  <p>${escapeHtml(partner.slug)}</p>
                </div>
                <div class="panel">
                  <p class="section-label">Summary</p>
                  <p><span class="strong">${totalPieces}</span> piece${totalPieces === 1 ? '' : 's'}</p>
                  <p><span class="strong">${totalValue}</span> total value</p>
                </div>
              </div>
            </div>

            <div class="totals">
              <div class="totals-row">
                <span>Pieces</span>
                <span>${totalPieces}</span>
              </div>
              <div class="totals-row total">
                <span>Invoice total</span>
                <span>${totalValue}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>Line items</h2>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th class="right">Qty</th>
                <th class="right">Unit</th>
                <th class="right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows}
            </tbody>
          </table>
        </div>

        ${order.notes ? `
          <div class="section">
            <h2>Notes</h2>
            <div class="panel">
              <p>${escapeHtml(order.notes)}</p>
            </div>
          </div>
        ` : ''}

        <div class="footer">
          Partner stock invoice generated by Up The Creek Padel.
          This document is for internal processing, invoice tracking and club handover.
        </div>
      </div>
    </div>
  </body>
</html>`;
}
