import { useState, useRef } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { useInvoiceCounter } from '../hooks/useInvoiceCounter';
import { formatDate, todayISO } from '../utils/formatters';
import { validateCustomer, validateCustomerEmail, validateServices } from '../utils/validators';
import CustomerSection from './CustomerSection';
import ServiceCalculator from './ServiceCalculator';
import './InvoiceForm.css';

function InvoiceForm({ user }) {
  const { invoiceNumber, consumeNumber } = useInvoiceCounter(user?.uid);
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [customer, setCustomer] = useState({});
  const [toast, setToast] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const calcRef = useRef();

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Build items array for Firebase functions — matches invoice.js sendInvoiceEmail format
  const buildItems = (hourlyServices, lineItems) => {
    const items = [];
    hourlyServices?.forEach(s => items.push({
      description: s.description,
      quantity: s.hours,
      rate: s.rate,
      amount: s.total,
    }));
    lineItems?.forEach(i => items.push({
      description: i.description,
      quantity: i.quantity,
      rate: i.price,
      amount: i.total,
    }));
    return items;
  };

  // Preview invoice — calls previewInvoicePDF Firebase function
  const handlePreview = async () => {
    const customerErrors = validateCustomer(customer);
    if (customerErrors.length > 0) {
      showToast(customerErrors[0], 'error');
      return;
    }
    const serviceErrors = calcRef.current?.validate() || [];
    if (serviceErrors.length > 0) {
      showToast(serviceErrors[0], 'error');
      return;
    }

    setPreviewing(true);
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }

    try {
      const { hourlyServices, lineItems, totals } = calcRef.current.getData();
      const items = buildItems(hourlyServices, lineItems);

      const previewPDF = httpsCallable(functions, 'previewInvoicePDF');
      const result = await previewPDF({
        items,
        customerName: customer.name,
        invoiceNumber,
        invoiceDate: formatDate(invoiceDate),
        subtotal: totals.subtotal.toFixed(2),
        tax: totals.taxAmount.toFixed(2),
        total: totals.finalTotal.toFixed(2),
      });

      if (!result.data.success || !result.data.pdfBase64) throw new Error('No PDF data returned');

      const binaryString = atob(result.data.pdfBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      setPdfBlobUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error('Preview error:', err);
      showToast(`Preview failed: ${err.message}`, 'error');
    } finally {
      setPreviewing(false);
    }
  };

  // Send invoice — save to Firestore then call sendInvoiceEmail
  const handleSend = async () => {
    // Validate customer
    const customerErrors = validateCustomer(customer);
    if (customerErrors.length > 0) {
      showToast(customerErrors[0], 'error');
      return;
    }

    // Email is required to send
    const emailError = validateCustomerEmail(customer);
    if (emailError) {
      showToast(emailError, 'error');
      return;
    }

    // Validate services
    const serviceErrors = calcRef.current?.validate() || [];
    if (serviceErrors.length > 0) {
      showToast(serviceErrors[0], 'error');
      return;
    }

    setSending(true);
    try {
      const { hourlyServices, lineItems, totals } = calcRef.current.getData();

      // Atomically get the invoice number (increments counter)
      const confirmedNumber = await consumeNumber();

      // Build Firestore document — matches exact structure from firestore-manager.js
      const invoiceDoc = {
        userId: user.uid,
        customer,
        number: confirmedNumber,
        date: invoiceDate,
        services: { hourly: hourlyServices, lineItems },
        totals: {
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          finalTotal: totals.finalTotal,
        },
        status: 'unpaid',
        createdAt: Timestamp.now(),
      };

      await addDoc(collection(db, 'invoices'), invoiceDoc);

      // Send email via Firebase function — matches invoice.js sendInvoiceEmail()
      const items = buildItems(hourlyServices, lineItems);
      const sendEmail = httpsCallable(functions, 'sendInvoiceEmail');
      await sendEmail({
        customerEmail: customer.email,
        customerName: customer.name,
        invoiceNumber: confirmedNumber,
        invoiceDate: formatDate(invoiceDate),
        items,
        subtotal: totals.subtotal.toFixed(2),
        tax: totals.taxAmount.toFixed(2),
        total: totals.finalTotal.toFixed(2),
        amount: totals.finalTotal,
      });

      showToast(`Invoice ${confirmedNumber} sent successfully! Next number ready.`, 'success');

      // NOTE: Form is NOT auto-cleared — matches original invoice.js behaviour
      // Admin can review what was sent, then manually click Clear

    } catch (err) {
      console.error('Send error:', err);
      showToast(`Error sending invoice: ${err.message}`, 'error');
    } finally {
      setSending(false);
    }
  };

  // Clear form — confirm dialog matches invoice.js clearForm()
  const handleClear = () => {
    if (!confirm('Are you sure you want to clear the form? All unsaved data will be lost.')) return;
    setCustomer({});
    setInvoiceDate(todayISO());
    calcRef.current?.reset();
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
    showToast('Form cleared', 'info');
  };

  return (
    <div className="invoice-form">

      {/* Toast */}
      {toast && (
        <div className={`inv-toast inv-toast-${toast.type}`}>
          <i className={`fas ${toast.type === 'success' ? 'fa-check-circle' : toast.type === 'info' ? 'fa-info-circle' : 'fa-exclamation-circle'}`}></i>
          {toast.message}
          <button className="toast-close" onClick={() => setToast(null)}>
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {/* Invoice header row */}
      <div className="invoice-meta">
        <div className="meta-field">
          <label>Invoice Number</label>
          <div className="invoice-number-display">{invoiceNumber || 'Loading...'}</div>
        </div>
        <div className="meta-field">
          <label>Invoice Date</label>
          <input
            type="date"
            className="form-control"
            value={invoiceDate}
            onChange={e => setInvoiceDate(e.target.value)}
          />
        </div>
      </div>

      {/* Customer Section */}
      <CustomerSection user={user} onCustomerChange={setCustomer} />

      {/* Service Calculator */}
      <ServiceCalculator ref={calcRef} />

      {/* PDF Preview */}
      {pdfBlobUrl && (
        <div className="preview-section">
          <div className="preview-header">
            <h3><i className="fas fa-eye"></i> Invoice Preview</h3>
            <button
              className="btn-close-preview"
              onClick={() => { URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(null); }}
            >
              <i className="fas fa-times"></i> Close
            </button>
          </div>
          <iframe
            src={pdfBlobUrl}
            className="pdf-iframe"
            title="Invoice Preview"
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="invoice-actions">
        <button className="btn-preview" onClick={handlePreview} disabled={previewing || sending}>
          {previewing
            ? <><i className="fas fa-spinner fa-spin"></i> Generating...</>
            : <><i className="fas fa-eye"></i> Preview PDF</>
          }
        </button>

        <button className="btn-send" onClick={handleSend} disabled={sending || previewing}>
          {sending
            ? <><i className="fas fa-spinner fa-spin"></i> Sending...</>
            : <><i className="fas fa-paper-plane"></i> Send Invoice</>
          }
        </button>

        <button className="btn-clear" onClick={handleClear} disabled={sending || previewing}>
          <i className="fas fa-trash-alt"></i> Clear Form
        </button>
      </div>

    </div>
  );
}

export default InvoiceForm;
