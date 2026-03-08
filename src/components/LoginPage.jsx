import { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';
import clientConfig from '../config/client';
import './LoginPage.css';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged in App.jsx handles redirect automatically
    } catch (err) {
      setLoading(false);
      switch (err.code) {
        case 'auth/invalid-email':
          setError('Invalid email address'); break;
        case 'auth/user-not-found':
          setError('No account found with this email'); break;
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setError('Invalid email or password'); break;
        case 'auth/too-many-requests':
          setError('Too many attempts. Please try again later'); break;
        default:
          setError('Login failed. Please try again');
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Enter your email address first');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess('Password reset email sent! Check your inbox.');
      setError('');
    } catch (err) {
      setError('Could not send reset email. Check your email address.');
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-logo">
          <img src={clientConfig.logoUrl} alt={clientConfig.companyName} className="login-logo-img" />
          <h1>{clientConfig.companyName}</h1>
          <p>Client Portal</p>
        </div>

        {error && <div className="login-error">{error}</div>}
        {success && <div className="login-success">{success}</div>}

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <button className="forgot-btn" onClick={handleForgotPassword} type="button">
          Forgot password?
        </button>

        <div className="login-footer">
          <p>{clientConfig.companyPhone} · {clientConfig.companyEmail}</p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;