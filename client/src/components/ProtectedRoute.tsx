import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="py-20 text-center text-gray-400">Caricamento...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
