import React, { useState } from 'react';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { X, Mail, Lock, User, ShieldCheck, CheckCircle2, RefreshCw } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  unsavedGuestCount: number;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, unsavedGuestCount }) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [awaitingVerification, setAwaitingVerification] = useState(false);

  if (!isOpen) return null;

  const formatAuthError = (err: unknown): string => {
    const authErr = err as { code?: unknown; message?: unknown } | null;
    const code = typeof authErr?.code === 'string' ? authErr.code : '';
    const message = typeof authErr?.message === 'string' ? authErr.message : '';
    if (code === 'auth/operation-not-allowed') {
      return 'Email/Password sign-in is not yet enabled in Firebase Console (Authentication → Sign-in method). You can sign in immediately with Google below.';
    }
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found'
    ) {
      return 'Incorrect email or password. Please check your details or reset your password.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'An account with this email already exists. Try signing in instead.';
    }
    if (code === 'auth/weak-password') {
      return 'Please choose a password with at least 6 characters.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'Sign-in window was closed before completing.';
    }
    return message || 'Could not complete sign-in. Please try again.';
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setInfoMsg('');
    setIsLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(formatAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setIsLoading(true);

    try {
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email.trim());
        setInfoMsg('Password reset link sent! Check your inbox.');
        setIsLoading(false);
        return;
      }

      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) {
          await updateProfile(cred.user, { displayName: name.trim() });
        }
        await sendEmailVerification(cred.user);
        setAwaitingVerification(true);
        setInfoMsg('Account created! We sent a verification link to your email.');
      } else {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        if (!cred.user.emailVerified) {
          setAwaitingVerification(true);
          setInfoMsg('Please verify your email address to unlock cloud saving.');
        } else {
          onClose();
        }
      }
    } catch (err: unknown) {
      setErrorMsg(formatAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    if (!auth.currentUser) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        setAwaitingVerification(false);
        onClose();
      } else {
        setErrorMsg('Email is not verified yet—check your inbox or spam folder.');
      }
    } catch (err: unknown) {
      setErrorMsg(formatAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!auth.currentUser) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      await sendEmailVerification(auth.currentUser);
      setInfoMsg('Verification email resent!');
    } catch (err: unknown) {
      setErrorMsg(formatAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-2xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#222634] flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold">
              {mode === 'signup'
                ? 'Create your account'
                : mode === 'reset'
                  ? 'Reset password'
                  : 'Sign in to RecallFlow'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Powered by Firebase Authentication & Cloud Firestore
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1D2230]"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {unsavedGuestCount > 0 && (
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-xs text-blue-800 dark:text-blue-200 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
              <span>
                You added <strong>{unsavedGuestCount}</strong> new cue
                {unsavedGuestCount > 1 ? 's' : ''} in Preview Mode—they will sync automatically once
                you sign in.
              </span>
            </div>
          )}

          {awaitingVerification ? (
            <div className="space-y-4 text-sm">
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Check your inbox</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  We sent a verification link to <strong>{auth.currentUser?.email || email}</strong>
                  . Click the link, then press the button below.
                </p>
              </div>

              {errorMsg && <p className="text-xs text-rose-600 dark:text-rose-400">{errorMsg}</p>}
              {infoMsg && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">{infoMsg}</p>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCheckVerification}
                  disabled={isLoading}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>I've Verified — Continue</span>
                </button>
                <button
                  onClick={handleResendVerification}
                  disabled={isLoading}
                  className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-[#222634] text-xs font-medium hover:bg-slate-50 dark:hover:bg-[#1B1F2C]"
                >
                  Resend
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Google Sign-In */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-[#222634] bg-white dark:bg-[#0B0D12] hover:bg-slate-50 dark:hover:bg-[#1A1E2B] text-sm font-medium flex items-center justify-center gap-2.5 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="flex items-center gap-3 text-xs text-slate-400">
                <div className="h-px flex-1 bg-slate-200 dark:bg-[#222634]" />
                <span>or with email</span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-[#222634]" />
              </div>

              {/* Email / Password Form */}
              <form onSubmit={handleEmailSubmit} className="space-y-3 text-sm">
                {mode === 'signup' && (
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] focus:outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                )}

                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] focus:outline-none focus:border-blue-500 text-sm"
                  />
                </div>

                {mode !== 'reset' && (
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="Password (6+ characters)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] focus:outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                )}

                {errorMsg && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 p-2.5 rounded-lg">
                    {errorMsg}
                  </p>
                )}

                {infoMsg && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 p-2.5 rounded-lg">
                    {infoMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
                >
                  {isLoading
                    ? 'Working...'
                    : mode === 'signup'
                      ? 'Create Account & Send Verification'
                      : mode === 'reset'
                        ? 'Send Reset Email'
                        : 'Sign In'}
                </button>
              </form>

              {/* Footer Mode Switches */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
                {mode === 'signin' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signup');
                        setErrorMsg('');
                      }}
                      className="hover:text-slate-900 dark:hover:text-white font-medium"
                    >
                      New here? Create account
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('reset');
                        setErrorMsg('');
                      }}
                      className="hover:text-slate-900 dark:hover:text-white"
                    >
                      Forgot password?
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setErrorMsg('');
                    }}
                    className="hover:text-slate-900 dark:hover:text-white font-medium"
                  >
                    Back to Sign In
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
