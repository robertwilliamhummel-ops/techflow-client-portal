import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { formatDate } from '../utils/formatters';
import { downloadPdfMobile } from '../utils/pdfUtils';
import InvoiceTemplate from './InvoiceTemplate';
import './InvoicePreview.css';

/**
 * InvoicePreview — /invoice/:id
 * Fetches the invoice by Firestore document ID, renders it using InvoiceTemplate,
 * and provides Download PDF and Print actions.
 * PDF is generated on-demand via the existing previewInvoicePDF Firebase function —
 * no PDF storage.
 */
function InvoicePreview() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [invoice, setInvoice]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [downloading, setDownloading] = useState(false);
  const [dlError, setDlError]     = useState('');

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const fetchInvoice = async () => {
    setLoading(true);
    setError('');
    try {
      const snap = await getDoc(doc(db, 'invoices', id));
      if (!snap.exists()) {
        setError('Invoice not found.');
      } else {
        setInvoice({ id: snap.id, ...snap.data() });
      }
    } catch (err) {
      console.error('Error fetching invoice:', err);
      setError('Could not load invoice. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Build the items array the same way InvoiceRow.jsx does ───────────────
  const buildItems = (inv) => {
    const items = [];
    if (inv.services?.hourly && Array.isArray(inv.services.hourly)) {
      inv.services.hourly.forEach(s => {
        items.push({
          description: s.description,
          quantity:    s.hours,
          rate:        s.rate,
          amount:      s.total,
        });
      });
    }
    if (inv.services?.lineItems && Array.isArray(inv.services.lineItems)) {
      inv.services.lineItems.forEach(item => {
        items.push({
          description: item.description,
          quantity:    item.quantity,
          rate:        item.price,
          amount:      item.total,
        });
      });
    }
    return items;
  };

  // ── Download PDF — reuses previewInvoicePDF exactly as InvoiceRow does ───
  const handleDownload = async () => {
    if (!invoice) return;
    setDownloading(true);
    setDlError('');
    try {
      const previewInvoicePDF = httpsCallable(functions, 'previewInvoicePDF');
      const result = await previewInvoicePDF({
        items:         buildItems(invoice),
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
      setDlError('Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  // ── Print — browser print dialog, CSS hides everything except .invoice-preview ──
  const handlePrint = () => window.print();

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="ip-state ip-loading">
        <i className="fas fa-spinner fa-spin"></i> Loading invoice...
      </div>
    );
  }

  if (error) {
    return (
      <div className="ip-state ip-error">
        <i className="fas fa-exclamation-triangle"></i> {error}
        <button className="ip-back-btn" onClick={() => navigate(-1)}>
          <i className="fas fa-arrow-left"></i> Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="ip-page">
      {/* Action bar — hidden during print */}
      <div className="ip-actions no-print">
        <button className="ip-btn ip-btn-back" onClick={() => navigate(-1)}>
          <i className="fas fa-arrow-left"></i> Back
        </button>
        <div className="ip-actions-right">
          <button
            className="ip-btn ip-btn-download"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading
              ? <><i className="fas fa-spinner fa-spin"></i> Generating...</>
              : <><i className="fas fa-download"></i> Download PDF</>}
          </button>
          <button className="ip-btn ip-btn-print" onClick={handlePrint}>
            <i className="fas fa-print"></i> Print
          </button>
        </div>
      </div>

      {dlError && (
        <div className="ip-dl-error no-print">
          <i className="fas fa-exclamation-circle"></i> {dlError}
        </div>
      )}

      {/* Invoice content — this is what gets printed */}
      <div className="invoice-preview">
        <InvoiceTemplate invoice={invoice} />
      </div>
    </div>
  );
}

export default InvoicePreview;
