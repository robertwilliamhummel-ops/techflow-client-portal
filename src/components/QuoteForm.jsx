import { useState, useRef, useEffect } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { useQuoteCounter } from '../hooks/useQuoteCounter';
import { formatDate, todayISO, formatCurrency } from '../utils/formatters';
import { validateCustomer, validateCustomerEmail } from '../utils/validators';
import { isMobileDevice, downloadPdfMobile, createPdfBlobUrl } from '../utils/pdfUtils';
import CustomerSection from './CustomerSection';
import ServiceCalculator from './ServiceCalculator';
import './QuoteForm.css';

/**
 * QuoteForm — mobile PDF fix summary
 * ─────────────────────────────────────────────────────────────────────────
 * Same root cause and fix as InvoiceForm:
 *   Desktop  → blob URL → <iframe> inline preview (unchanged)
 *   Mobile   → downloadPdfMobile() → OS native PDF viewer
 * ─────────────────────────────────────────────────────────────────────────
 */

function thirtyDaysFromNow() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
}

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
      <div className="totals-final"><span>Estimated Total</span><span>{formatCurrency(totals.finalTotal)}</span></div>
    </div>
  );
}

function QuoteForm({ user, onQuoteSent }) {
  const { quoteNumber, consumeNumber } = useQuoteCounter(user?.uid);
  const [quoteDate, setQuoteDate]     = useState(todayISO());
  const [validUntil, setValidUntil]   = useState(thirtyDaysFromNow());
  const [customer, setCustomer]       = useState({});
  const [chargeHST, setChargeHST]     = useState(false);
  const [notes, setNotes]             = useState('');
  const [toast, setToast]             = useState(null);
  const [previewing, setPreviewing]   = useState(false);
  const [sending, setSending]         = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl]   = useState(null); // desktop only
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
    if (pdfBlobUrl) { URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(null); }

    try {
      const { hourlyServices, lineItems, totals } = calcRef.current.getData(chargeHST);

      const result = await httpsCallable(functions, 'previewQuotePDF')({
        items:        buildItems(hourlyServices, lineItems),
        customerName: customer.name,
        quoteNumber,
        quoteDate:    formatDate(quoteDate),
        validUntil:   formatDate(validUntil),
        subtotal:     totals.subtotal.toFixed(2),
        tax:          totals.taxAmount.toFixed(2),
        total:        totals.finalTotal.toFixed(2),
        notes,
      });

      if (!result.data.success || !result.data.pdfBase64) {
        throw new Error('No PDF data returned');
      }

      if (isMobileDevice()) {
        // ── Mobile path ──────────────────────────────────────────────────
        downloadPdfMobile(
          result.data.pdfBase64,
          `Quote-${quoteNumber}.pdf`
        );
        showToast('PDF sent to your device — check Downloads / Files.', 'info');
      } else {
        // ── Desktop path ─────────────────────────────────────────────────
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

      const docRef = await addDoc(collection(db, 'quotes'), {
        userId:    user.uid,
        customer,
        quoteNumber: confirmedNumber,
        date:       quoteDate,
        validUntil,
        services:   { hourly: hourlyServices, lineItems },
        totals: {
          subtotal:   totals.subtotal,
          taxAmount:  totals.taxAmount,
          finalTotal: totals.finalTotal,
        },
        notes,
        status:            'sent',
        convertedToInvoice: null,
        createdAt:         Timestamp.now(),
        sentAt:            Timestamp.now(),
      });

      await httpsCallable(functions, 'sendQuoteEmail')({
        customerEmail: customer.email,
        customerName:  customer.name,
        quoteNumber:   confirmedNumber,
        quoteDate:     formatDate(quoteDate),
        validUntil:    formatDate(validUntil),
        items:         buildItems(hourlyServices, lineItems),
        subtotal:      totals.subtotal.toFixed(2),
        tax:           totals.taxAmount.toFixed(2),
        total:         totals.finalTotal.toFixed(2),
        notes,
      });

      showToast(`Quote ${confirmedNumber} sent to ${customer.email}!`, 'success');
      if (onQuoteSent) onQuoteSent();
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setSending(false);
    }
  };

  // ── Save Draft ────────────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    const err1 = validateCustomer(customer);
    if (err1.length) { showToast(err1[0], 'error'); return; }

    setSending(true);
    try {
      const { hourlyServices, lineItems, totals } = calcRef.current?.getData(chargeHST) || {
        hourlyServices: [], lineItems: [], totals: { subtotal: 0, taxAmount: 0, finalTotal: 0 },
      };
      const confirmedNumber = await consumeNumber();

      await addDoc(collection(db, 'quotes'), {
        userId:    user.uid,
        customer,
        quoteNumber: confirmedNumber,
        date:       quoteDate,
        validUntil,
        services:   { hourly: hourlyServices, lineItems },
        totals: {
          subtotal:   totals.subtotal,
          taxAmount:  totals.taxAmount,
          finalTotal: totals.finalTotal,
        },
        notes,
        status:            'draft',
        convertedToInvoice: null,
        createdAt:         Timestamp.now(),
        sentAt:            null,
      });

      showToast(`Draft ${confirmedNumber} saved!`, 'success');
      if (onQuoteSent) onQuoteSent();
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
    setQuoteDate(todayISO());
    setValidUntil(thirtyDaysFromNow());
    setChargeHST(false);
    setNotes('');
    calcRef.current?.reset();
    if (pdfBlobUrl) { URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(null); }
    showToast('Form cleared', 'info');
  };

  const previewLabel = isMobileDevice() ? 'Open PDF' : 'Preview PDF';
  const previewIcon  = isMobileDevice() ? 'fa-download' : 'fa-eye';

  return (
    <div className="invoice-form quote-form">

      {toast && (
        <div
          className={`inv-toast inv-toast-${toast.type}`}
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
        >
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

      <div className="quote-notice">
        <i className="fas fa-info-circle"></i>
        You are creating a <strong>Quote / Estimate</strong>. No payment is due until work is completed and an invoice is issued.
      </div>

      {/* TOP ROW */}
      <div className="form-top-grid">
        <CustomerSection user={user} onCustomerChange={setCustomer} />

        <div className="form-card">
          <div className="card-title"><i className="fas fa-file-alt"></i> Quote Details</div>

          <div className="detail-row">
            <div className="form-group">
              <label className="form-label">Quote #</label>
              <div className="inv-num-display">{quoteNumber || 'Loading...'}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input
                type="date"
                className="form-input"
                value={quoteDate}
                onChange={e => setQuoteDate(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              <i className="fas fa-calendar-times" style={{ marginRight: '6px', color: '#f59e0b' }}></i>
              Valid Until <span className="valid-until-badge">Required</span>
            </label>
            <input
              type="date"
              className="form-input valid-until-input"
              value={validUntil}
              onChange={e => setValidUntil(e.target.value)}
            />
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

      {/* Notes */}
      <div className="form-card quote-notes-card">
        <div className="card-title">
          <i className="fas fa-sticky-note"></i> Notes / Terms & Conditions{' '}
          <span className="optional-badge">Optional</span>
        </div>
        <textarea
          className="form-input quote-notes-textarea"
          placeholder="Add any notes, terms, or conditions for this quote..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={4}
        />
      </div>

      {/*
       * Desktop-only inline preview.
       * On mobile, isMobileDevice() causes handlePreview to call
       * downloadPdfMobile() and never set pdfBlobUrl, so this block
       * stays null on mobile — no iframe is ever mounted.
       */}
      {pdfBlobUrl && (
        <div className="preview-section">
          <div className="preview-header">
            <span><i className="fas fa-eye"></i> Quote Preview</span>
            <button
              className="btn-close-preview"
              onClick={() => { URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(null); }}
            >
              <i className="fas fa-times"></i> Close
            </button>
          </div>
          <iframe src={pdfBlobUrl} className="pdf-iframe" title="Quote Preview" />
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
            : <><i className="fas fa-envelope"></i> Send Quote</>}
        </button>
        <button
          className="btn-draft-action"
          onClick={handleSaveDraft}
          disabled={sending || previewing}
        >
          <i className="fas fa-save"></i> Save Draft
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

export default QuoteForm;
