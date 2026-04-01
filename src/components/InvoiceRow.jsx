import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import { downloadPdfMobile } from '../utils/pdfUtils';
import './InvoiceRow.css';

/**
 * InvoiceRow — client-facing invoice row.
 *
 * Changes from original:
 *   • Invoice number is now a clickable button that navigates to /invoice/:id
 *     for a full preview + reprint page.
 *   • PDF download logic is unchanged.
 */
function InvoiceRow({ invoice }) {
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [error, setError]             = useState('');

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-CA', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount || 0);

  const getStatusClass = (status) => {
    switch (status) {
      case 'paid':      return 'status-paid';
      case 'cancelled': return 'status-cancelled';
      default:          return 'status-unpaid';
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError('');
    try {
      const items = [];

      if (invoice.services?.hourly && Array.isArray(invoice.services.hourly)) {
        invoice.services.hourly.forEach(service => {
          items.push({
            description: service.description,
            quantity:    service.hours,
            rate:        service.rate,
            amount:      service.total,
          });
        });
      }

      if (invoice.services?.lineItems && Array.isArray(invoice.services.lineItems)) {
        invoice.services.lineItems.forEach(item => {
          items.push({
            description: item.description,
            quantity:    item.quantity,
            rate:        item.price,
            amount:      item.total,
          });
        });
      }

      const previewInvoicePDF = httpsCallable(functions, 'previewInvoicePDF');
      const result = await previewInvoicePDF({
        items,
        customerName:  invoice.customer?.name || 'Client',
        invoiceNumber: invoice.number,
        invoiceDate:   formatDate(invoice.date),
        subtotal:      invoice.totals?.subtotal?.toFixed(2)   || '0.00',
        tax:           invoice.totals?.taxAmount?.toFixed(2)  || '0.00',
        total:         invoice.totals?.finalTotal?.toFixed(2) || '0.00',
      });

      if (!result.data.success || !result.data.pdfBase64) {
        throw new Error('No PDF data returned');
      }

      downloadPdfMobile(result.data.pdfBase64, `Invoice-${invoice.number}.pdf`);
    } catch (err) {
      console.error('Download failed:', err);
      setError('Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="invoice-row">
      <div className="invoice-row-main">
        {/* Clickable invoice number → /invoice/:id preview page */}
        <button
          className="invoice-number invoice-number-link"
          onClick={() => navigate(`/invoice/${invoice.id}`)}
          title="View invoice"
        >
          {invoice.number}
        </button>
        <div className="invoice-date">{formatDate(invoice.date)}</div>
        <div className="invoice-amount">{formatCurrency(invoice.totals?.finalTotal)}</div>
        <div className={`invoice-status ${getStatusClass(invoice.status)}`}>
          {invoice.status || 'unpaid'}
        </div>
        <button
          className="download-btn"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading
            ? <><i className="fas fa-spinner fa-spin"></i> Generating...</>
            : <><i className="fas fa-download"></i> Download PDF</>}
        </button>
      </div>
      {error && <div className="invoice-row-error">{error}</div>}
    </div>
  );
}

export default InvoiceRow;
