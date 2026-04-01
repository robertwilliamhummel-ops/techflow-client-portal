import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../config/firebase';
import './InvoiceList.css';

function InvoiceList({ user, onCreateNew }) {
  const navigate = useNavigate();

  const [invoices, setInvoices]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [filter, setFilter]       = useState('all');
  const [search, setSearch]       = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [sortBy, setSortBy]       = useState('date-desc');
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    fetchInvoices();
  }, [user]);

  const fetchInvoices = async () => {
    setLoading(true);
    setError('');
    try {
      const q = query(
        collection(db, 'invoices'),
        where('userId', '==', user.uid)
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
      setError('Could not load invoices. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (invoiceId, newStatus) => {
    setUpdatingId(invoiceId);
    try {
      await updateDoc(doc(db, 'invoices', invoiceId), { status: newStatus });
      setInvoices(prev =>
        prev.map(inv => inv.id === invoiceId ? { ...inv, status: newStatus } : inv)
      );
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status. Please try again.');
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-CA', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount || 0);

  const availableYears = useMemo(() => {
    const years = new Set(invoices.map(inv => inv.date?.slice(0, 4)).filter(Boolean));
    return Array.from(years).sort((a, b) => b - a);
  }, [invoices]);

  const filtered = useMemo(() => {
    let list = invoices.filter(inv => {
      const matchesFilter = filter === 'all' || inv.status === filter;
      const matchesYear   = yearFilter === 'all' || inv.date?.startsWith(yearFilter);
      const matchesSearch = search === '' ||
        inv.number?.toLowerCase().includes(search.toLowerCase()) ||
        inv.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
        inv.customer?.company?.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesYear && matchesSearch;
    });

    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'date-asc':     return new Date(a.date) - new Date(b.date);
        case 'date-desc':    return new Date(b.date) - new Date(a.date);
        case 'amount-desc':  return (b.totals?.finalTotal || 0) - (a.totals?.finalTotal || 0);
        case 'amount-asc':   return (a.totals?.finalTotal || 0) - (b.totals?.finalTotal || 0);
        case 'customer':     return (a.customer?.name || '').localeCompare(b.customer?.name || '');
        case 'status':       return (a.status || '').localeCompare(b.status || '');
        default:             return 0;
      }
    });
    return list;
  }, [invoices, filter, search, yearFilter, sortBy]);

  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.totals?.finalTotal || 0), 0);
  const outstanding  = invoices.filter(i => i.status === 'unpaid').reduce((s, i) => s + (i.totals?.finalTotal || 0), 0);
  const paidCount    = invoices.filter(i => i.status === 'paid').length;
  const unpaidCount  = invoices.filter(i => i.status === 'unpaid').length;

  const getStatusClass = (status) => {
    if (status === 'paid')      return 'badge-paid';
    if (status === 'cancelled') return 'badge-cancelled';
    return 'badge-unpaid';
  };

  return (
    <div className="invoice-list-admin">

      {/* Stats Cards */}
      <div className="admin-stats">
        <div className="stat-card">
          <div className="stat-icon"><i className="fas fa-file-invoice"></i></div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{invoices.length}</div>
          <div className="stat-label">Total Invoices</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><i className="fas fa-check-circle"></i></div>
          <div className="stat-value" style={{ color: '#48c78e' }}>{paidCount}</div>
          <div className="stat-label">Paid</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><i className="fas fa-clock"></i></div>
          <div className="stat-value" style={{ color: '#f14668' }}>{unpaidCount}</div>
          <div className="stat-label">Outstanding</div>
        </div>
        <div className="stat-card highlight">
          <div className="stat-icon"><i className="fas fa-dollar-sign"></i></div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{formatCurrency(totalRevenue)}</div>
          <div className="stat-label">Revenue Collected</div>
        </div>
      </div>

      {/* Outstanding Banner */}
      {unpaidCount > 0 && (
        <div className="outstanding-banner">
          <span>
            <i className="fas fa-exclamation-circle"></i>
            <strong> Outstanding: </strong>{formatCurrency(outstanding)} across {unpaidCount} unpaid invoice{unpaidCount > 1 ? 's' : ''}
          </span>
          <button className="btn-new-invoice" onClick={onCreateNew}>
            <i className="fas fa-plus"></i> New Invoice
          </button>
        </div>
      )}

      {/* Filters + Sort + Search */}
      <div className="list-controls">
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
        <div className="controls-right">
          <select className="sort-select" value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
            <option value="all">All Years</option>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
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
              placeholder="Search customer or invoice #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="invoices-table">
        <div className="table-header">
          <span>Invoice #</span>
          <span>Customer</span>
          <span>Date</span>
          <span>Amount</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {loading && (
          <div className="table-state">
            <i className="fas fa-spinner fa-spin"></i> Loading invoices...
          </div>
        )}

        {error && <div className="table-state error">{error}</div>}

        {!loading && !error && filtered.length === 0 && (
          <div className="table-state">
            No {filter !== 'all' ? filter : ''} invoices found.
            {invoices.length === 0 && (
              <button className="btn-create-first" onClick={onCreateNew}>
                Create your first invoice
              </button>
            )}
          </div>
        )}

        {!loading && !error && filtered.map((inv) => (
          <div key={inv.id} className="table-row">
            {/*
             * Invoice number is now a clickable button that navigates to /invoice/:id
             * for a full preview + reprint page.
             */}
            <div className="inv-number">
              <button
                className="inv-number-link"
                onClick={() => navigate(`/invoice/${inv.id}`)}
                title="View invoice preview"
              >
                {inv.number}
              </button>
            </div>
            <div className="inv-customer">
              <div className="customer-name">{inv.customer?.name || 'Unknown'}</div>
              {inv.customer?.company && (
                <div className="customer-company">{inv.customer.company}</div>
              )}
            </div>
            <div className="inv-date">{formatDate(inv.date)}</div>
            <div className="inv-amount">{formatCurrency(inv.totals?.finalTotal)}</div>
            <div className="inv-status">
              <span className={`badge ${getStatusClass(inv.status)}`}>
                {inv.status || 'unpaid'}
              </span>
            </div>
            <div className="inv-actions">
              <select
                className="status-select"
                value={inv.status || 'unpaid'}
                onChange={(e) => updateStatus(inv.id, e.target.value)}
                disabled={updatingId === inv.id}
              >
                <option value="unpaid">Mark Unpaid</option>
                <option value="paid">Mark Paid</option>
                <option value="cancelled">Mark Cancelled</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {!loading && (
        <div className="list-footer">
          <button className="btn-refresh" onClick={fetchInvoices}>
            <i className="fas fa-sync-alt"></i> Refresh
          </button>
          <span className="list-count">{filtered.length} of {invoices.length} invoices</span>
        </div>
      )}

    </div>
  );
}

export default InvoiceList;
