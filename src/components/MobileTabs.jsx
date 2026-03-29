import './MobileTabs.css';

/**
 * MobileTabs — rendered only on mobile (< 768px), controlled by AdminDashboard.
 *
 * Mobile/Desktop toggle:
 *   AdminDashboard checks `isMobile` state (via matchMedia) and conditionally
 *   mounts this component. It is NEVER rendered on desktop — the existing
 *   `.admin-tabs` nav in the header handles desktop navigation unchanged.
 *
 * Two modes:
 *   1. List mode  (activeTab === 'invoices' | 'quotes')  → shows the two tab buttons.
 *   2. Create mode (activeTab === 'create-invoice' | 'create-quote') → shows a back button
 *      and the form title, so the user can always return to the list.
 *
 * Props:
 *   activeTab   — the current AdminDashboard activeTab string (one of the 4 values)
 *   onTabChange — callback(tabString) — used for both tab switches and back navigation
 */
function MobileTabs({ activeTab, onTabChange }) {
  const isCreateMode =
    activeTab === 'create-invoice' || activeTab === 'create-quote';

  const isInvoicesActive =
    activeTab === 'invoices' || activeTab === 'create-invoice';

  // ── Create-mode: show a back button + form title ──────────────────────────
  if (isCreateMode) {
    const backTab    = activeTab === 'create-invoice' ? 'invoices' : 'quotes';
    const formTitle  = activeTab === 'create-invoice' ? 'New Invoice'  : 'New Quote';
    const formIcon   = activeTab === 'create-invoice'
      ? 'fa-file-invoice'
      : 'fa-file-alt';

    return (
      <div className="mobile-tabs mobile-tabs--back">
        <button
          className="mobile-back-btn"
          onClick={() => onTabChange(backTab)}
          aria-label="Back to list"
        >
          <i className="fas fa-arrow-left"></i>
          <span>Back</span>
        </button>
        <span className="mobile-form-title">
          <i className={`fas ${formIcon}`}></i> {formTitle}
        </span>
        {/* spacer keeps title centred */}
        <span className="mobile-tabs-spacer" aria-hidden="true"></span>
      </div>
    );
  }

  // ── List mode: two main tabs ──────────────────────────────────────────────
  return (
    <div className="mobile-tabs" role="tablist">
      <button
        className={`mobile-tab ${isInvoicesActive ? 'mobile-tab--active' : ''}`}
        onClick={() => onTabChange('invoices')}
        role="tab"
        aria-selected={isInvoicesActive}
        aria-label="Invoices"
      >
        <i className="fas fa-file-invoice-dollar mobile-tab-icon"></i>
        <span className="mobile-tab-label">Invoices</span>
      </button>

      <button
        className={`mobile-tab ${!isInvoicesActive ? 'mobile-tab--active' : ''}`}
        onClick={() => onTabChange('quotes')}
        role="tab"
        aria-selected={!isInvoicesActive}
        aria-label="Quotes"
      >
        <i className="fas fa-file-alt mobile-tab-icon"></i>
        <span className="mobile-tab-label">Quotes</span>
      </button>
    </div>
  );
}

export default MobileTabs;
