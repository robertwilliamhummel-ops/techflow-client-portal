import './FloatingActionButton.css';

/**
 * FloatingActionButton — rendered only on mobile (< 768px).
 *
 * Mobile/Desktop toggle:
 *   AdminDashboard gates this component behind its `isMobile` state (matchMedia).
 *   The FAB is never present in the DOM on desktop.
 *
 * Context-awareness:
 *   • activeTab === 'invoices'  → FAB icon is fa-file-invoice, label "New Invoice"
 *   • activeTab === 'quotes'    → FAB icon is fa-file-alt,     label "New Quote"
 *   • activeTab === 'create-*'  → FAB is hidden (user is already in the create form)
 *
 * Props:
 *   activeTab — current AdminDashboard activeTab string
 *   onAction  — callback fired when the FAB is tapped; parent decides what to do
 */
function FloatingActionButton({ activeTab, onAction }) {
  // Do not render while a create form is already open
  if (activeTab === 'create-invoice' || activeTab === 'create-quote') {
    return null;
  }

  const isInvoices = activeTab === 'invoices';

  const label     = isInvoices ? 'New Invoice' : 'New Quote';
  const icon      = isInvoices ? 'fa-file-invoice' : 'fa-file-alt';
  const ariaLabel = isInvoices
    ? 'Create a new invoice'
    : 'Create a new quote';

  return (
    <button
      className="fab"
      onClick={onAction}
      aria-label={ariaLabel}
      title={label}
    >
      {/* Plus sign — always visible, communicates "create" universally */}
      <i className="fas fa-plus fab-icon-plus"></i>

      {/* Contextual sub-icon — small badge hinting what will be created */}
      <i className={`fas ${icon} fab-icon-context`}></i>
    </button>
  );
}

export default FloatingActionButton;
