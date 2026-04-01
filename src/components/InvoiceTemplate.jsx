import clientConfig from '../config/client';
import { formatDate, formatCurrency } from '../utils/formatters';
import './InvoiceTemplate.css';

/**
 * InvoiceTemplate — pure display component.
 * Used by InvoicePreview (view/print/download page).
 * Receives a full invoice document object as its only prop.
 *
 * Mobile fix: table is wrapped in .it-table-wrap for horizontal scroll
 * so it never breaks the viewport width.
 */
function InvoiceTemplate({ invoice }) {
  if (!invoice) return null;

  const { customer, services, totals, number, date, status } = invoice;

  const getStatusClass = (s) => {
    if (s === 'paid')      return 'it-badge-paid';
    if (s === 'cancelled') return 'it-badge-cancelled';
    return 'it-badge-unpaid';
  };

  const getStatusLabel = (s) => {
    if (s === 'paid')      return '✓ Paid';
    if (s === 'cancelled') return 'Cancelled';
    return 'Unpaid';
  };

  const hourlyServices = services?.hourly    || [];
  const lineItems      = services?.lineItems || [];

  return (
    <div className="invoice-template">

      {/* ── Header ── */}
      <div className="it-header">
        <div className="it-brand">
          <img src={clientConfig.logoUrl} alt={clientConfig.companyName} className="it-logo" />
          <div className="it-brand-text">
            <h2 className="it-company-name">{clientConfig.companyName}</h2>
            <p className="it-company-tagline">{clientConfig.companyTagline}</p>
            <p className="it-company-contact">{clientConfig.companyPhone}</p>
            <p className="it-company-contact">{clientConfig.companyEmail}</p>
          </div>
        </div>
        <div className="it-meta">
          <div className="it-meta-row">
            <span className="it-meta-label">INVOICE</span>
            <span className="it-meta-value it-inv-number">#{number}</span>
          </div>
          <div className="it-meta-row">
            <span className="it-meta-label">Date</span>
            <span className="it-meta-value">{formatDate(date)}</span>
          </div>
          <div className="it-meta-row">
            <span className="it-meta-label">Status</span>
            <span className={`it-status-badge ${getStatusClass(status)}`}>
              {getStatusLabel(status)}
            </span>
          </div>
        </div>
      </div>

      <div className="it-divider"></div>

      {/* ── Bill To ── */}
      <div className="it-bill-to">
        <h4 className="it-section-label">Bill To</h4>
        <p className="it-customer-name">{customer?.name || '—'}</p>
        {customer?.company  && <p className="it-customer-detail">{customer.company}</p>}
        {customer?.address  && <p className="it-customer-detail">{customer.address}</p>}
        {customer?.phone    && <p className="it-customer-detail">{customer.phone}</p>}
        {customer?.email    && <p className="it-customer-detail">{customer.email}</p>}
      </div>

      {/*
       * Table wrapped in a scroll container so it never overflows the
       * viewport on narrow mobile screens. The table itself has a min-width
       * so columns don't collapse to unreadable widths.
       */}
      <div className="it-table-wrap">
        <table className="it-table">
          <thead>
            <tr>
              <th className="it-th it-th-desc">Description</th>
              <th className="it-th it-th-qty">Qty / Hrs</th>
              <th className="it-th it-th-rate">Rate</th>
              <th className="it-th it-th-amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            {hourlyServices.map((s, i) => (
              <tr key={`h-${i}`} className="it-tr">
                <td className="it-td">{s.description}</td>
                <td className="it-td it-td-num">{s.hours}</td>
                <td className="it-td it-td-num">{formatCurrency(s.rate)}/hr</td>
                <td className="it-td it-td-num">{formatCurrency(s.total)}</td>
              </tr>
            ))}
            {lineItems.map((item, i) => (
              <tr key={`l-${i}`} className="it-tr">
                <td className="it-td">{item.description}</td>
                <td className="it-td it-td-num">{item.quantity}</td>
                <td className="it-td it-td-num">{formatCurrency(item.price)}</td>
                <td className="it-td it-td-num">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Totals ── */}
      <div className="it-totals">
        <div className="it-total-row">
          <span>Subtotal</span>
          <span>{formatCurrency(totals?.subtotal)}</span>
        </div>
        <div className="it-total-row">
          <span>{clientConfig.taxName}</span>
          <span>{formatCurrency(totals?.taxAmount)}</span>
        </div>
        <div className="it-total-final">
          <span>Total</span>
          <span>{formatCurrency(totals?.finalTotal)}</span>
        </div>
      </div>

      {/* ── Payment info ── */}
      <div className="it-payment-info">
        <h4 className="it-section-label">Payment Information</h4>
        <p>
          <strong>E-Transfer (Preferred):</strong> {clientConfig.invoiceEmail}
        </p>
        <p>
          <strong>Payment due within {clientConfig.paymentTermsDays} days</strong>
          {' '}· Questions? {clientConfig.companyPhone}
        </p>
      </div>

    </div>
  );
}

export default InvoiceTemplate;
