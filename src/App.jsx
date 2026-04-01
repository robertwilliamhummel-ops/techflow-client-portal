import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './config/firebase';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import InvoicePreview from './components/InvoicePreview';

function App() {
  const [user, setUser]       = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
          setIsAdmin(adminDoc.exists());
        } catch (err) {
          console.error('Admin check failed:', err);
          setIsAdmin(false);
        }
        setUser(currentUser);
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#0f0c29',
        color: '#667eea',
        fontSize: '1.2rem'
      }}>
        <i className="fas fa-spinner fa-spin" style={{ marginRight: '0.75rem' }}></i>
        Loading...
      </div>
    );
  }

  // Not authenticated — show login for all routes
  if (!user) return <LoginPage />;

  // Authenticated — use React Router.
  // /invoice/:id is accessible to both admins and clients.
  // Everything else falls through to the appropriate dashboard.
  return (
    <Routes>
      <Route path="/invoice/:id" element={<InvoicePreview />} />
      <Route
        path="*"
        element={
          isAdmin
            ? <AdminDashboard user={user} />
            : <Dashboard user={user} />
        }
      />
    </Routes>
  );
}

export default App;
