import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Hotel,
  Lock,
  LogOut,
  ShieldCheck,
  User,
} from 'lucide-react';
import { api, setAuthToken } from '../../services/api';
import { googleSignIn } from '../../services/googleAuth';
import { AuthUser } from '../../types';
import { GoogleSignInButton } from './GoogleSignInButton';

interface LoginScreenProps {
  isGoogleConnected: boolean;
  googleEmail?: string | null;
  connectedSheet?: {
    spreadsheetId: string;
    title: string;
    spreadsheetUrl: string;
  } | null;
  onGoogleConnected: (info: {
    email: string | null;
    spreadsheetId: string;
    title: string;
    spreadsheetUrl: string;
    propertyName?: string;
  }) => void;
  onGoogleDisconnect: () => Promise<void> | void;
  onLoginSuccess: (user: AuthUser) => void;
  propertyName?: string;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  isGoogleConnected,
  googleEmail,
  connectedSheet,
  onGoogleConnected,
  onGoogleDisconnect,
  onLoginSuccess,
  propertyName = 'Azure Horizon Boutique Hotel',
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleConnect = async () => {
    setIsConnectingGoogle(true);
    setError(null);
    try {
      const { user } = await googleSignIn();
      const connected = await api.connectGoogleStorage();
      onGoogleConnected({
        email: user.email,
        spreadsheetId: connected.spreadsheetId,
        title: connected.title,
        spreadsheetUrl: connected.spreadsheetUrl,
        propertyName: connected.propertyName,
      });
    } catch (err: any) {
      setError(
        err?.message ||
          'Failed to connect Google Sheets. Please allow Google Drive & Sheets permissions.'
      );
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await api.login(username.trim(), password);
      setAuthToken(res.token);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Invalid username or password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left Architectural Brand Panel (Desktop) */}
      <div className="relative hidden lg:flex lg:w-[46%] xl:w-[48%] flex-col justify-between bg-slate-950 p-12 text-white overflow-hidden">
        {/* Subtle Architectural Grid Pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-blue-600/15 blur-3xl" />

        {/* Brand Mark */}
        <div className="relative z-10 flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Hotel className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-white block">StayFlow</span>
            <span className="text-xs text-slate-400">{propertyName}</span>
          </div>
        </div>

        {/* Center Editorial Copy */}
        <div className="relative z-10 max-w-md space-y-6">
          <h1 className="text-4xl font-bold tracking-tight text-white leading-[1.15] text-balance">
            Quiet precision for hotel room reservations.
          </h1>
          <p className="text-sm leading-relaxed text-slate-300">
            Manage room timelines, guest bookings, dynamic room categories, and staff access from a single Google Sheets-backed console.
          </p>

          <div className="pt-4 border-t border-slate-800/90 space-y-3.5 text-xs text-slate-300">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Unified Google Sheets persistence (StayFlow Hotel Data)</span>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0" />
              <span>Administrator-managed staff access without public sign-up</span>
            </div>
          </div>
        </div>

        {/* Quiet Footer */}
        <div className="relative z-10 text-xs text-slate-500">
          StayFlow Property Management · Authorized Personnel Only
        </div>
      </div>

      {/* Right Login Form Surface */}
      <div className="flex-1 flex flex-col justify-center items-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[420px] space-y-6">
          {/* Mobile Brand Header */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Hotel className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900 block">StayFlow</span>
              <span className="text-xs text-slate-500">{propertyName}</span>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {isGoogleConnected ? 'Sign in to workspace' : 'Connect Google Sheets'}
            </h2>
            <p className="text-sm text-slate-500">
              {isGoogleConnected
                ? 'Enter your staff credentials stored in your connected Google Sheet.'
                : 'Sign in with Google to link your StayFlow Google Sheet database.'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-xs space-y-5">
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-medium leading-relaxed">{error}</span>
              </div>
            )}

            {!isGoogleConnected ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 text-xs text-slate-600 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-slate-800">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Google Sheets Storage Setup</span>
                  </div>
                  <p className="leading-relaxed">
                    StayFlow loads and persists your Rooms, Room Types, Bookings, Staff Users, and Settings directly inside a single spreadsheet in your Google Drive (<strong className="text-slate-800">StayFlow Hotel Data</strong>).
                  </p>
                </div>

                <GoogleSignInButton
                  onClick={handleGoogleConnect}
                  isLoading={isConnectingGoogle}
                  label="Connect Google Sheets"
                />

                <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                  Your Google OAuth session stays strictly in memory and never saves tokens to browser storage.
                </p>
              </div>
            ) : (
              <>
                {/* Connected Google Sheet Pill Card */}
                <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/60 p-3.5 text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="font-bold text-emerald-950 truncate">
                        {connectedSheet?.title || 'StayFlow Hotel Data'}
                      </span>
                    </div>
                    {connectedSheet?.spreadsheetUrl && (
                      <a
                        href={connectedSheet.spreadsheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:underline shrink-0"
                      >
                        <span>Open</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-emerald-800/80">
                    <span className="truncate">{googleEmail || 'Google Workspace Connected'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        onGoogleDisconnect();
                      }}
                      className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900 shrink-0"
                    >
                      <LogOut className="h-3 w-3" />
                      <span>Switch Account</span>
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="login-username"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Username
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        id="login-username"
                        type="text"
                        autoComplete="username"
                        autoFocus
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter username"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-600/15 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-10 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-600/15 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 active:scale-[0.99] transition disabled:opacity-50"
                  >
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>
              </>
            )}
          </div>

          <p className="text-center text-xs text-slate-500 leading-relaxed">
            New accounts can only be provisioned by an Administrator inside the Users Management panel.
          </p>
        </div>
      </div>
    </div>
  );
};
