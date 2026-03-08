import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './config/firebase';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
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

  return user ? <Dashboard user={user} /> : <LoginPage />;
}

export default App;
