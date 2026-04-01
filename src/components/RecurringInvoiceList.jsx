import { useState, useEffect } from 'react';
import {
  collection, query, where, getDocs, doc, updateDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { formatCurrency } from '../utils/formatters';
import './RecurringInvoiceList.css';

/**
 * RecurringInvoiceList — admin tab for the `recurringInvoices` Firestore collection.
 * Allows admins to view, pause/resume, and delete recurring invoice templates.
 */
function RecurringInvoiceList({ user }) {
  const [records, setRecords]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    fetchRecurring();
  }, [user]);

  const fetchRecurring = async () => {
    setLoading(true);
    setError('');
    try {
      const q = query(
        collection(db, 'recurringInvoices'),
        where('userId', '==', user.uid)
      );
      const snap = await getDocs(q);
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));

      // Sort newest first
      list.sort((a, b) => {
        const ta = a.createdAt?.toDate?.() || 0;
        const tb = b.createdAt?.toDate?.() || 0;
        return tb - ta;
      });

      setRecords(list);
    } catch (err) {
      console.error('Error fetching recurring invoices:', err);
      setError('Could not load recurring invoices. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (record) => {
    setUpdatingId(record.id);
    try {
      await updateDoc(doc(db, 'recurringInvoices', record.id), {
        active: !record.active,
      });
      setRecords(prev =>
        prev.map(r => r.id === record.id ? { ...r, active: !r.active } : r)
      );
    } catch (err) {
      console.error('Toggle failed:', err);
      alert('Failed to update. Please try again.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (record) => {
    if (!confirm(`Delete recurring invoice for "${record.customer?.name}"? This will not affect already-created invoices.`)) return;
    setUpdatingId(record.id);
    try {
      await deleteDoc(doc(db, 'recurringInvoices', record.id));
      setRecords(prev => prev.filter(r => r.id !== record.id));
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete. Please try again.');
    } finally {
      setUpdatingId(null);
    }
  };

  const formatLastRun = (lastRun) => {
    if (!lastRun) return 'Never';
    const date = lastRun.toDate ? lastRun.toDate() : new Date(lastRun);
    return date.toLocaleDateString('en-CA', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const activeCount  = records.filter(r => r.active).length;
  const pausedCount  = records.filter(r => !r.active).length;

  if (loading) {
    return (
      <div className="ril-state">
        <i className="fas fa-spinner fa-spin"></i> Loading recurring invoices...
      </div>
    );
  }

  if (error) {
    return (
      <div className="ril-state ril-error">
        <i className="fas fa-exclamation-triangle"></i> {error}
        <button className="ril-refresh-btn" onClick={fetchRecurring}>Retry</button>
      </div>
    );
  }

  return (
    <div className="ril-container">

      {/* Stats */}
      <div className="ril-stats">
        <div className="ril-stat">
          <div className="ril-stat-value">{records.length}</div>
          <div className="ril-stat-label">Total Recurring</div>
        </div>
        <div className="ril-stat">
          <div className="ril-stat-value ril-green">{activeCount}</div>
          <div className="ril-stat-label">Active</div>
        </div>
        <div className="ril-stat">
          <div className="ril-stat-value ril-muted">{pausedCount}</div>
          <div className="ril-stat-label">Paused</div>
        </div>
      </div>

      {/* Info banner */}
      <div className="ril-info-banner">
        <i className="fas fa-info-circle"></i>
        <span>
          Recurring invoices are automatically generated monthly by the backend scheduler.
          You can pause or delete a recurring template at any time.
        </span>
      </div>

      {records.length === 0 ? (
        <div className="ril-empty">
          <i className="fas fa-sync-alt ril-empty-icon"></i>
          <p>No recurring invoices set up yet.</p>
          <p className="ril-empty-hint">
            When creating an invoice, check "Make this recurring" to create a template here.
          </p>
        </div>
      ) : (
        <div className="ril-table">
          {/* Table header */}
          <div className="ril-thead">
            <span>Customer</span>
            <span>Frequency</span>
            <span>Total / Invoice</span>
            <span>Start Date</span>
            <span>Last Run</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          {records.map(r => (
            <div key={r.id} className={`ril-row ${r.active ? '' : 'ril-row-paused'}`}>
              <div className="ril-col ril-customer">
                <div className="ril-customer-name">{r.customer?.name || '—'}</div>
                {r.customer?.company && (
                  <div className="ril-customer-company">{r.customer.company}</div>
                )}
              </div>
              <div className="ril-col ril-freq">
                <i className="fas fa-redo"></i>
                {r.frequency || 'monthly'}
              </div>
              <div className="ril-col ril-amount">
                {formatCurrency(r.template?.totals?.finalTotal)}
              </div>
              <div className="ril-col ril-date">
                {r.startDate || '—'}
              </div>
              <div className="ril-col ril-lastrun">
                {formatLastRun(r.lastRun)}
              </div>
              <div className="ril-col">
                <span className={`ril-badge ${r.active ? 'ril-badge-active' : 'ril-badge-paused'}`}>
                  {r.active ? 'Active' : 'Paused'}
                </span>
              </div>
              <div className="ril-col ril-actions">
                <button
                  className={`ril-btn ${r.active ? 'ril-btn-pause' : 'ril-btn-resume'}`}
                  onClick={() => toggleActive(r)}
                  disabled={updatingId === r.id}
                  title={r.active ? 'Pause this recurring invoice' : 'Resume this recurring invoice'}
                >
                  {updatingId === r.id
                    ? <i className="fas fa-spinner fa-spin"></i>
                    : r.active
                      ? <><i className="fas fa-pause"></i> Pause</>
                      : <><i className="fas fa-play"></i> Resume</>
                  }
                </button>
                <button
                  className="ril-btn ril-btn-delete"
                  onClick={() => handleDelete(r)}
                  disabled={updatingId === r.id}
                  title="Delete recurring template"
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="ril-footer">
        <button className="ril-refresh-btn" onClick={fetchRecurring}>
          <i className="fas fa-sync-alt"></i> Refresh
        </button>
      </div>
    </div>
  );
}

export default RecurringInvoiceList;
