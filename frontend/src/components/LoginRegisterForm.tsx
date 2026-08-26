import React, { useState } from 'react';
import { useForumAuth } from '../auth/AuthContext';

type Step = 'email' | 'login' | 'register';

export function LoginRegisterForm() {
  const { checkEmail, login, register, isAuthenticating, authError } = useForumAuth();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repassword, setRepassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    try {
      const status = await checkEmail(email);
      setStep(status === 'register' ? 'register' : 'login');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'E-Mail-Pruefung fehlgeschlagen');
    }
  }

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    try {
      await login(email, password);
    } catch {
      // authError from context already reflects this - nothing extra to do.
    }
  }

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (password !== repassword) {
      setLocalError('Passwoerter stimmen nicht ueberein');
      return;
    }
    try {
      await register(email, password, repassword);
    } catch {
      // authError from context already reflects this - nothing extra to do.
    }
  }

  const error = localError || authError;

  return (
    <div className="forum-thread mx-auto max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-50">Anmelden</h2>

      {step === 'email' && (
        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <label className="block text-sm text-gray-700 dark:text-gray-300">
            E-Mail
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Weiter
          </button>
        </form>
      )}

      {step === 'login' && (
        <form onSubmit={handleLoginSubmit} className="space-y-3">
          <p className="text-sm text-gray-500">{email}</p>
          <label className="block text-sm text-gray-700 dark:text-gray-300">
            Passwort
            <input
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep('email')}
              className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600"
            >
              Zurueck
            </button>
            <button
              type="submit"
              disabled={isAuthenticating}
              className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isAuthenticating ? 'Anmelden…' : 'Anmelden'}
            </button>
          </div>
        </form>
      )}

      {step === 'register' && (
        <form onSubmit={handleRegisterSubmit} className="space-y-3">
          <p className="text-sm text-gray-500">{email} ist neu — Passwort festlegen</p>
          <label className="block text-sm text-gray-700 dark:text-gray-300">
            Passwort
            <input
              type="password"
              required
              autoFocus
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            />
          </label>
          <label className="block text-sm text-gray-700 dark:text-gray-300">
            Passwort wiederholen
            <input
              type="password"
              required
              autoComplete="new-password"
              value={repassword}
              onChange={(e) => setRepassword(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep('email')}
              className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600"
            >
              Zurueck
            </button>
            <button
              type="submit"
              disabled={isAuthenticating}
              className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isAuthenticating ? 'Registrieren…' : 'Registrieren'}
            </button>
          </div>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
