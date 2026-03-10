import { useState } from 'react';
import { useCustomers } from '../hooks/useCustomers';
import './CustomerSection.css';

function CustomerSection({ user, onCustomerChange }) {
  const { customers, loading, saveCustomer, deleteCustomer } = useCustomers(user?.uid);

  const emptyCustomer = { name: '', company: '', phone: '', email: '', address: '' };
  const [customer, setCustomer] = useState(emptyCustomer);
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
      setCustomer(emptyCustomer);
      onCustomerChange(emptyCustomer);
    }
  };

  const handleFieldChange = (field, value) => {
    const updated = { ...customer, [field]: value };
    setCustomer(updated);
    onCustomerChange(updated);
  };

  const handleNew = () => {
    setSelectedId('');
    setCustomer(emptyCustomer);
    onCustomerChange(emptyCustomer);
  };

  const handleSave = async () => {
    if (!customer.name.trim() || !customer.phone.trim()) {
      showToast('Name and phone are required', 'error');
      return;
    }
    setSaving(true);
    const result = await saveCustomer(customer);
    setSaving(false);
    if (result.success) {
      showToast(result.updated ? 'Customer updated' : 'Customer saved');
    } else {
      showToast(result.error || 'Error saving customer', 'error');
    }
  };

  const handleDelete = async () => {
    if (!selectedId) {
      showToast('Select a customer to delete', 'error');
      return;
    }
    const found = customers.find(c => c.id === selectedId);
    if (!confirm(`Delete "${found?.name}"? This cannot be undone.`)) return;

    setDeleting(true);
    const result = await deleteCustomer(selectedId);
    setDeleting(false);
    if (result.success) {
      setSelectedId('');
      setCustomer(emptyCustomer);
      onCustomerChange(emptyCustomer);
      showToast('Customer deleted');
    } else {
      showToast(result.error || 'Error deleting customer', 'error');
    }
  };

  return (
    <div className="customer-section">
      <div className="section-header">
        <h3><i className="fas fa-user"></i> Customer</h3>
      </div>

      {toast && (
        <div className={`cs-toast cs-toast-${toast.type}`}>
          <i className={`fas ${toast.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
          {toast.message}
        </div>
      )}

      {/* Dropdown */}
      <div className="form-row">
        <div className="form-group full">
          <label>Existing Customer</label>
          <select
            className="form-control"
            value={selectedId}
            onChange={handleDropdownChange}
            disabled={loading}
          >
            <option value="">{loading ? 'Loading customers...' : 'Select existing customer or add new'}</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.company ? ` (${c.company})` : ''} — {c.phone}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Fields */}
      <div className="form-row two-col">
        <div className="form-group">
          <label>Name <span className="required">*</span></label>
          <input
            type="text"
            className="form-control"
            value={customer.name}
            onChange={e => handleFieldChange('name', e.target.value)}
            placeholder="Full name"
          />
        </div>
        <div className="form-group">
          <label>Company</label>
          <input
            type="text"
            className="form-control"
            value={customer.company}
            onChange={e => handleFieldChange('company', e.target.value)}
            placeholder="Company name (optional)"
          />
        </div>
      </div>

      <div className="form-row two-col">
        <div className="form-group">
          <label>Phone <span className="required">*</span></label>
          <input
            type="tel"
            className="form-control"
            value={customer.phone}
            onChange={e => handleFieldChange('phone', e.target.value)}
            placeholder="(647) 555-1234"
          />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            className="form-control"
            value={customer.email}
            onChange={e => handleFieldChange('email', e.target.value)}
            placeholder="email@example.com"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group full">
          <label>Address</label>
          <input
            type="text"
            className="form-control"
            value={customer.address}
            onChange={e => handleFieldChange('address', e.target.value)}
            placeholder="Street address, city"
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="customer-actions">
        <button className="btn-save" onClick={handleSave} disabled={saving}>
          {saving ? <><i className="fas fa-spinner fa-spin"></i> Saving...</> : <><i className="fas fa-save"></i> Save Customer</>}
        </button>
        <button className="btn-new" onClick={handleNew}>
          <i className="fas fa-user-plus"></i> New Customer
        </button>
        {selectedId && (
          <button className="btn-delete" onClick={handleDelete} disabled={deleting}>
            {deleting ? <><i className="fas fa-spinner fa-spin"></i> Deleting...</> : <><i className="fas fa-trash"></i> Delete</>}
          </button>
        )}
      </div>
    </div>
  );
}

export default CustomerSection;
