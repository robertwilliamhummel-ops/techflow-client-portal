import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import clientConfig from '../config/client';
import InvoiceList from './InvoiceList';
import InvoiceForm from './InvoiceForm';
import QuoteList from './QuoteList';
import QuoteForm from './QuoteForm';
import './AdminDashboard.css';

function AdminDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('invoices');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchStats();
  }, [user]);

  // Lightweight summary fetch for the header stats bar
  const fetchStats = async () => {
    try {
      const [invSnap, quoteSnap] = await Promise.all([
        getDocs(query(collection(db, 'invoices'), where('userId', '==', user.uid))),
        getDocs(query(collection(db, 'quotes'),   where('userId', '==', user.uid))),
      ]);

      let totalRevenue = 0;
      let outstanding = 0;
      invSnap.forEach(d => {
        const inv = d.data();
        if (inv.status === 'paid') totalRevenue += inv.totals?.finalTotal || 0;
        if (inv.status === 'unpaid') outstanding += inv.totals?.finalTotal || 0;
      });

      let pendingQuotes = 0;
      quoteSnap.forEach(d => {
        const q = d.data();
        if (q.status === 'sent' || q.status === 'draft') pendingQuotes++;
      });

      setStats({
        invoices: invSnap.size,
        revenue: totalRevenue,
        outstanding,
        quotes: quoteSnap.size,
        pendingQuotes,
      });
    } catch (err) {
      console.error('Stats fetch error:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount || 0);

  return (
    <div className="admin-dashboard">

      {/* Header */}
      <header className="admin-header">
        <div className="admin-header-top">
          <div className="header-left">
            <img src={clientConfig.logoUrl} alt={clientConfig.companyName} className="header-logo" />
            <div>
              <h1>{clientConfig.companyName}</h1>
              <p className="admin-badge"><i className="fas fa-shield-alt"></i> Admin Portal</p>
            </div>
          </div>
          <div className="header-right">
            <span className="user-email">
              <i className="fas fa-user-circle"></i> {user.email}
            </span>
            <button className="signout-btn" onClick={handleSignOut}>
              <i className="fas fa-sign-out-alt"></i> Sign Out
            </button>
          </div>
        </div>

        {/* Summary Stats Bar */}
        {stats && (
          <div className="admin-stats-bar">
            <div className="stats-bar-item">
              <span className="stats-bar-label">Invoices</span>
              <span className="stats-bar-value">{stats.invoices}</span>
            </div>
            <div className="stats-bar-divider"></div>
            <div className="stats-bar-item">
              <span className="stats-bar-label">Revenue</span>
              <span className="stats-bar-value stats-bar-green">{formatCurrency(stats.revenue)}</span>
            </div>
            <div className="stats-bar-divider"></div>
            <div className="stats-bar-item">
              <span className="stats-bar-label">Outstanding</span>
              <span className="stats-bar-value stats-bar-red">{formatCurrency(stats.outstanding)}</span>
            </div>
            <div className="stats-bar-divider"></div>
            <div className="stats-bar-item">
              <span className="stats-bar-label">Quotes</span>
              <span className="stats-bar-value">{stats.quotes}</span>
            </div>
            <div className="stats-bar-divider"></div>
            <div className="stats-bar-item">
              <span className="stats-bar-label">Pending Quotes</span>
              <span className="stats-bar-value stats-bar-blue">{stats.pendingQuotes}</span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <nav className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === 'invoices' ? 'active' : ''}`}
            onClick={() => setActiveTab('invoices')}
          >
            <i className="fas fa-list"></i> All Invoices
          </button>
          <button
            className={`admin-tab ${activeTab === 'create-invoice' ? 'active' : ''}`}
            onClick={() => setActiveTab('create-invoice')}
          >
            <i className="fas fa-file-invoice"></i> Create Invoice
          </button>
          <button
            className={`admin-tab ${activeTab === 'quotes' ? 'active' : ''}`}
            onClick={() => setActiveTab('quotes')}
          >
            <i className="fas fa-file-alt"></i> All Quotes
          </button>
          <button
            className={`admin-tab ${activeTab === 'create-quote' ? 'active' : ''}`}
            onClick={() => setActiveTab('create-quote')}
          >
            <i className="fas fa-plus-circle"></i> Create Quote
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="admin-main">
        {activeTab === 'invoices' && (
          <InvoiceList user={user} onCreateNew={() => setActiveTab('create-invoice')} />
        )}

        {activeTab === 'create-invoice' && (
          <InvoiceForm user={user} />
        )}

        {activeTab === 'quotes' && (
          <QuoteList
            user={user}
            onCreateNew={() => setActiveTab('create-quote')}
          />
        )}

        {activeTab === 'create-quote' && (
          <QuoteForm
            user={user}
            onQuoteSent={() => {
              fetchStats();
              setActiveTab('quotes');
            }}
          />
        )}
      </main>

    </div>
  );
}

export default AdminDashboard;
