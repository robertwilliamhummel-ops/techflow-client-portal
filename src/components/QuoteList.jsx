import { useState, useMemo } from 'react';
import {
  collection, addDoc, doc, updateDoc, runTransaction, Timestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { useQuotes } from '../hooks/useQuotes';
import { formatDate, formatDateShort, todayISO } from '../utils/formatters';
import clientConfig from '../config/client';
import './QuoteList.css';

const STATUS_OPTIONS = ['draft', 'sent', 'accepted', 'declined', 'converted'];

const STATUS_LABELS = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  declined: 'Declined',
  converted: 'Converted to Invoice',
};

function QuoteList({ user, onCreateNew }) {
  const { quotes, loading, error, refreshQuotes, updateQuoteStatus, setQuotes } = useQuotes(user?.uid);

  const [filter, setFilter]         = useState('all');
  const [search, setSearch]         = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [sortBy, setSortBy]         = useState('date-desc');
  const [updatingId, setUpdatingId]     = useState(null);
  const [convertingId, setConvertingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [toast, setToast]           = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalQuotes    = quotes.length;
  const sentCount      = quotes.filter(q => q.status === 'sent').length;
  const acceptedCount  = quotes.filter(q => q.status === 'accepted').length;
  const convertedCount = quotes.filter(q => q.status === 'converted').length;

  // "Pending" = draft or sent (not yet accepted, declined, or converted)
  const pendingQuotes = quotes.filter(
    q => q.status === 'draft' || q.status === 'sent'
  );
  const pendingCount = pendingQuotes.length;
  const pendingValue = pendingQuotes.reduce(
    (s, q) => s + (q.totals?.finalTotal || 0), 0
  );

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount || 0);

  // ── Filters ───────────────────────────────────────────────────────────────
  const availableYears = useMemo(() => {
    const years = new Set(quotes.map(q => q.date?.slice(0, 4)).filter(Boolean));
    return Array.from(years).sort((a, b) => b - a);
  }, [quotes]);

  const filtered = useMemo(() => {
    let list = quotes.filter(q => {
      const matchesFilter = filter === 'all' || q.status === filter;
      const matchesYear   = yearFilter === 'all' || q.date?.startsWith(yearFilter);
      const matchesSearch = search === '' ||
        q.quoteNumber?.toLowerCase().includes(search.toLowerCase()) ||
        q.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
        q.customer?.company?.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesYear && matchesSearch;
    });

    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'date-asc':    return new Date(a.date) - new Date(b.date);
        case 'date-desc':   return new Date(b.date) - new Date(a.date);
        case 'amount-desc': return (b.totals?.finalTotal || 0) - (a.totals?.finalTotal || 0);
        case 'amount-asc':  return (a.totals?.finalTotal || 0) - (b.totals?.finalTotal || 0);
        case 'customer':    return (a.customer?.name || '').localeCompare(b.customer?.name || '');
        case 'status':      return (a.status || '').localeCompare(b.status || '');
        default:            return 0;
      }
    });

    return list;
  }, [quotes, filter, search, yearFilter, sortBy]);

  // ── Status helpers ────────────────────────────────────────────────────────
  const getStatusClass = (status) => {
    const map = {
      draft: 'badge-draft', sent: 'badge-sent', accepted: 'badge-accepted',
      declined: 'badge-declined', converted: 'badge-converted',
    };
    return map[status] || 'badge-draft';
  };

  const isExpired = (validUntil) => {
    if (!validUntil) return false;
    return new Date(validUntil) < new Date(todayISO());
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleStatusChange = async (quoteId, newStatus) => {
    setUpdatingId(quoteId);
    const result = await updateQuoteStatus(quoteId, newStatus);
    if (!result.success) showToast('Failed to update status. Please try again.', 'error');
    setUpdatingId(null);
  };

  const handleConvertToInvoice = async (quote) => {
    if (!confirm(
      `Convert Quote ${quote.quoteNumber} to an Invoice?\n\nThis will create a new invoice with the same services and mark this quote as Converted.`
    )) return;

    setConvertingId(quote.id);
    try {
      const counterRef = doc(db, 'counters', 'invoices');
      let invoiceNumber = '';

      await runTransaction(db, async (t) => {
        const counterDoc = await t.get(counterRef);
        const count = (counterDoc.exists() ? counterDoc.data().count : 0) + 1;
        t.set(counterRef, { count });
        const year   = new Date().getFullYear();
        const prefix = clientConfig.invoicePrefix || 'TFS';
        invoiceNumber = `${prefix}-${year}-${count.toString().padStart(4, '0')}`;
      });

      const invoiceRef = await addDoc(collection(db, 'invoices'), {
        userId:   quote.userId,
        customer: quote.customer,
        number:   invoiceNumber,
        date:     todayISO(),
        services: quote.services,
        totals:   quote.totals,
        status:   'unpaid',
        createdAt:           Timestamp.now(),
        convertedFromQuote:  quote.id,
      });

      await updateDoc(doc(db, 'quotes', quote.id), {
        status:            'converted',
        convertedToInvoice: invoiceRef.id,
        convertedAt:       Timestamp.now(),
        updatedAt:         Timestamp.now(),
      });

      setQuotes(prev =>
        prev.map(q =>
          q.id === quote.id
            ? { ...q, status: 'converted', convertedToInvoice: invoiceRef.id }
            : q
        )
      );

      showToast(`✓ Invoice ${invoiceNumber} created from quote ${quote.quoteNumber}`, 'success');
    } catch (err) {
      console.error('Conversion error:', err);
      showToast(`Conversion failed: ${err.message}`, 'error');
    } finally {
      setConvertingId(null);
    }
  };

  const handleDownloadPDF = async (quote) => {
    setDownloadingId(quote.id);
    try {
      const items = [];
      quote.services?.hourly?.forEach(s =>
        items.push({ description: s.description, quantity: s.hours, rate: s.rate, amount: s.total })
      );
      quote.services?.lineItems?.forEach(i =>
        items.push({ description: i.description, quantity: i.quantity, rate: i.price, amount: i.total })
      );

      const result = await httpsCallable(functions, 'previewQuotePDF')({
        items,
        customerName: quote.customer?.name || 'Client',
        quoteNumber:  quote.quoteNumber,
        quoteDate:    formatDate(quote.date),
        validUntil:   formatDate(quote.validUntil),
        subtotal:     quote.totals?.subtotal?.toFixed(2)   || '0.00',
        tax:          quote.totals?.taxAmount?.toFixed(2)  || '0.00',
        total:        quote.totals?.finalTotal?.toFixed(2) || '0.00',
        notes:        quote.notes || '',
      });

      if (!result.data.success || !result.data.pdfBase64) throw new Error('No PDF returned');

      const bytes = new Uint8Array(atob(result.data.pdfBase64).split('').map(c => c.charCodeAt(0)));
      const blob  = new Blob([bytes], { type: 'application/pdf' });
      const url   = URL.createObjectURL(blob);
      const link  = document.createElement('a');
      link.href     = url;
      link.download = `Quote-${quote.quoteNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast(`Download failed: ${err.message}`, 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="invoice-list-admin quote-list-admin">

      {toast && (
        <div
          className={`ql-toast ql-toast-${toast.type}`}
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
        >
          <i className={`fas ${toast.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
          {toast.message}
          <button onClick={() => setToast(null)}><i className="fas fa-times"></i></button>
        </div>
      )}

      {/* ── Stats cards — unchanged ──────────────────────────────────────── */}
      <div className="admin-stats">
        <div className="stat-card">
          <div className="stat-icon"><i className="fas fa-file-alt"></i></div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{totalQuotes}</div>
          <div className="stat-label">Total Quotes</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><i className="fas fa-paper-plane"></i></div>
          <div className="stat-value" style={{ color: '#3b82f6' }}>{sentCount}</div>
          <div className="stat-label">Sent / Pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><i className="fas fa-thumbs-up"></i></div>
          <div className="stat-value" style={{ color: '#48c78e' }}>{acceptedCount}</div>
          <div className="stat-label">Accepted</div>
        </div>
        <div className="stat-card highlight">
          <div className="stat-icon"><i className="fas fa-exchange-alt"></i></div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{formatCurrency(pendingValue)}</div>
          <div className="stat-label">Pending Value</div>
        </div>
      </div>

      {/*
       * ── Pending-quotes banner ────────────────────────────────────────────
       * Mirrors the `outstanding-banner` in InvoiceList.jsx exactly.
       * Shows whenever there are draft or sent quotes awaiting action.
       * "New Quote" button lives here — always visible without scrolling.
       */}
      {pendingCount > 0 && (
        <div className="outstanding-banner">
          <span>
            <i className="fas fa-clock"></i>
            <strong> Pending: </strong>
            {formatCurrency(pendingValue)} across {pendingCount} pending quote{pendingCount > 1 ? 's' : ''}
          </span>
          <button className="btn-new-invoice" onClick={onCreateNew}>
            <i className="fas fa-plus"></i> New Quote
          </button>
        </div>
      )}

      {/*
       * When there are NO pending quotes (all accepted/declined/converted),
       * still offer the "New Quote" button in a subtle empty-state banner
       * so the user can always create one without hunting for it.
       */}
      {pendingCount === 0 && !loading && (
        <div className="outstanding-banner outstanding-banner--neutral">
          <span>
            <i className="fas fa-check-circle"></i>
            {totalQuotes > 0
              ? ' All quotes resolved — nothing pending.'
              : ' No quotes yet.'}
          </span>
          <button className="btn-new-invoice" onClick={onCreateNew}>
            <i className="fas fa-plus"></i> New Quote
          </button>
        </div>
      )}

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="list-controls">
        <div className="filter-buttons">
          {['all', ...STATUS_OPTIONS].map(f => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : STATUS_LABELS[f]}
            </button>
          ))}
        </div>
        <div className="controls-right">
          <select
            className="sort-select"
            value={yearFilter}
            onChange={e => setYearFilter(e.target.value)}
          >
            <option value="all">All Years</option>
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            className="sort-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="date-desc">Date: Newest First</option>
            <option value="date-asc">Date: Oldest First</option>
            <option value="amount-desc">Amount: High to Low</option>
            <option value="amount-asc">Amount: Low to High</option>
            <option value="customer">Customer: A–Z</option>
            <option value="status">Status: A–Z</option>
          </select>
          <div className="search-wrap">
            <i className="fas fa-search search-icon"></i>
            <input
              className="search-input"
              placeholder="Search customer or quote #..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="invoices-table quotes-table">
        <div className="table-header quotes-table-header">
          <span>Quote #</span>
          <span>Customer</span>
          <span>Date</span>
          <span>Valid Until</span>
          <span>Amount</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {loading && (
          <div className="table-state">
            <i className="fas fa-spinner fa-spin"></i> Loading quotes...
          </div>
        )}

        {error && (
          <div className="table-state error">{error}</div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="table-state">
            No {filter !== 'all' ? STATUS_LABELS[filter] : ''} quotes found.
            {quotes.length === 0 && (
              <button className="btn-create-first" onClick={onCreateNew}>
                Create your first quote
              </button>
            )}
          </div>
        )}

        {!loading && !error && filtered.map((q) => (
          <div
            key={q.id}
            className={`table-row quotes-table-row ${q.status === 'converted' ? 'row-converted' : ''}`}
          >
            <div className="inv-number">{q.quoteNumber}</div>

            <div className="inv-customer">
              <div className="customer-name">{q.customer?.name || 'Unknown'}</div>
              {q.customer?.company && (
                <div className="customer-company">{q.customer.company}</div>
              )}
            </div>

            <div className="inv-date">{formatDateShort(q.date)}</div>

            <div className="inv-date">
              <span className={isExpired(q.validUntil) && q.status === 'sent' ? 'expired-date' : ''}>
                {formatDateShort(q.validUntil)}
                {isExpired(q.validUntil) && q.status === 'sent' && (
                  <span className="expired-badge"> Expired</span>
                )}
              </span>
            </div>

            <div className="inv-amount">{formatCurrency(q.totals?.finalTotal)}</div>

            <div className="inv-status">
              <span className={`badge ${getStatusClass(q.status)}`}>
                {STATUS_LABELS[q.status] || q.status}
              </span>
            </div>

            <div className="inv-actions quote-actions">
              {q.status !== 'converted' && (
                <select
                  className="status-select"
                  value={q.status || 'draft'}
                  onChange={e => handleStatusChange(q.id, e.target.value)}
                  disabled={updatingId === q.id}
                >
                  {STATUS_OPTIONS.filter(s => s !== 'converted').map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              )}

              <button
                className="btn-download-quote"
                onClick={() => handleDownloadPDF(q)}
                disabled={downloadingId === q.id}
                title="Download PDF"
              >
                {downloadingId === q.id
                  ? <i className="fas fa-spinner fa-spin"></i>
                  : <i className="fas fa-file-pdf"></i>}
              </button>

              {(q.status === 'accepted' || q.status === 'sent') && (
                <button
                  className="btn-convert"
                  onClick={() => handleConvertToInvoice(q)}
                  disabled={convertingId === q.id}
                  title="Convert to Invoice"
                >
                  {convertingId === q.id
                    ? <><i className="fas fa-spinner fa-spin"></i> Converting...</>
                    : <><i className="fas fa-file-invoice-dollar"></i> Convert</>}
                </button>
              )}

              {q.status === 'converted' && q.convertedToInvoice && (
                <span className="converted-label">
                  <i className="fas fa-check-circle"></i> Invoiced
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Footer — refresh + count only (New Quote moved to banner) ────── */}
      {!loading && (
        <div className="list-footer">
          <button className="btn-refresh" onClick={refreshQuotes}>
            <i className="fas fa-sync-alt"></i> Refresh
          </button>
          <span className="list-count">{filtered.length} of {quotes.length} quotes</span>
        </div>
      )}

    </div>
  );
}

export default QuoteList;
