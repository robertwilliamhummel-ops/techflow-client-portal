import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import clientConfig from '../config/client';
import InvoiceList from './InvoiceList';
import './AdminDashboard.css';

function AdminDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('invoices');

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

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

        {/* Tabs */}
        <nav className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === 'invoices' ? 'active' : ''}`}
            onClick={() => setActiveTab('invoices')}
          >
            <i className="fas fa-list"></i> All Invoices
          </button>
          <button
            className={`admin-tab ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            <i className="fas fa-file-invoice"></i> Create Invoice
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="admin-main">
        {activeTab === 'invoices' && (
          <InvoiceList user={user} onCreateNew={() => setActiveTab('create')} />
        )}

        {activeTab === 'create' && (
          <div className="coming-soon">
            <i className="fas fa-tools"></i>
            <h2>Invoice Form</h2>
            <p>Coming in Session 2 — Invoice form, customer management, and calculator</p>
            <button className="btn-back" onClick={() => setActiveTab('invoices')}>
              <i className="fas fa-arrow-left"></i> Back to Invoices
            </button>
          </div>
        )}
      </main>

    </div>
  );
}

export default AdminDashboard;
