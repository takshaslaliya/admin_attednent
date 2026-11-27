import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Lock, UserCheck, ArrowRight, ArrowLeft, AlertCircle, MessageCircle, RefreshCw, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './AdminLoginPage.css';

const RESEND_WAIT_SECONDS = 60;
const WRONG_CODE_TEXT = 'Wrong or expired code. Request a new one.';

/**
 * Admin portal: Admin Access ID, then the 6-digit code the server sends on WhatsApp to the
 * administrators. Mentor portal (hostname contains "mentor"): Mentor ID + password, unchanged.
 */
export const AdminLoginPage: React.FC = () => {
  const { login } = useAuth();
  const [userCode, setUserCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Admin code step
  const [step, setStep] = useState<'id' | 'code'>('id');
  const [otp, setOtp] = useState('');
  const [codeInfo, setCodeInfo] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const otpInputRef = useRef<HTMLInputElement>(null);

  const isMentor = import.meta.env.VITE_PORTAL_TYPE === 'mentor' ||
    (typeof window !== 'undefined' && window.location.hostname.includes('mentor'));

  // "Send a new code" countdown.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (step === 'code') otpInputRef.current?.focus();
  }, [step]);

  /** Step 1 (and "Send a new code"): the ID only. The server sends a code and answers 428. */
  const requestCode = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await login(userCode.trim());
      if (!('needsCode' in result)) return; // logged in without a code (not expected for admins)
      setCodeInfo(result.message || 'Enter the code sent on WhatsApp.');
      setOtp('');
      setStep('code');
    } catch (err: any) {
      // 429 (too many codes), 403 (wrong portal), wrong ID, network...
      setError(err.message || 'Could not start the admin login');
    } finally {
      // Every request counts toward the server's one-per-minute limit.
      setResendIn(RESEND_WAIT_SECONDS);
      setLoading(false);
    }
  };

  /** Step 2: the ID with the code. */
  const verifyCode = async () => {
    const code = otp.trim();
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await login(userCode.trim(), undefined, code);
      if ('needsCode' in result) {
        // We sent a code, so a 428 here means wrong, expired or already used.
        setError(WRONG_CODE_TEXT);
        setOtp('');
        otpInputRef.current?.focus();
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userCode.trim()) {
      setError(isMentor ? 'Please enter your Mentor / User ID' : 'Please enter your Admin Access ID');
      return;
    }

    if (!isMentor) {
      if (step === 'id') await requestCode();
      else await verifyCode();
      return;
    }

    // Mentor portal: ID + password, as before.
    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await login(userCode.trim(), password.trim());
      if ('needsCode' in result) setError(result.message || 'This account needs a code to log in.');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Invalid mentor credentials');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setStep('id');
    setOtp('');
    setCodeInfo('');
    setError('');
  };

  const deliveryFailed = /could not be sent/i.test(codeInfo);
  const accent = isMentor ? { background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' } : {};

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        {/* Top Header */}
        <div className="login-header-zone">
          <div className="login-shield-badge" style={accent}>
            {isMentor ? <UserCheck size={32} /> : <ShieldCheck size={32} />}
          </div>
          <h1>{isMentor ? 'Mentor Portal' : 'Admin Portal'}</h1>
          <p>{isMentor ? 'Floor Leader & Mentor Attendance Console' : 'Hostel Attendance Management System'}</p>
        </div>

        {error && (
          <div className="login-error-alert" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          {step === 'id' ? (
            <>
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

              {isMentor && (
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
              )}

              <button type="submit" className="login-submit-btn" disabled={loading} style={accent}>
                <span>
                  {loading
                    ? (isMentor ? 'Authenticating...' : 'Sending code...')
                    : (isMentor ? 'Sign In as Mentor' : 'Continue')}
                </span>
                <ArrowRight size={18} />
              </button>
            </>
          ) : (
            <>
              <div
                style={{
                  display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '12px 14px', borderRadius: '12px',
                  fontSize: '13px', lineHeight: 1.45,
                  background: deliveryFailed ? '#fffbeb' : '#ecfdf5',
                  border: `1px solid ${deliveryFailed ? '#fde68a' : '#a7f3d0'}`,
                  color: deliveryFailed ? '#92400e' : '#065f46'
                }}
              >
                <MessageCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>{codeInfo}</span>
              </div>

              <div className="form-field-group">
                <label>WHATSAPP CODE</label>
                <div className="input-icon-container">
                  <KeyRound size={18} className="field-icon" />
                  <input
                    ref={otpInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit code"
                    aria-label="6-digit code sent on WhatsApp"
                    style={{ letterSpacing: '6px', fontWeight: 700 }}
                  />
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                  Admin ID: <strong>{userCode.trim()}</strong> · The code works once, for 5 minutes.
                </div>
              </div>

              <button type="submit" className="login-submit-btn" disabled={loading || otp.length !== 6}>
                <span>{loading ? 'Verifying...' : 'Verify'}</span>
                <ArrowRight size={18} />
              </button>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  onClick={goBack}
                  disabled={loading}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#475569', fontWeight: 700, fontSize: '13px', cursor: 'pointer', padding: '6px 0' }}
                >
                  <ArrowLeft size={16} /> Back
                </button>
                <button
                  type="button"
                  onClick={requestCode}
                  disabled={loading || resendIn > 0}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', fontWeight: 700, fontSize: '13px', padding: '6px 0', color: resendIn > 0 ? '#94a3b8' : '#4f46e5', cursor: resendIn > 0 ? 'default' : 'pointer' }}
                >
                  <RefreshCw size={16} /> {resendIn > 0 ? `Send a new code (${resendIn}s)` : 'Send a new code'}
                </button>
              </div>
            </>
          )}
        </form>

        <div className="login-footer-info">
          <span>{isMentor ? 'Hostel Attendance System • Mentor Access' : 'Connected to Hostel Attendance Database'}</span>
        </div>
      </div>
    </div>
  );
};
