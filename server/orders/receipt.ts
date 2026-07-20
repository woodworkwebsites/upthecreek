import type { Order } from '../../types/index.js';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function compactOrderRef(order: Order): string {
  return order.id.slice(0, 8).toUpperCase();
}

export function buildOrderReceiptFilename(order: Order): string {
  return `utc-order-${compactOrderRef(order)}-receipt.html`;
}

export function buildOrderReceiptHtml(order: Order): string {
  const items = order.items ?? [];
  const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const discount = order.discountAmount ?? 0;
  const total = order.amountTotal;
  const createdAt = formatDateTime(order.createdAt);
  const updatedAt = formatDateTime(order.updatedAt);

  const itemRows = items.length > 0
    ? items.map((item) => `
        <tr>
          <td>${escapeHtml(item.title)}</td>
          <td>${escapeHtml(item.color)}</td>
          <td>${escapeHtml(item.size)}</td>
          <td class="right">${item.quantity}</td>
          <td class="right">${formatMoney(item.unitPrice, order.currency)}</td>
          <td class="right">${formatMoney(item.unitPrice * item.quantity, order.currency)}</td>
        </tr>
      `).join('')
    : `
        <tr>
          <td colspan="6" class="muted">No line items were recorded on this order.</td>
        </tr>
      `;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>UTC Order Receipt ${escapeHtml(compactOrderRef(order))}</title>
    <style>
      :root {
        color-scheme: light;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #0b1531;
        background: #f4f1ea;
      }
      .page {
        max-width: 960px;
        margin: 0 auto;
        padding: 32px 24px 40px;
      }
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
      .header h1 {
        margin: 0;
        font-size: 30px;
        line-height: 1.1;
        letter-spacing: -0.03em;
      }
      .header p {
        margin: 8px 0 0;
        color: rgba(255,255,255,0.75);
      }
      .meta {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 16px;
        padding: 24px 32px 0;
      }
      .meta-item {
        border: 1px solid #e5e7eb;
        border-radius: 18px;
        padding: 16px;
        background: #fafafa;
      }
      .label {
        margin: 0;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: #8a8f9c;
      }
      .value {
        margin: 8px 0 0;
        font-size: 15px;
        font-weight: 700;
        color: #0b1531;
        word-break: break-word;
      }
      .section {
        padding: 24px 32px 0;
      }
      .section h2 {
        margin: 0 0 12px;
        font-size: 18px;
        line-height: 1.2;
      }
      .address-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }
      .panel {
        border: 1px solid #e5e7eb;
        border-radius: 18px;
        padding: 16px;
        background: #fff;
      }
      .panel p {
        margin: 0;
        line-height: 1.6;
        color: #374151;
      }
      .panel .strong {
        font-weight: 700;
        color: #0b1531;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
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
      .summary {
        display: grid;
        grid-template-columns: 1fr 260px;
        gap: 16px;
        align-items: start;
      }
      .totals {
        border-radius: 18px;
        background: #f8fafc;
        border: 1px solid #e5e7eb;
        padding: 16px;
      }
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
        .summary {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="card">
        <div class="header">
          <h1>UTC Order Receipt / Waybill</h1>
          <p>Private club order document for internal fulfilment and handover.</p>
        </div>

        <div class="meta">
          <div class="meta-item">
            <p class="label">Order ref</p>
            <p class="value">${escapeHtml(compactOrderRef(order))}</p>
          </div>
          <div class="meta-item">
            <p class="label">Stripe session</p>
            <p class="value">${escapeHtml(order.stripeSessionId)}</p>
          </div>
          <div class="meta-item">
            <p class="label">Status</p>
            <p class="value">${escapeHtml(order.status.replace(/_/g, ' '))}</p>
          </div>
          <div class="meta-item">
            <p class="label">Created</p>
            <p class="value">${escapeHtml(createdAt)}</p>
          </div>
        </div>

        <div class="section">
          <h2>Customer and delivery</h2>
          <div class="address-grid">
            <div class="panel">
              <p class="label">Customer</p>
              <p class="strong">${escapeHtml(order.customerName ?? order.customerEmail)}</p>
              <p>${escapeHtml(order.customerEmail)}</p>
              <p>${escapeHtml(order.shippingPhone || '—')}</p>
            </div>
            <div class="panel">
              <p class="label">Shipping address</p>
              <p class="strong">${escapeHtml(order.shippingName || '—')}</p>
              <p>${escapeHtml(order.shippingAddress1)}</p>
              ${order.shippingAddress2 ? `<p>${escapeHtml(order.shippingAddress2)}</p>` : ''}
              <p>${escapeHtml([order.shippingCity, order.shippingRegion].filter(Boolean).join(', ') || '—')}</p>
              <p>${escapeHtml([order.shippingZip, order.shippingCountry].filter(Boolean).join(', ') || '—')}</p>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>Items</h2>
          <div class="panel" style="padding: 0 16px;">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Colour</th>
                  <th>Size</th>
                  <th class="right">Qty</th>
                  <th class="right">Unit</th>
                  <th class="right">Line total</th>
                </tr>
              </thead>
              <tbody>
                ${itemRows}
              </tbody>
            </table>
          </div>
        </div>

        <div class="section">
          <div class="summary">
            <div class="panel">
              <p class="label">Notes</p>
              <p style="margin-top: 8px;">
                Use this document for fulfilment handover, dispatch notes, or internal invoice reference.
              </p>
              <p style="margin-top: 12px;" class="muted">
                Updated ${escapeHtml(updatedAt)} · Fulfilment provider: ${escapeHtml(order.fulfillmentProvider)}
              </p>
            </div>
            <div class="totals">
              <div class="totals-row"><span>Subtotal</span><span>${escapeHtml(formatMoney(subtotal, order.currency))}</span></div>
              <div class="totals-row"><span>Discount</span><span>- ${escapeHtml(formatMoney(discount, order.currency))}</span></div>
              <div class="totals-row total"><span>Total</span><span>${escapeHtml(formatMoney(total, order.currency))}</span></div>
            </div>
          </div>
        </div>

        <div class="footer">
          UTC private partner order document. If this is being used as a waybill, verify the delivery address and item counts before dispatch.
        </div>
      </div>
    </div>
  </body>
</html>`;
}
