import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../config/firebase';
import clientConfig from '../config/client';
import InvoiceRow from './InvoiceRow';
import './Dashboard.css';

function Dashboard({ user }) {
  const [activeTab, setActiveTab] = useState('invoices');

  // Invoices
  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesError, setInvoicesError] = useState('');
  const [invoiceFilter, setInvoiceFilter] = useState('all');

  // Quotes
  const [quotes, setQuotes] = useState([]);
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [quotesError, setQuotesError] = useState('');

  useEffect(() => {
    fetchInvoices();
    fetchQuotes();
  }, [user]);

  const fetchInvoices = async () => {
    setInvoicesLoading(true);
    setInvoicesError('');
    try {
      const q = query(
        collection(db, 'invoices'),
        where('customer.email', '==', user.email)
      );
      const snapshot = await getDocs(q);
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      list.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(a.date);
        const dateB = b.createdAt?.toDate?.() || new Date(b.date);
        return dateB - dateA;
      });
      setInvoices(list);
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setInvoicesError('Could not load invoices. Please refresh the page.');
    } finally {
      setInvoicesLoading(false);
    }
  };

  const fetchQuotes = async () => {
    setQuotesLoading(true);
    setQuotesError('');
    try {
      const q = query(
        collection(db, 'quotes'),
        where('customer.email', '==', user.email)
      );
      const snapshot = await getDocs(q);
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      list.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(a.date);
        const dateB = b.createdAt?.toDate?.() || new Date(b.date);
        return dateB - dateA;
      });
      setQuotes(list);
    } catch (err) {
      console.error('Error fetching quotes:', err);
      setQuotesError('Could not load quotes. Please refresh the page.');
    } finally {
      setQuotesLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    if (invoiceFilter === 'all') return true;
    return inv.status === invoiceFilter;
  });

  const totalOwing = invoices
    .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled')
    .reduce((sum, inv) => sum + (inv.totals?.finalTotal || 0), 0);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString + 'T12:00:00').toLocaleDateString('en-CA', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  const isExpired = (validUntil) =>
    validUntil && new Date(validUntil) < new Date(new Date().toISOString().split('T')[0]);

  const getQuoteStatusLabel = (status) => {
    const map = {
      draft: 'Draft',
      sent: 'Sent',
      accepted: 'Accepted',
      declined: 'Declined',
      converted: 'Converted to Invoice',
    };
    return map[status] || status;
  };

  const getQuoteStatusClass = (status) => {
    const map = {
      draft: 'status-unpaid',
      sent: 'status-sent',
      accepted: 'status-paid',
      declined: 'status-cancelled',
      converted: 'status-converted',
    };
    return map[status] || 'status-unpaid';
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <img src={clientConfig.logoUrl} alt={clientConfig.companyName} className="header-logo" />
          <div>
            <h1>{clientConfig.companyName}</h1>
            <p>Client Portal</p>
          </div>
        </div>
        <div className="header-right">
          <span className="user-email">{user.email}</span>
          <button className="signout-btn" onClick={handleSignOut}>Sign Out</button>
        </div>
      </header>

      <main className="dashboard-main">

        {/* Summary Cards */}
        <div className="summary-cards">
          <div className="summary-card">
            <div className="summary-number">{invoices.length}</div>
            <div className="summary-label">Total Invoices</div>
          </div>
          <div className="summary-card">
            <div className="summary-number">
              {invoices.filter(i => i.status === 'paid').length}
            </div>
            <div className="summary-label">Paid</div>
          </div>
          <div className="summary-card">
            <div className="summary-number">
              {invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').length}
            </div>
            <div className="summary-label">Outstanding</div>
          </div>
          <div className="summary-card highlight">
            <div className="summary-number">{formatCurrency(totalOwing)}</div>
            <div className="summary-label">Total Owing</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="client-tabs">
          <button
            className={`client-tab ${activeTab === 'invoices' ? 'active' : ''}`}
            onClick={() => setActiveTab('invoices')}
          >
            <i className="fas fa-file-invoice-dollar"></i> My Invoices
            <span className="tab-count">{invoices.length}</span>
          </button>
          <button
            className={`client-tab ${activeTab === 'quotes' ? 'active' : ''}`}
            onClick={() => setActiveTab('quotes')}
          >
            <i className="fas fa-file-alt"></i> My Quotes
            <span className="tab-count">{quotes.length}</span>
          </button>
        </div>

        {/* ── INVOICES TAB ── */}
        {activeTab === 'invoices' && (
          <div className="invoices-section">
            <div className="invoices-header">
              <h2>Your Invoices</h2>
              <div className="filter-buttons">
                {['all', 'unpaid', 'paid', 'cancelled'].map(f => (
                  <button
                    key={f}
                    className={`filter-btn ${invoiceFilter === f ? 'active' : ''}`}
                    onClick={() => setInvoiceFilter(f)}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="invoice-list-header">
              <span>Invoice #</span>
              <span>Date</span>
              <span>Amount</span>
              <span>Status</span>
              <span></span>
            </div>

            {invoicesLoading && <div className="loading-state">Loading your invoices...</div>}
            {invoicesError && <div className="error-state">{invoicesError}</div>}
            {!invoicesLoading && !invoicesError && filteredInvoices.length === 0 && (
              <div className="empty-state">
                <p>No {invoiceFilter !== 'all' ? invoiceFilter : ''} invoices found.</p>
              </div>
            )}
            {!invoicesLoading && !invoicesError && (
              <div className="invoice-list">
                {filteredInvoices.map(invoice => (
                  <InvoiceRow key={invoice.id} invoice={invoice} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── QUOTES TAB ── */}
        {activeTab === 'quotes' && (
          <div className="invoices-section">
            <div className="invoices-header">
              <h2>Your Quotes</h2>
            </div>

            {quotesLoading && <div className="loading-state">Loading your quotes...</div>}
            {quotesError && <div className="error-state">{quotesError}</div>}

            {!quotesLoading && !quotesError && quotes.length === 0 && (
              <div className="empty-state">
                <p>No quotes on file yet.</p>
              </div>
            )}

            {!quotesLoading && !quotesError && quotes.length > 0 && (
              <div className="quotes-client-list">
                {quotes.map(q => (
                  <div key={q.id} className="quote-client-row">
                    <div className="quote-client-main">
                      <div className="quote-num-col">
                        <span className="qcr-label">Quote #</span>
                        <span className="qcr-value">{q.quoteNumber}</span>
                      </div>
                      <div className="quote-date-col">
                        <span className="qcr-label">Date</span>
                        <span className="qcr-value">{formatDate(q.date)}</span>
                      </div>
                      <div className="quote-valid-col">
                        <span className="qcr-label">Valid Until</span>
                        <span className={`qcr-value ${isExpired(q.validUntil) && q.status === 'sent' ? 'qcr-expired' : ''}`}>
                          {formatDate(q.validUntil)}
                          {isExpired(q.validUntil) && q.status === 'sent' && ' (Expired)'}
                        </span>
                      </div>
                      <div className="quote-amount-col">
                        <span className="qcr-label">Estimated Total</span>
                        <span className="qcr-value">{formatCurrency(q.totals?.finalTotal)}</span>
                      </div>
                      <div className="quote-status-col">
                        <span className={`invoice-status ${getQuoteStatusClass(q.status)}`}>
                          {getQuoteStatusLabel(q.status)}
                        </span>
                      </div>
                    </div>
                    {q.notes && (
                      <div className="quote-client-notes">
                        <i className="fas fa-sticky-note"></i> {q.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <footer className="dashboard-footer">
          <p>{clientConfig.companyName} · {clientConfig.companyPhone} · {clientConfig.companyEmail}</p>
        </footer>
      </main>
    </div>
  );
}

export default Dashboard;
