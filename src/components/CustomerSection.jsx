import { useState } from 'react';
import { useCustomers } from '../hooks/useCustomers';
import './CustomerSection.css';

function CustomerSection({ user, onCustomerChange }) {
  const { customers, loading, saveCustomer, deleteCustomer } = useCustomers(user?.uid);
  const empty = { name: '', company: '', phone: '', email: '', address: '' };
  const [customer, setCustomer] = useState(empty);
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleDropdownChange = (e) => {
    const id = e.target.value;
    setSelectedId(id);
    if (id) {
      const found = customers.find(c => c.id === id);
      if (found) {
        const data = { name: found.name || '', company: found.company || '', phone: found.phone || '', email: found.email || '', address: found.address || '' };
        setCustomer(data);
        onCustomerChange(data);
      }
    } else {
      setCustomer(empty);
      onCustomerChange(empty);
    }
  };

  const set = (field, value) => {
    const updated = { ...customer, [field]: value };
    setCustomer(updated);
    onCustomerChange(updated);
  };

  const handleNew = () => { setSelectedId(''); setCustomer(empty); onCustomerChange(empty); };

  const handleSave = async () => {
    if (!customer.name.trim() || !customer.phone.trim()) { showToast('Name and phone required', 'error'); return; }
    setSaving(true);
    const result = await saveCustomer(customer);
    setSaving(false);
    showToast(result.success ? (result.updated ? 'Customer updated' : 'Customer saved') : result.error, result.success ? 'success' : 'error');
  };

  const handleDelete = async () => {
    if (!selectedId) { showToast('Select a customer to delete', 'error'); return; }
    const found = customers.find(c => c.id === selectedId);
    if (!confirm(`Delete "${found?.name}"?`)) return;
    setDeleting(true);
    const result = await deleteCustomer(selectedId);
    setDeleting(false);
    if (result.success) { setSelectedId(''); setCustomer(empty); onCustomerChange(empty); showToast('Customer deleted'); }
    else showToast(result.error, 'error');
  };

  return (
    <div className="form-card">
      <div className="card-title"><i className="fas fa-user"></i> Customer</div>

      {toast && (
        <div
          className={`cs-toast cs-toast-${toast.type}`}
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
        >
          {toast.message}
        </div>
      )}

      <div className="form-group">
        <select className="form-select" value={selectedId} onChange={handleDropdownChange} disabled={loading}>
          <option value="">{loading ? 'Loading...' : 'Select existing customer or add new'}</option>
          {customers.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}{c.company ? ` (${c.company})` : ''} — {c.phone}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Name *</label>
        <input className="form-input" placeholder="John Smith" value={customer.name} onChange={e => set('name', e.target.value)} />
      </div>

      <div className="form-group">
        <label className="form-label">Company</label>
        <input className="form-input" placeholder="Smith Contracting" value={customer.company} onChange={e => set('company', e.target.value)} />
      </div>

      <div className="cs-two-col">
        <div className="form-group">
          <label className="form-label">Phone *</label>
          <input className="form-input" placeholder="(416) 555-0123" value={customer.phone} onChange={e => set('phone', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" placeholder="john@smith.ca" value={customer.email} onChange={e => set('email', e.target.value)} />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Address</label>
        <input className="form-input" placeholder="123 Main St, Toronto ON" value={customer.address} onChange={e => set('address', e.target.value)} />
      </div>

      <div className="customer-btns">
        <button className="btn-save-customer" onClick={handleSave} disabled={saving}>
          {saving ? <><i className="fas fa-spinner fa-spin"></i> Saving...</> : <><i className="fas fa-save"></i> Save Customer</>}
        </button>
        <button className="btn-new-customer" onClick={handleNew}>
          <i className="fas fa-plus"></i> New
        </button>
        {selectedId && (
          <button className="btn-delete-customer" onClick={handleDelete} disabled={deleting} title="Delete customer">
            {deleting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-trash"></i>}
          </button>
        )}
      </div>
    </div>
  );
}

export default CustomerSection;
