import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cpu, Lock, ArrowRight, Eye, EyeOff, ShieldAlert, CheckCircle2, X, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../config';

const LoginPage = ({ onLogin }) => {
  // Login States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // MFA States
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  // 3-Step Forgot Password States
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Request, 2: OTP, 3: Reset
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotResendTimer, setForgotResendTimer] = useState(0);
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('remembered_user');
    if (savedUser) {
      setUsername(savedUser);
      setRememberMe(true);
    }
  }, []);

  // Timer logic for both MFA and Forgot Password resends
  useEffect(() => {
    let interval;
    if (resendTimer > 0) interval = setInterval(() => setResendTimer(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  useEffect(() => {
    let interval;
    if (forgotResendTimer > 0) interval = setInterval(() => setForgotResendTimer(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [forgotResendTimer]);

  // Password Strength Calculator
  const calculateStrength = (pass) => {
    let score = 0;
    if (!pass) return 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[a-z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return score;
  };
  const passStrength = calculateStrength(newPassword);

  // --- LOGIN LOGIC ---
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();

      if (response.ok && data.require_otp) {
        setMaskedEmail(data.masked_email);
        setShowMfaModal(true);
        setResendTimer(60);
      } else {
        setError(data.error || 'Invalid credentials.');
      }
    } catch (err) {
      setError('Server connection failed. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (response.ok) setResendTimer(60);
      else setError('Failed to resend code.');
    } catch (err) {
      setError('Network error. Check server.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/verify-login-otp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, otp: otpCode })
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('user_role', data.role);
        localStorage.setItem('username', data.username);
        localStorage.setItem('token', data.token);
        if (rememberMe) localStorage.setItem('remembered_user', data.username); 
        else localStorage.removeItem('remembered_user');
        onLogin(data.username, data.role); 
      } else {
        setError(data.error || 'Invalid OTP code.');
      }
    } catch (err) {
      setError('Network error verifying OTP.');
    } finally {
      setLoading(false);
    }
  };

  // --- FORGOT PASSWORD LOGIC ---
  const handleForgotRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setForgotError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/request-password-reset/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: forgotUsername, email: forgotEmail })
      });
      const data = await response.json();
      if (response.ok) {
        setForgotStep(2);
        setForgotResendTimer(60);
      } else {
        setForgotError(data.error || 'User not found.');
      }
    } catch (err) {
      setForgotError('Network error connecting to server.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotResendOTP = async () => {
    if (forgotResendTimer > 0) return;
    setLoading(true);
    setForgotError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/request-password-reset/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: forgotUsername, email: forgotEmail })
      });
      if (response.ok) setForgotResendTimer(60);
      else setForgotError('Failed to resend code.');
    } catch (err) {
      setForgotError('Network error connecting to server.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyForgotOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setForgotError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/verify-reset-otp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: forgotUsername, otp: forgotOtp })
      });
      if (response.ok) {
        setForgotStep(3);
      } else {
        const data = await response.json();
        setForgotError(data.error || 'Invalid or expired OTP.');
      }
    } catch (err) {
      setForgotError('Network error verifying OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setForgotError('');

    if (passStrength < 5) {
      setForgotError('Password must meet all security requirements.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setForgotError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/reset-password/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: forgotUsername, otp: forgotOtp, new_password: newPassword })
      });
      const data = await response.json();
      
      if (response.ok) {
        setForgotSuccess(data.message);
        setTimeout(() => closeModals(), 3000);
      } else {
        setForgotError(data.error || 'Failed to reset password.');
      }
    } catch (err) {
      setForgotError('Network error executing reset.');
    } finally {
      setLoading(false);
    }
  };

  const closeModals = () => {
    setShowMfaModal(false);
    setShowForgotModal(false);
    setForgotStep(1);
    setOtpCode('');
    setError('');
    setForgotError('');
    setForgotUsername('');
    setForgotEmail('');
    setForgotOtp('');
    setNewPassword('');
    setConfirmNewPassword('');
    setResendTimer(0);
    setForgotResendTimer(0);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#F8F9FA', fontFamily: 'system-ui, sans-serif' }}>
      
      <style>
        {`
          @keyframes floatSlow { 0% { transform: translateY(0px) translateX(0px); } 50% { transform: translateY(-20px) translateX(10px); } 100% { transform: translateY(0px) translateX(0px); } }
          @keyframes floatFast { 0% { transform: translateY(0px) translateX(0px); } 50% { transform: translateY(15px) translateX(-15px); } 100% { transform: translateY(0px) translateX(0px); } }
          @keyframes lockFloat { 0% { transform: translateY(0px); } 50% { transform: translateY(-5px); } 100% { transform: translateY(0px); } }
          @keyframes pulseGlowClean { 0% { box-shadow: 0 0 15px rgba(16, 185, 129, 0.3); } 50% { box-shadow: 0 0 30px rgba(16, 185, 129, 0.6); } 100% { box-shadow: 0 0 15px rgba(16, 185, 129, 0.3); } }
          @keyframes shineSweep { 0% { transform: translateX(-150%) skewX(-25deg); } 20% { transform: translateX(200%) skewX(-25deg); } 100% { transform: translateX(200%) skewX(-25deg); } }
          @keyframes ringShimmer { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
          @keyframes spinBorder { 100% { transform: rotate(360deg); } }
          @keyframes modalPop { 0% { opacity: 0; transform: scale(0.95) translateY(20px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
          @keyframes overlayFade { 0% { opacity: 0; backdrop-filter: blur(0px); } 100% { opacity: 1; backdrop-filter: blur(8px); } }

          .premium-lock-ring { width: 88px; height: 88px; border-radius: 50%; background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 50%, #e2e8f0 100%); background-size: 200% 200%; display: flex; justify-content: center; align-items: center; box-shadow: 0 15px 35px rgba(0,0,0,0.08), inset 0px 4px 10px rgba(255,255,255,1); border: 1px solid rgba(255,255,255,1); animation: ringShimmer 5s infinite linear, lockFloat 4s infinite ease-in-out; position: relative; }
          .premium-lock-ring::before { content: ''; position: absolute; top: -4px; left: -4px; right: -4px; bottom: -4px; border-radius: 50%; background: linear-gradient(45deg, transparent, rgba(16, 185, 129, 0.15), transparent); animation: spinBorder 4s infinite linear; z-index: -1; }
          .premium-lock-core { width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, #34D399 0%, #10B981 100%); display: flex; justify-content: center; align-items: center; animation: pulseGlowClean 3s infinite ease-in-out; border: 2px solid #ffffff; box-sizing: border-box; position: relative; overflow: hidden; }
          .premium-lock-core::after { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(to right, transparent, rgba(255,255,255,0.6), transparent); animation: shineSweep 5s infinite; }
          .premium-lock-icon { color: #ffffff; filter: drop-shadow(0px 2px 2px rgba(4, 120, 87, 0.4)); z-index: 2; }
          
          .ai-core-container { position: relative; padding: 16px; background-color: rgba(16, 185, 129, 0.1); border-radius: 16px; display: flex; justify-content: center; align-items: center; animation: aiCoreGlow 3s infinite ease-in-out; z-index: 2; }
          @keyframes aiCoreGlow { 0% { box-shadow: 0 0 10px rgba(16, 185, 129, 0.2); transform: scale(1); } 50% { box-shadow: 0 0 25px rgba(16, 185, 129, 0.5); transform: scale(1.03); } 100% { box-shadow: 0 0 10px rgba(16, 185, 129, 0.2); transform: scale(1); } }
          .ai-core-ring { position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px; border-radius: 18px; border: 2px dashed rgba(16, 185, 129, 0.4); animation: spinBorder 12s infinite linear; pointer-events: none; }
          
          .circuit-pattern { background-image: radial-gradient(#10B981 1.5px, transparent 1.5px); background-size: 40px 40px; opacity: 0.07; position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 0; }
          .login-btn { transition: all 0.3s ease; }
          .login-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4); background-color: #059669 !important; }
          .btn-blue:hover:not(:disabled) { box-shadow: 0 10px 25px rgba(59, 130, 246, 0.4); background-color: #2563EB !important; }
          
          .input-field { transition: all 0.2s ease; }
          .input-field:focus { border-color: #10B981 !important; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1); }
          .input-field.blue-focus:focus { border-color: #3B82F6 !important; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
          
          .custom-checkbox { accent-color: #10B981; width: 16px; height: 16px; cursor: pointer; border-radius: 4px; }
          .forgot-password-link { color: #10B981; font-size: 13px; font-weight: 600; text-decoration: none; cursor: pointer; transition: color 0.2s; }
          .forgot-password-link:hover { color: #059669; text-decoration: underline; }
          
          .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.6); z-index: 999; display: flex; align-items: center; justify-content: center; animation: overlayFade 0.3s ease forwards; backdrop-filter: blur(8px); }
          .modal-box { background: #FFFFFF; border-radius: 24px; padding: 40px; width: 100%; max-width: 420px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); animation: modalPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; position: relative; border: 1px solid rgba(255,255,255,0.2); }
          .close-btn { position: absolute; top: 20px; right: 20px; background: #F8FAFC; border: 1px solid #E2E8F0; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #64748B; transition: all 0.2s; }
          .close-btn:hover { background: #E2E8F0; color: #0F172A; transform: scale(1.1); }

          .otp-input-premium { width: 100%; padding: 16px; border-radius: 12px; border: 2px solid #E2E8F0; background-color: #F8FAFC; color: #0F172A; outline: none; box-sizing: border-box; text-align: center; font-size: 28px; letter-spacing: 16px; font-weight: 800; font-family: 'Courier New', Courier, monospace; transition: all 0.3s ease; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); }
          .otp-input-premium:focus { border-color: #10B981; background-color: #FFFFFF; box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.15); }
          .otp-input-premium.blue-focus:focus { border-color: #3B82F6; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15); }
          .otp-input-premium::placeholder { color: #CBD5E1; font-weight: 500; letter-spacing: 12px; }
          
          .resend-link { font-size: 13.5px; font-weight: 700; color: #10B981; background: none; border: none; cursor: pointer; padding: 8px 16px; border-radius: 8px; transition: all 0.2s; display: flex; align-items: center; gap: 6px; }
          .resend-link:hover:not(:disabled) { background-color: #F0FDF4; color: #059669; }
          .resend-link.blue-link { color: #3B82F6; }
          .resend-link.blue-link:hover:not(:disabled) { background-color: #EFF6FF; color: #2563EB; }
          .resend-link:disabled { color: #94A3B8; cursor: not-allowed; background: transparent; }
        `}
      </style>

      {/* --- MODALS --- */}
      {/* 1. MFA Verification Modal */}
      {showMfaModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <button className="close-btn" onClick={closeModals}><X size={16}/></button>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
              <div style={{ width: '64px', height: '64px', backgroundColor: '#F0FDF4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981', border: '2px solid #DCFCE7', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)' }}>
                <ShieldCheck size={32} />
              </div>
            </div>
            <h2 style={{ textAlign: 'center', margin: '0 0 8px 0', color: '#0F172A', fontSize: '22px', fontWeight: '800' }}>Two-Factor Verification</h2>
            <p style={{ textAlign: 'center', color: '#64748B', fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
              For your security, we've sent a 6-digit authentication code to <strong style={{ color: '#0F172A' }}>{maskedEmail}</strong>.
            </p>

            {error && (
              <div style={{ backgroundColor: '#FEF2F2', color: '#EF4444', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', border: '1px solid #FCA5A5', textAlign: 'center', fontWeight: '600' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleVerifyOtp}>
              <div style={{ marginBottom: '24px' }}>
                <input 
                  type="text" 
                  maxLength="6"
                  className="otp-input-premium"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  autoFocus
                  required 
                />
              </div>
              <button 
                type="submit" 
                className="login-btn"
                disabled={loading || otpCode.length !== 6}
                style={{ width: '100%', padding: '16px', backgroundColor: '#0F172A', color: '#FFFFFF', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 'bold', cursor: (loading || otpCode.length !== 6) ? 'not-allowed' : 'pointer', opacity: (loading || otpCode.length !== 6) ? 0.7 : 1, boxShadow: '0 8px 20px rgba(15, 23, 42, 0.2)' }}
              >
                {loading ? 'Verifying Code...' : 'Authenticate & Login'}
              </button>
            </form>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
              <button type="button" className="resend-link" onClick={handleResendOTP} disabled={resendTimer > 0 || loading}>
                <RefreshCw size={14} className={loading && resendTimer === 0 ? "animate-spin" : ""} /> 
                {resendTimer > 0 ? `Resend Code in ${resendTimer}s` : 'Resend Code'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Forgot Password Modal (3 Steps) */}
      {showForgotModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <button className="close-btn" onClick={closeModals}><X size={16}/></button>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
              <div style={{ width: '64px', height: '64px', backgroundColor: '#EFF6FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6', border: '2px solid #BFDBFE', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)' }}>
                <Lock size={32} />
              </div>
            </div>
            
            <h2 style={{ textAlign: 'center', margin: '0 0 8px 0', color: '#0F172A', fontSize: '22px', fontWeight: '800' }}>
              {forgotStep === 1 ? 'Reset Password' : forgotStep === 2 ? 'Verify Identity' : 'Create New Password'}
            </h2>
            <p style={{ textAlign: 'center', color: '#64748B', fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
              {forgotStep === 1 && 'Enter your System ID and associated Email to receive a secure token.'}
              {forgotStep === 2 && 'Enter the 6-digit token dispatched to your email address.'}
              {forgotStep === 3 && 'Secure your account with a new, strong password.'}
            </p>

            {forgotError && (
              <div style={{ backgroundColor: '#FEF2F2', color: '#EF4444', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', border: '1px solid #FCA5A5', textAlign: 'center', fontWeight: '600' }}>
                {forgotError}
              </div>
            )}
            {forgotSuccess && (
              <div style={{ backgroundColor: '#F0FDF4', color: '#10B981', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', border: '1px solid #A7F3D0', textAlign: 'center', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} /> {forgotSuccess}
              </div>
            )}

            {forgotStep === 1 && (
              <form onSubmit={handleForgotRequest}>
                <input type="text" className="input-field blue-focus" value={forgotUsername} onChange={(e) => setForgotUsername(e.target.value)} placeholder="System ID" style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', marginBottom: '16px', outline: 'none', boxSizing: 'border-box' }} required />
                <input type="email" className="input-field blue-focus" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="Registered Email" style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', marginBottom: '24px', outline: 'none', boxSizing: 'border-box' }} required />
                <button type="submit" className="login-btn btn-blue" disabled={loading} style={{ width: '100%', padding: '16px', backgroundColor: '#3B82F6', color: '#FFFFFF', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, boxShadow: '0 8px 20px rgba(59, 130, 246, 0.2)' }}>
                  {loading ? 'Searching Database...' : 'Request Reset Token'}
                </button>
              </form>
            )}

            {forgotStep === 2 && (
              <form onSubmit={handleVerifyForgotOtp}>
                <div style={{ marginBottom: '24px' }}>
                  <input type="text" maxLength="6" className="otp-input-premium blue-focus" value={forgotOtp} onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))} placeholder="000000" autoFocus required />
                </div>
                <button type="submit" className="login-btn btn-blue" disabled={loading || forgotOtp.length !== 6} style={{ width: '100%', padding: '16px', backgroundColor: '#3B82F6', color: '#FFFFFF', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 'bold', cursor: (loading || forgotOtp.length !== 6) ? 'not-allowed' : 'pointer', opacity: (loading || forgotOtp.length !== 6) ? 0.7 : 1, boxShadow: '0 8px 20px rgba(59, 130, 246, 0.2)' }}>
                  {loading ? 'Verifying...' : 'Verify Token'}
                </button>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                  <button type="button" className="resend-link blue-link" onClick={handleForgotResendOTP} disabled={forgotResendTimer > 0 || loading}>
                    <RefreshCw size={14} className={loading && forgotResendTimer === 0 ? "animate-spin" : ""} /> 
                    {forgotResendTimer > 0 ? `Resend Code in ${forgotResendTimer}s` : 'Resend Code'}
                  </button>
                </div>
              </form>
            )}

            {forgotStep === 3 && (
              <form onSubmit={handleResetPassword}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                  <input type={showNewPassword ? "text" : "password"} className="input-field blue-focus" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New Password" style={{ width: '100%', padding: '14px 45px 14px 16px', borderRadius: '10px', border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', outline: 'none', boxSizing: 'border-box' }} required />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: '4px' }}>
                    {showNewPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>

                {newPassword.length > 0 && (
                  <div className="animate-fade-in" style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', gap: '4px', marginTop: '10px', height: '4px' }}>
                      <div style={{ flex: 1, borderRadius: '2px', backgroundColor: passStrength >= 1 ? '#EF4444' : '#E2E8F0', transition: 'all 0.3s' }}></div>
                      <div style={{ flex: 1, borderRadius: '2px', backgroundColor: passStrength >= 2 ? '#F59E0B' : '#E2E8F0', transition: 'all 0.3s' }}></div>
                      <div style={{ flex: 1, borderRadius: '2px', backgroundColor: passStrength >= 3 ? '#FBBF24' : '#E2E8F0', transition: 'all 0.3s' }}></div>
                      <div style={{ flex: 1, borderRadius: '2px', backgroundColor: passStrength >= 4 ? '#3B82F6' : '#E2E8F0', transition: 'all 0.3s' }}></div>
                      <div style={{ flex: 1, borderRadius: '2px', backgroundColor: passStrength >= 5 ? '#2563EB' : '#E2E8F0', transition: 'all 0.3s' }}></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: newPassword.length >= 8 ? '#3B82F6' : '#94A3B8', transition: 'color 0.3s' }}>8+ Chars</span>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: /[A-Z]/.test(newPassword) ? '#3B82F6' : '#94A3B8', transition: 'color 0.3s' }}>Upper</span>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: /[a-z]/.test(newPassword) ? '#3B82F6' : '#94A3B8', transition: 'color 0.3s' }}>Lower</span>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: /[0-9]/.test(newPassword) ? '#3B82F6' : '#94A3B8', transition: 'color 0.3s' }}>Number</span>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: /[^A-Za-z0-9]/.test(newPassword) ? '#3B82F6' : '#94A3B8', transition: 'color 0.3s' }}>Symbol</span>
                    </div>
                  </div>
                )}

                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                  <input type={showConfirmNewPassword ? "text" : "password"} className="input-field blue-focus" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="Confirm New Password" style={{ width: '100%', padding: '14px 45px 14px 16px', borderRadius: '10px', border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', outline: 'none', boxSizing: 'border-box' }} required />
                  <button type="button" onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)} style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: '4px' }}>
                    {showConfirmNewPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>

                <button type="submit" className="login-btn btn-blue" disabled={loading || forgotSuccess} style={{ width: '100%', padding: '16px', backgroundColor: '#3B82F6', color: '#FFFFFF', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, boxShadow: '0 8px 20px rgba(59, 130, 246, 0.2)' }}>
                  {loading ? 'Applying Update...' : 'Commit New Password'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* --- BACKGROUND / BRANDING SIDE --- */}
      <div className="animate-slide-right" style={{ flex: 1.2, backgroundColor: '#0B1120', color: '#FFFFFF', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px', position: 'relative', overflow: 'hidden' }}>
        <div className="circuit-pattern"></div>
        <div style={{ position: 'absolute', top: '15%', right: '20%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, rgba(11,17,32,0) 70%)', animation: 'floatSlow 8s infinite ease-in-out', zIndex: 1 }}></div>
        <div style={{ position: 'absolute', bottom: '10%', left: '10%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(56,189,248,0.1) 0%, rgba(11,17,32,0) 70%)', animation: 'floatFast 6s infinite ease-in-out', zIndex: 1 }}></div>

        <div style={{ position: 'relative', zIndex: 2, maxWidth: '600px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '35px' }}>
            <div className="ai-core-container">
              <div className="ai-core-ring"></div>
              <Cpu size={44} color="#10B981" style={{ filter: 'drop-shadow(0 0 8px rgba(16,185,129,0.8))' }} />
            </div>
            <h1 style={{ fontSize: '2.2rem', margin: 0, letterSpacing: '2px', fontWeight: 'bold', color: '#F8FAFC' }}>
              PCB<span style={{ color: '#10B981' }}> VISION</span>
            </h1>
          </div>
          
          <h2 style={{ fontSize: '2.5rem', fontWeight: '600', color: '#FFFFFF', lineHeight: '1.2', marginBottom: '20px' }}>
            AI-Based Electronics and<br/>PCB Defect Inspection<br/>and Analysis System
          </h2>
          
          <p style={{ fontSize: '1.1rem', color: '#94A3B8', lineHeight: '1.6', marginBottom: '40px' }}>
            A centralized MLOps platform engineered to isolate optical defects, monitor hardware telemetry, and deploy high-speed YOLO object detection to the manufacturing floor.
          </p>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.05)', padding: '12px 20px', borderRadius: '8px', width: 'fit-content', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
            <ShieldCheck size={20} />
            <span style={{ fontSize: '14px', letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: '600' }}>Enterprise Grade Security Active</span>
          </div>
        </div>
      </div>

      {/* --- FORM SIDE --- */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', backgroundColor: '#F8FAFC' }}>
        <form onSubmit={handleLoginSubmit} className="animate-slide-up" style={{ width: '100%', maxWidth: '440px', padding: '50px', backgroundColor: '#FFFFFF', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.04)', border: '1px solid #E2E8F0' }}>
          
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '35px' }}>
            <div className="premium-lock-ring">
              <div className="premium-lock-core">
                <Lock size={30} strokeWidth={2.5} className="premium-lock-icon" />
              </div>
            </div>
          </div>

          <h2 style={{ textAlign: 'center', margin: '0 0 8px 0', color: '#0F172A', fontSize: '28px', fontWeight: 'bold' }}>System Access</h2>
          <p style={{ textAlign: 'center', color: '#64748B', marginBottom: '35px', fontSize: '15px' }}>Enter your credentials to connect to the System.</p>
          
          {error && !showMfaModal && (
            <div className="animate-fade-in" style={{ backgroundColor: '#FEF2F2', color: '#EF4444', padding: '14px', borderRadius: '8px', marginBottom: '25px', fontSize: '14px', border: '1px solid #FCA5A5', textAlign: 'center', fontWeight: '500' }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#334155', fontSize: '14px', fontWeight: '600' }}>System ID</label>
            <input type="text" className="input-field" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your assigned ID" style={{ width: '100%', padding: '14px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }} required />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#334155', fontSize: '14px', fontWeight: '600' }}>Password</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input type={showPassword ? "text" : "password"} className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ width: '100%', padding: '14px 45px 14px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }} required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
                {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#475569', fontSize: '13px', fontWeight: '500' }}>
              <input type="checkbox" className="custom-checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
              Remember Me
            </label>
            <span onClick={() => setShowForgotModal(true)} className="forgot-password-link">
              Forgot Password?
            </span>
          </div>

          <button type="submit" className="login-btn" disabled={loading} style={{ width: '100%', padding: '16px', backgroundColor: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Authenticating...' : <>Access Dashboard <ArrowRight size={20} /></>}
          </button>
        </form>
      </div>

    </div>
  );
};

export default LoginPage;