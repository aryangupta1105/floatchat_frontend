import { AnimatePresence, motion } from 'framer-motion';
import { Eye, EyeOff, Lock, Mail, RefreshCw, ShieldCheck, User, Waves } from 'lucide-react';
import React, { useRef, useState } from 'react';
import API from "../utils/api";

interface AuthScreenProps {
  onLogin: (userData: any) => void;
}

type AuthStep = 'credentials' | 'otp';

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '', name: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // OTP state
  const [step, setStep] = useState<AuthStep>('credentials');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [pendingUser, setPendingUser] = useState<any>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Send OTP via backend ──────────────────────────────────────────
  const sendOtpToEmail = async (email: string) => {
    await API.post("/auth/send-otp", { email });
  };

  // ── Credentials submit ──────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      let res;
      if (isLogin) {
        res = await API.post("/auth/login", {
          email: formData.email,
          password: formData.password
        });
      } else {
        res = await API.post("/auth/signup", {
          name: formData.name,
          email: formData.email,
          password: formData.password
        });
      }

      localStorage.setItem("token", res.data.token);
      const userData = res.data.user;

      // If already verified → go straight in
      if (userData.is_verified) {
        onLogin(userData);
        return;
      }

      // Not verified → send OTP and show verification step
      setPendingUser(userData);
      setOtpSending(true);
      try {
        await sendOtpToEmail(formData.email);
      } catch (otpErr: any) {
        console.warn('OTP send warning:', otpErr?.response?.data?.error || otpErr.message);
      }
      setOtpSending(false);
      setStep('otp');
    } catch (err: any) {
      const errData = err?.response?.data?.error;
setError(typeof errData === 'string' ? errData : errData?.message || 'Authentication failed. Check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── OTP digit input handlers ────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setOtpError('');
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  // ── Verify OTP ──────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      setOtpError('Enter all 6 digits');
      return;
    }

    setOtpVerifying(true);
    setOtpError('');

    try {
      const res = await API.post("/auth/verify-otp", { email: formData.email, code });
      onLogin(res.data.user);
    } catch (err: any) {
      const verifyErr = err?.response?.data?.error;
setOtpError(typeof verifyErr === 'string' ? verifyErr : verifyErr?.message || err?.message || 'Verification failed');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setOtpVerifying(false);
    }
  };

  // ── Resend OTP ──────────────────────────────────────────────────────
  const handleResendOtp = async () => {
    setOtpSending(true);
    setOtpError('');
    try {
      await sendOtpToEmail(formData.email);
      setOtpError('OTP resent successfully!');
    } catch (err: any) {
      const resendErr = err?.response?.data?.error;
setOtpError(typeof resendErr === 'string' ? resendErr : resendErr?.message || 'Failed to resend. Try again.');
    } finally {
      setOtpSending(false);
    }
  };

  const inputVariants = {
    focus: { scale: 1.02, transition: { duration: 0.2 } }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-2xl p-8 w-full max-w-md border border-gray-700"
      >
        {/* Logo and Title */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center mb-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="bg-gradient-to-r from-blue-500 to-cyan-400 p-3 rounded-full"
            >
              <Waves className="w-8 h-8 text-white" />
            </motion.div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">FloatChat</h1>
          <p className="text-gray-400 text-sm">AI-Powered Ocean Data Interface</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ═══ STEP 1: CREDENTIALS ═══ */}
          {step === 'credentials' && (
            <motion.div
              key="credentials"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Auth Toggle */}
              <div className="flex bg-gray-700 rounded-lg p-1 mb-6">
                <button
                  onClick={() => { setIsLogin(true); setError(''); }}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    isLogin ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Login
                </button>
                <button
                  onClick={() => { setIsLogin(false); setError(''); }}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    !isLogin ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <AnimatePresence>
                  {!isLogin && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <motion.div variants={inputVariants} whileFocus="focus" className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Full Name"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                          required={!isLogin}
                        />
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div variants={inputVariants} whileFocus="focus" className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    required
                  />
                </motion.div>

                <motion.div variants={inputVariants} whileFocus="focus" className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg py-3 pl-10 pr-10 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </motion.div>

                {error && (
                  <p className="text-red-400 text-sm text-center">{error}</p>
                )}

                <motion.button
                  type="submit"
                  disabled={isLoading || otpSending}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold py-3 px-4 rounded-lg hover:from-blue-700 hover:to-cyan-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading || otpSending ? (
                    <div className="flex items-center justify-center space-x-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                      <span>{otpSending ? 'Sending OTP...' : 'Processing...'}</span>
                    </div>
                  ) : (
                    isLogin ? 'Sign In' : 'Create Account'
                  )}
                </motion.button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-gray-400 text-sm">
                  {isLogin ? "New to FloatChat?" : "Already have an account?"}
                  <button
                    onClick={() => { setIsLogin(!isLogin); setError(''); }}
                    className="text-blue-400 hover:text-blue-300 ml-1 font-medium"
                  >
                    {isLogin ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
              </div>
            </motion.div>
          )}

          {/* ═══ STEP 2: OTP VERIFICATION ═══ */}
          {step === 'otp' && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="text-center mb-6">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <ShieldCheck className="w-7 h-7 text-blue-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-1">Verify Your Email</h2>
                <p className="text-gray-400 text-sm">
                  We sent a 6-digit code to <span className="text-blue-400 font-medium">{formData.email}</span>
                </p>
              </div>

              {/* OTP Inputs */}
              <div className="flex justify-center gap-2 mb-6" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className={`w-12 h-14 text-center text-xl font-bold rounded-lg border-2 bg-gray-700 text-white outline-none transition-all ${
                      digit
                        ? 'border-blue-500 ring-2 ring-blue-500/20'
                        : 'border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                  />
                ))}
              </div>

              {otpError && (
                <p className="text-red-400 text-sm text-center mb-4">{otpError}</p>
              )}

              {/* Verify Button */}
              <motion.button
                onClick={handleVerifyOtp}
                disabled={otpVerifying || otp.join('').length !== 6}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold py-3 px-4 rounded-lg hover:from-blue-700 hover:to-cyan-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed mb-4"
              >
                {otpVerifying ? (
                  <div className="flex items-center justify-center space-x-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    />
                    <span>Verifying...</span>
                  </div>
                ) : (
                  'Verify OTP'
                )}
              </motion.button>

              {/* Resend + Back */}
              <div className="flex items-center justify-between text-sm">
                <button
                  onClick={() => { setStep('credentials'); setOtp(['', '', '', '', '', '']); setOtpError(''); }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleResendOtp}
                  disabled={otpSending}
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${otpSending ? 'animate-spin' : ''}`} />
                  {otpSending ? 'Sending...' : 'Resend OTP'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default AuthScreen;