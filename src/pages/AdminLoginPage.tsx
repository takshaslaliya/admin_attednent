import React, { useState } from 'react';
import { ShieldCheck, Lock, UserCheck, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './AdminLoginPage.css';

export const AdminLoginPage: React.FC = () => {
  const { login } = useAuth();
  const [userCode, setUserCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isMentor = import.meta.env.VITE_PORTAL_TYPE === 'mentor' || 
    (typeof window !== 'undefined' && window.location.hostname.includes('mentor'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userCode.trim()) {
      setError(isMentor ? 'Please enter your Mentor / User ID' : 'Please enter your Admin Access ID');
      return;
    }

    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(userCode.trim(), password.trim());
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || (isMentor ? 'Invalid mentor credentials' : 'Invalid administrator credentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        {/* Top Header */}
        <div className="login-header-zone">
          <div className="login-shield-badge" style={isMentor ? { background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' } : {}}>
            {isMentor ? <UserCheck size={32} /> : <ShieldCheck size={32} />}
          </div>
          <h1>{isMentor ? 'Mentor Portal' : 'Admin Portal'}</h1>
          <p>{isMentor ? 'Floor Leader & Mentor Attendance Console' : 'Hostel Attendance Management System'}</p>
        </div>

        {error && (
          <div className="login-error-alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-field-group">
            <label>{isMentor ? 'MENTOR / USER ID' : 'ADMIN ACCESS ID'}</label>
            <div className="input-icon-container">
              <UserCheck size={18} className="field-icon" />
              <input
                type="text"
                value={userCode}
                onChange={(e) => setUserCode(e.target.value)}
                placeholder={isMentor ? 'Enter Mentor ID or Username' : 'Enter Admin Access ID'}
                autoFocus
                required
              />
            </div>
          </div>

          <div className="form-field-group">
            <label>PASSWORD</label>
            <div className="input-icon-container">
              <Lock size={18} className="field-icon" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="login-submit-btn" 
            disabled={loading}
            style={isMentor ? { background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' } : {}}
          >
            <span>{loading ? 'Authenticating...' : (isMentor ? 'Sign In as Mentor' : 'Sign In to Portal')}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="login-footer-info">
          <span>{isMentor ? 'Hostel Attendance System • Mentor Access' : 'Connected to Hostel Attendance Database'}</span>
        </div>
      </div>
    </div>
  );
};
