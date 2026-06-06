import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold">Accedi</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-white/10 bg-surface-card p-6">
        {error && <p className="rounded bg-red-500/10 p-2 text-sm text-red-400">{error}</p>}
        <div>
          <label className="mb-1 block text-sm text-gray-400">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 outline-none focus:border-accent"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-400">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 outline-none focus:border-accent"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accent py-2 font-medium text-white hover:bg-accent/80 disabled:opacity-50"
        >
          {loading ? 'Accesso...' : 'Accedi'}
        </button>
      </form>
    </div>
  );
}

export function RegisterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.register(username, email, password);
      navigate('/login');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold">Registrati</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-white/10 bg-surface-card p-6">
        {error && <p className="rounded bg-red-500/10 p-2 text-sm text-red-400">{error}</p>}
        <div>
          <label className="mb-1 block text-sm text-gray-400">Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2" required />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-400">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2" required />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-400">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2" minLength={8} required />
        </div>
        <button type="submit" disabled={loading} className="w-full rounded-lg bg-accent py-2 font-medium text-white disabled:opacity-50">
          {loading ? 'Registrazione...' : 'Registrati'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-gray-400">
        <Link to="/login" className="text-accent-light hover:underline">Hai già un account? Accedi</Link>
      </p>
    </div>
  );
}
