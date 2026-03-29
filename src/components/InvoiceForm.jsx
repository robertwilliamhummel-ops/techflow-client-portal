import { useState, useRef, useEffect } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { useInvoiceCounter } from '../hooks/useInvoiceCounter';
import { formatDate, todayISO, roundToTwo, formatCurrency } from '../utils/formatters';
import { validateCustomer, validateCustomerEmail } from '../utils/validators';
import { isMobileDevice, downloadPdfMobile, createPdfBlobUrl } from '../utils/pdfUtils';
import CustomerSection from './CustomerSection';
import ServiceCalculator from './ServiceCalculator';
import './InvoiceForm.css';

/**
 * InvoiceForm — mobile PDF fix summary
 * ─────────────────────────────────────────────────────────────────────────
 * ROOT CAUSE of mobile preview failure:
 *   handlePreview was creating a blob URL and setting it on an <iframe>.
 *   Mobile Safari cannot render PDFs inside iframes served from blob: URLs —
 *   the iframe just stays blank. Android Chrome fails silently in the same way.
 *
 * FIX — two-path strategy via isMobileDevice() from pdfUtils.js:
 *
 *   Desktop  → unchanged UX: blob URL → <iframe> renders inline in the page.
 *
 *   Mobile   → skip the iframe entirely. Call downloadPdfMobile() which uses
 *              a hidden <a download> element so the OS hands the file to its
 *              native PDF viewer (Files / Downloads app). The button label
 *              changes to "Open PDF" to match the expected mobile action.
 * ─────────────────────────────────────────────────────────────────────────
 */

function TotalsBox({ calcRef, chargeHST }) {
  const [totals, setTotals] = useState({
    hourlyTotal: 0, lineItemsTotal: 0, subtotal: 0, taxAmount: 0, finalTotal: 0,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      if (calcRef.current?.getTotals) {
        setTotals(calcRef.current.getTotals(chargeHST));
      }
    }, 200);
    return () => clearInterval(interval);
  }, [chargeHST]);

  return (
    <div className="totals-box">
      <div className="totals-row"><span>Hourly Services</span><span>{formatCurrency(totals.hourlyTotal)}</span></div>
      <div className="totals-row"><span>Line Items</span><span>{formatCurrency(totals.lineItemsTotal)}</span></div>
      <div className="totals-row"><span>Subtotal</span><span>{formatCurrency(totals.subtotal)}</span></div>
      <div className="totals-row"><span>HST (13%)</span><span>{formatCurrency(totals.taxAmount)}</span></div>
      <div className="totals-final"><span>Total</span><span>{formatCurrency(totals.finalTotal)}</span></div>
    </div>
  );
}

function InvoiceForm({ user }) {
  const { invoiceNumber, consumeNumber } = useInvoiceCounter(user?.uid);
  const [invoiceDate, setInvoiceDate]   = useState(todayISO());
  const [customer, setCustomer]         = useState({});
  const [chargeHST, setChargeHST]       = useState(false);
  const [toast, setToast]               = useState(null);
  const [previewing, setPreviewing]     = useState(false);
  const [sending, setSending]           = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl]     = useState(null); // desktop only
  const calcRef = useRef();

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const buildItems = (hourlyServices, lineItems) => {
    const items = [];
    hourlyServices?.forEach(s =>
      items.push({ description: s.description, quantity: s.hours, rate: s.rate, amount: s.total })
    );
    lineItems?.forEach(i =>
      items.push({ description: i.description, quantity: i.quantity, rate: i.price, amount: i.total })
    );
    return items;
  };

  // ── Preview ───────────────────────────────────────────────────────────────
  const handlePreview = async () => {
    const err1 = validateCustomer(customer);
    if (err1.length) { showToast(err1[0], 'error'); return; }
    const err2 = calcRef.current?.validate() || [];
    if (err2.length) { showToast(err2[0], 'error'); return; }

    setPreviewing(true);

    // Clean up any existing desktop blob URL
    if (pdfBlobUrl) { URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(null); }

    try {
      const { hourlyServices, lineItems, totals } = calcRef.current.getData(chargeHST);

      const result = await httpsCallable(functions, 'previewInvoicePDF')({
        items:         buildItems(hourlyServices, lineItems),
        customerName:  customer.name,
        invoiceNumber,
        invoiceDate:   formatDate(invoiceDate),
        subtotal:      totals.subtotal.toFixed(2),
        tax:           totals.taxAmount.toFixed(2),
        total:         totals.finalTotal.toFixed(2),
      });

      if (!result.data.success || !result.data.pdfBase64) {
        throw new Error('No PDF data returned');
      }

      if (isMobileDevice()) {
        // ── Mobile path ──────────────────────────────────────────────────
        // Iframes can't render blob-URL PDFs on iOS/Android.
        // Hand off to the OS native PDF viewer via <a download>.
        downloadPdfMobile(
          result.data.pdfBase64,
          `Invoice-${invoiceNumber}.pdf`
        );
        showToast('PDF sent to your device — check Downloads / Files.', 'info');
      } else {
        // ── Desktop path ─────────────────────────────────────────────────
        // Inline iframe preview — unchanged UX.
        setPdfBlobUrl(createPdfBlobUrl(result.data.pdfBase64));
      }
    } catch (err) {
      showToast(`Preview failed: ${err.message}`, 'error');
    } finally {
      setPreviewing(false);
    }
  };

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const err1 = validateCustomer(customer);
    if (err1.length) { showToast(err1[0], 'error'); return; }
    const emailErr = validateCustomerEmail(customer);
    if (emailErr) { showToast(emailErr, 'error'); return; }
    const err2 = calcRef.current?.validate() || [];
    if (err2.length) { showToast(err2[0], 'error'); return; }

    setSending(true);
    try {
      const { hourlyServices, lineItems, totals } = calcRef.current.getData(chargeHST);
      const confirmedNumber = await consumeNumber();

      await addDoc(collection(db, 'invoices'), {
        userId:   user.uid,
        customer,
        number:   confirmedNumber,
        date:     invoiceDate,
        services: { hourly: hourlyServices, lineItems },
        totals:   { subtotal: totals.subtotal, taxAmount: totals.taxAmount, finalTotal: totals.finalTotal },
        status:   'unpaid',
        createdAt: Timestamp.now(),
      });

      await httpsCallable(functions, 'sendInvoiceEmail')({
        customerEmail:  customer.email,
        customerName:   customer.name,
        invoiceNumber:  confirmedNumber,
        invoiceDate:    formatDate(invoiceDate),
        items:          buildItems(hourlyServices, lineItems),
        subtotal:       totals.subtotal.toFixed(2),
        tax:            totals.taxAmount.toFixed(2),
        total:          totals.finalTotal.toFixed(2),
        amount:         totals.finalTotal,
      });

      showToast(`Invoice ${confirmedNumber} sent! Next number ready.`, 'success');
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setSending(false);
    }
  };

  // ── Clear ─────────────────────────────────────────────────────────────────
  const handleClear = () => {
    if (!confirm('Clear the form? All unsaved data will be lost.')) return;
    setCustomer({});
    setInvoiceDate(todayISO());
    setChargeHST(false);
    calcRef.current?.reset();
    if (pdfBlobUrl) { URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(null); }
    showToast('Form cleared', 'info');
  };

  // Preview button label differs on mobile vs desktop
  const previewLabel = isMobileDevice() ? 'Open PDF' : 'Preview PDF';
  const previewIcon  = isMobileDevice() ? 'fa-download' : 'fa-eye';

  return (
    <div className="invoice-form">

      {toast && (
        <div className={`inv-toast inv-toast-${toast.type}`}>
          <i className={`fas ${
            toast.type === 'success' ? 'fa-check-circle'
            : toast.type === 'info' ? 'fa-info-circle'
            : 'fa-exclamation-circle'
          }`}></i>
          {toast.message}
          <button className="toast-close" onClick={() => setToast(null)}>
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {/* TOP ROW */}
      <div className="form-top-grid">
        <CustomerSection user={user} onCustomerChange={setCustomer} />

        <div className="form-card">
          <div className="card-title"><i className="fas fa-file-invoice"></i> Invoice Details</div>

          <div className="detail-row">
            <div className="form-group">
              <label className="form-label">Invoice #</label>
              <div className="inv-num-display">{invoiceNumber || 'Loading...'}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input
                type="date"
                className="form-input"
                value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)}
              />
            </div>
          </div>

          <label className="hst-label">
            <input
              type="checkbox"
              checked={chargeHST}
              onChange={e => setChargeHST(e.target.checked)}
            />
            Add HST (13%)
          </label>

          <TotalsBox calcRef={calcRef} chargeHST={chargeHST} />
        </div>
      </div>

      {/* Services */}
      <ServiceCalculator ref={calcRef} />

      {/*
       * Desktop-only inline PDF preview.
       * Never rendered on mobile — isMobileDevice() path uses downloadPdfMobile()
       * instead and never sets pdfBlobUrl, so this block stays null on mobile.
       */}
      {pdfBlobUrl && (
        <div className="preview-section">
          <div className="preview-header">
            <span><i className="fas fa-eye"></i> Invoice Preview</span>
            <button
              className="btn-close-preview"
              onClick={() => { URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(null); }}
            >
              <i className="fas fa-times"></i> Close
            </button>
          </div>
          <iframe src={pdfBlobUrl} className="pdf-iframe" title="Invoice Preview" />
        </div>
      )}

      {/* ACTION BUTTONS */}
      <div className="action-btns">
        <button
          className="btn-preview-action"
          onClick={handlePreview}
          disabled={previewing || sending}
        >
          {previewing
            ? <><i className="fas fa-spinner fa-spin"></i> Generating...</>
            : <><i className={`fas ${previewIcon}`}></i> {previewLabel}</>}
        </button>
        <button
          className="btn-send-action"
          onClick={handleSend}
          disabled={sending || previewing}
        >
          {sending
            ? <><i className="fas fa-spinner fa-spin"></i> Sending...</>
            : <><i className="fas fa-envelope"></i> Send Invoice</>}
        </button>
        <button
          className="btn-clear-action"
          onClick={handleClear}
          disabled={sending || previewing}
        >
          <i className="fas fa-redo"></i> Clear
        </button>
      </div>

    </div>
  );
}

export default InvoiceForm;
