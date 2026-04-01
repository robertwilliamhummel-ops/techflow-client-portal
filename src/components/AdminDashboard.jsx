import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import clientConfig from '../config/client';
import InvoiceList from './InvoiceList';
import InvoiceForm from './InvoiceForm';
import QuoteList from './QuoteList';
import QuoteForm from './QuoteForm';
import RecurringInvoiceList from './RecurringInvoiceList';
import MobileTabs from './MobileTabs';
import FloatingActionButton from './FloatingActionButton';
import './AdminDashboard.css';

/*
 * AdminDashboard — responsive navigation strategy (unchanged from original)
 *
 * NEW: "recurring" tab added to show RecurringInvoiceList.
 */
function AdminDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('invoices');
  const [stats, setStats]         = useState(null);

  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 767px)').matches
  );

  useEffect(() => {
    const mq      = window.matchMedia('(max-width: 767px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    fetchStats();
  }, [user]);

  const fetchStats = async () => {
    try {
      const [invSnap, quoteSnap] = await Promise.all([
        getDocs(query(collection(db, 'invoices'),   where('userId', '==', user.uid))),
        getDocs(query(collection(db, 'quotes'),     where('userId', '==', user.uid))),
      ]);

      let totalRevenue = 0;
      let outstanding  = 0;
      invSnap.forEach(d => {
        const inv = d.data();
        if (inv.status === 'paid')   totalRevenue += inv.totals?.finalTotal || 0;
        if (inv.status === 'unpaid') outstanding  += inv.totals?.finalTotal || 0;
      });

      let pendingQuotes = 0;
      quoteSnap.forEach(d => {
        const q = d.data();
        if (q.status === 'sent' || q.status === 'draft') pendingQuotes++;
      });

      setStats({
        invoices:      invSnap.size,
        revenue:       totalRevenue,
        outstanding,
        quotes:        quoteSnap.size,
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

  const handleFabAction = () => {
    if (activeTab === 'invoices') setActiveTab('create-invoice');
    if (activeTab === 'quotes')   setActiveTab('create-quote');
  };

  const handleTabChange = (tab) => setActiveTab(tab);

  return (
    <div className="admin-dashboard">

      {/* ── Header ── */}
      <header className="admin-header">
        <div className="admin-header-top">
          <div className="header-left">
            <img
              src={clientConfig.logoUrl}
              alt={clientConfig.companyName}
              className="header-logo"
            />
            <div>
              <h1>{clientConfig.companyName}</h1>
              <p className="admin-badge">
                <i className="fas fa-shield-alt"></i> Admin Portal
              </p>
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

        {/* Desktop nav — hidden on mobile via CSS */}
        <nav className="admin-tabs admin-tabs--desktop-only">
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
          {/* NEW: Recurring Invoices tab */}
          <button
            className={`admin-tab ${activeTab === 'recurring' ? 'active' : ''}`}
            onClick={() => setActiveTab('recurring')}
          >
            <i className="fas fa-sync-alt"></i> Recurring
          </button>
        </nav>
      </header>

      {/* ── Main content ── */}
      <main className="admin-main">

        {isMobile && (
          <MobileTabs activeTab={activeTab} onTabChange={handleTabChange} />
        )}

        {activeTab === 'invoices' && (
          <InvoiceList user={user} onCreateNew={() => setActiveTab('create-invoice')} />
        )}

        {activeTab === 'create-invoice' && (
          <InvoiceForm
            user={user}
            onInvoiceSent={() => {
              fetchStats();
              setActiveTab('invoices');
            }}
          />
        )}

        {activeTab === 'quotes' && (
          <QuoteList user={user} onCreateNew={() => setActiveTab('create-quote')} />
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

        {/* NEW: Recurring invoices panel */}
        {activeTab === 'recurring' && (
          <RecurringInvoiceList user={user} />
        )}

      </main>

      {isMobile && (
        <FloatingActionButton activeTab={activeTab} onAction={handleFabAction} />
      )}

    </div>
  );
}

export default AdminDashboard;
