import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../config/firebase';
import clientConfig from '../config/client';
import InvoiceRow from './InvoiceRow';
import './Dashboard.css';

function Dashboard({ user }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchInvoices();
  }, [user]);

  const fetchInvoices = async () => {
    setLoading(true);
    setError('');

    try {
      // Query invoices where customer.email matches logged in user
      // IMPORTANT: uses dot notation for nested field
      const q = query(
        collection(db, 'invoices'),
        where('customer.email', '==', user.email)
      );

      const snapshot = await getDocs(q);
      const invoiceList = [];

      snapshot.forEach((doc) => {
        invoiceList.push({ id: doc.id, ...doc.data() });
      });

      // Sort by date descending (newest first) in JavaScript
      invoiceList.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(a.date);
        const dateB = b.createdAt?.toDate?.() || new Date(b.date);
        return dateB - dateA;
      });

      setInvoices(invoiceList);
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setError('Could not load invoices. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      // onAuthStateChanged in App.jsx handles redirect automatically
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    if (filter === 'all') return true;
    return inv.status === filter;
  });

  const totalOwing = invoices
    .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled')
    .reduce((sum, inv) => sum + (inv.totals?.finalTotal || 0), 0);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount);
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
        {/* Summary Card */}
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

        {/* Invoice List */}
        <div className="invoices-section">
          <div className="invoices-header">
            <h2>Your Invoices</h2>
            <div className="filter-buttons">
              {['all', 'unpaid', 'paid', 'cancelled'].map(f => (
                <button
                  key={f}
                  className={`filter-btn ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Column Headers */}
          <div className="invoice-list-header">
            <span>Invoice #</span>
            <span>Date</span>
            <span>Amount</span>
            <span>Status</span>
            <span></span>
          </div>

          {/* States */}
          {loading && (
            <div className="loading-state">
              Loading your invoices...
            </div>
          )}

          {error && (
            <div className="error-state">{error}</div>
          )}

          {!loading && !error && filteredInvoices.length === 0 && (
            <div className="empty-state">
              <p>No {filter !== 'all' ? filter : ''} invoices found.</p>
            </div>
          )}

          {!loading && !error && (
            <div className="invoice-list">
              {filteredInvoices.map(invoice => (
                <InvoiceRow key={invoice.id} invoice={invoice} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="dashboard-footer">
          <p>{clientConfig.companyName} · {clientConfig.companyPhone} · {clientConfig.companyEmail}</p>
        </footer>
      </main>
    </div>
  );
}

export default Dashboard;