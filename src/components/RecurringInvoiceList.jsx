import { useState, useEffect } from 'react';
import {
  collection, query, where, getDocs, doc, updateDoc, deleteDoc,
  orderBy, limit, Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { formatCurrency } from '../utils/formatters';
import './RecurringInvoiceList.css';

/**
 * RecurringInvoiceList — admin tab for the `recurringInvoices` collection.
 *
 * Features:
 *   - Monthly / quarterly / yearly frequency support
 *   - Pause resets clock on resume (fresh billing period from today)
 *   - Latest Invoice column — most recent invoice linked to this template
 *   - Started column    — when the recurring template began
 *   - Next Invoice column — calculated next fire date
 */

// ── Date helpers ──────────────────────────────────────────────────────────────

function getNextRunDate(lastRun, startDate, frequency) {
  if (!lastRun) {
    return startDate ? new Date(startDate + 'T00:00:00') : null;
  }
  const base = lastRun.toDate ? lastRun.toDate() : new Date(lastRun);
  const next = new Date(base);
  if (frequency === 'monthly')   next.setMonth(next.getMonth() + 1);
  if (frequency === 'quarterly') next.setMonth(next.getMonth() + 3);
  if (frequency === 'yearly')    next.setFullYear(next.getFullYear() + 1);
  return next;
}

function formatShortDate(date) {
  if (!date) return '—';
  const d = date.toDate ? date.toDate() : (date instanceof Date ? date : new Date(date));
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatStartDate(startDate) {
  if (!startDate) return '—';
  const d = new Date(startDate + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Component ─────────────────────────────────────────────────────────────────

function RecurringInvoiceList({ user }) {
  const [records, setRecords]               = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState('');
  const [updatingId, setUpdatingId]         = useState(null);
  const [latestInvoices, setLatestInvoices] = useState({});

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
      list.sort((a, b) => {
        const ta = a.createdAt?.toDate?.() || 0;
        const tb = b.createdAt?.toDate?.() || 0;
        return tb - ta;
      });
      setRecords(list);
      await fetchLatestInvoices(list);
    } catch (err) {
      console.error('Error fetching recurring invoices:', err);
      setError('Could not load recurring invoices. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  // ── Query most recent invoice linked to each recurring template ─────────────
  const fetchLatestInvoices = async (list) => {
    if (!list.length) return;
    const results = {};

    await Promise.all(
      list.map(async (record) => {
        try {
          // Scheduler-created invoices have a recurringId field
          const q = query(
            collection(db, 'invoices'),
            where('recurringId', '==', record.id),
            orderBy('createdAt', 'desc'),
            limit(1)
          );
          const snap = await getDocs(q);

          if (!snap.empty) {
            results[record.id] = snap.docs[0].data().number || '—';
          } else if (record.customer?.email) {
            // Fallback: latest invoice for this customer (catches first manual send)
            const fallbackQ = query(
              collection(db, 'invoices'),
              where('userId', '==', user.uid),
              where('customer.email', '==', record.customer.email),
              orderBy('createdAt', 'desc'),
              limit(1)
            );
            const fallbackSnap = await getDocs(fallbackQ);
            results[record.id] = fallbackSnap.empty
              ? '—'
              : fallbackSnap.docs[0].data().number || '—';
          } else {
            results[record.id] = '—';
          }
        } catch {
          results[record.id] = '—';
        }
      })
    );

    setLatestInvoices(results);
  };

  // ── Pause / Resume ──────────────────────────────────────────────────────────
  const toggleActive = async (record) => {
    setUpdatingId(record.id);
    const isResuming = !record.active;
    try {
      await updateDoc(doc(db, 'recurringInvoices', record.id), {
        active: isResuming,
        ...(isResuming && { lastRun: Timestamp.now() }),
      });
      setRecords(prev =>
        prev.map(r => r.id === record.id ? {
          ...r,
          active: isResuming,
          ...(isResuming && { lastRun: { toDate: () => new Date() } }),
        } : r)
      );
    } catch (err) {
      console.error('Toggle failed:', err);
      alert('Failed to update. Please try again.');
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
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

  const formatFrequency = (freq) => {
    const map = { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };
    return map[freq] || freq;
  };

  const activeCount = records.filter(r => r.active).length;
  const pausedCount = records.filter(r => !r.active).length;

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
          Recurring invoices are automatically generated by the backend scheduler.
          Resuming a paused invoice starts a fresh billing period from today.
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
        /* Scroll wrapper — table stays readable on any screen width */
        <div className="ril-table-wrap">
          <div className="ril-table">

            <div className="ril-thead">
              <span>Customer</span>
              <span>Frequency</span>
              <span>Amount</span>
              <span>Latest Invoice</span>
              <span>Started</span>
              <span>Next Invoice</span>
              <span>Status</span>
              <span>Actions</span>
            </div>

            {records.map(r => {
              const nextDate = getNextRunDate(r.lastRun, r.startDate, r.frequency);
              return (
                <div key={r.id} className={`ril-row ${r.active ? '' : 'ril-row-paused'}`}>

                  {/* Customer */}
                  <div className="ril-col ril-customer">
                    <div className="ril-customer-name">{r.customer?.name || '—'}</div>
                    {r.customer?.company && (
                      <div className="ril-customer-company">{r.customer.company}</div>
                    )}
                  </div>

                  {/* Frequency */}
                  <div className="ril-col ril-freq">
                    <i className="fas fa-redo"></i>
                    {formatFrequency(r.frequency)}
                  </div>

                  {/* Amount */}
                  <div className="ril-col ril-amount">
                    {formatCurrency(r.template?.totals?.finalTotal)}
                  </div>

                  {/* Latest Invoice */}
                  <div className="ril-col ril-latest-inv">
                    {latestInvoices[r.id] && latestInvoices[r.id] !== '—'
                      ? <span className="ril-inv-number">{latestInvoices[r.id]}</span>
                      : <span className="ril-muted-text">—</span>
                    }
                  </div>

                  {/* Started */}
                  <div className="ril-col ril-started">
                    <span className="ril-date-text">{formatStartDate(r.startDate)}</span>
                  </div>

                  {/* Next Invoice */}
                  <div className="ril-col ril-next">
                    {r.active
                      ? <span className="ril-next-date">{formatShortDate(nextDate)}</span>
                      : <span className="ril-muted-text">Paused</span>
                    }
                  </div>

                  {/* Status badge */}
                  <div className="ril-col">
                    <span className={`ril-badge ${r.active ? 'ril-badge-active' : 'ril-badge-paused'}`}>
                      {r.active ? 'Active' : 'Paused'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="ril-col ril-actions">
                    <button
                      className={`ril-btn ${r.active ? 'ril-btn-pause' : 'ril-btn-resume'}`}
                      onClick={() => toggleActive(r)}
                      disabled={updatingId === r.id}
                      title={r.active
                        ? 'Pause — resume will start a fresh billing period'
                        : 'Resume — fresh billing period starts today'}
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
              );
            })}
          </div>
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
