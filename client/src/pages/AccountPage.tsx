import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export function AccountPage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Le nuove password non coincidono');
      return;
    }

    setLoading(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setSuccess('Password aggiornata con successo');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-md">
      <Link to="/" className="mb-6 inline-flex text-sm text-gray-400 transition hover:text-accent-light">
        ← Torna alla home
      </Link>
      <h1 className="mb-2 text-2xl font-bold">Il tuo account</h1>
      <p className="mb-6 text-sm text-gray-400">Gestisci le impostazioni del profilo</p>

      <div className="mb-6 rounded-xl border border-white/10 bg-surface-card p-4">
        <p className="text-sm text-gray-400">Username</p>
        <p className="font-medium">{user.username}</p>
        <p className="mt-3 text-sm text-gray-400">Email</p>
        <p className="font-medium">{user.email}</p>
      </div>

      <h2 className="mb-4 text-lg font-semibold">Cambia password</h2>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-white/10 bg-surface-card p-6">
        {error && <p className="rounded bg-red-500/10 p-2 text-sm text-red-400">{error}</p>}
        {success && <p className="rounded bg-green-500/10 p-2 text-sm text-green-400">{success}</p>}
        <div>
          <label className="mb-1 block text-sm text-gray-400">Password attuale</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 outline-none focus:border-accent"
            required
            autoComplete="current-password"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-400">Nuova password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 outline-none focus:border-accent"
            minLength={8}
            required
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-400">Conferma nuova password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 outline-none focus:border-accent"
            minLength={8}
            required
            autoComplete="new-password"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accent py-2 font-medium text-white hover:bg-accent/80 disabled:opacity-50"
        >
          {loading ? 'Salvataggio...' : 'Aggiorna password'}
        </button>
      </form>
    </div>
  );
}
