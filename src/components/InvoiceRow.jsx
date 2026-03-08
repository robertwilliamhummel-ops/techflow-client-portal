import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import './InvoiceRow.css';

function InvoiceRow({ invoice }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount || 0);
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'paid': return 'status-paid';
      case 'cancelled': return 'status-cancelled';
      default: return 'status-unpaid';
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError('');

    try {
      // Build items array from invoice services
      const items = [];

      if (invoice.services?.hourly && Array.isArray(invoice.services.hourly)) {
        invoice.services.hourly.forEach(service => {
          items.push({
            description: service.description,
            quantity: service.hours,
            rate: service.rate,
            amount: service.total
          });
        });
      }

      if (invoice.services?.lineItems && Array.isArray(invoice.services.lineItems)) {
        invoice.services.lineItems.forEach(item => {
          items.push({
            description: item.description,
            quantity: item.quantity,
            rate: item.price,
            amount: item.total
          });
        });
      }

      // Call existing Firebase function (same one used for preview in invoice system)
      const previewInvoicePDF = httpsCallable(functions, 'previewInvoicePDF');
      const result = await previewInvoicePDF({
        items,
        customerName: invoice.customer?.name || 'Client',
        invoiceNumber: invoice.number,
        invoiceDate: formatDate(invoice.date),
        subtotal: invoice.totals?.subtotal?.toFixed(2) || '0.00',
        tax: invoice.totals?.taxAmount?.toFixed(2) || '0.00',
        total: invoice.totals?.finalTotal?.toFixed(2) || '0.00',
      });

      if (!result.data.success || !result.data.pdfBase64) {
        throw new Error('No PDF data returned');
      }

      // Convert base64 to download
      const binaryString = atob(result.data.pdfBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      // Trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice-${invoice.number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

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
        <div className="invoice-number">{invoice.number}</div>
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
          {downloading ? 'Generating...' : 'Download PDF'}
        </button>
      </div>
      {error && <div className="invoice-row-error">{error}</div>}
    </div>
  );
}

export default InvoiceRow;