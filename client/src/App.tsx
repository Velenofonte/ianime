import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { LoginPage } from './pages/AuthPages';
import { CalendarPage } from './pages/CalendarPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { AccountPage } from './pages/AccountPage';
import { AnimeDetailPage } from './pages/AnimeDetailPage';
import { HomePage } from './pages/HomePage';
import { NewsPage } from './pages/NewsPage';
import { SuggestionsPage } from './pages/SuggestionsPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route
                index
                element={
                  <ProtectedRoute>
                    <HomePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="anime/:id"
                element={
                  <ProtectedRoute>
                    <AnimeDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route path="news" element={<NewsPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<Navigate to="/login" replace />} />
              <Route
                path="account"
                element={
                  <ProtectedRoute>
                    <AccountPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="preferiti"
                element={
                  <ProtectedRoute>
                    <FavoritesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="suggerimenti"
                element={
                  <ProtectedRoute>
                    <SuggestionsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="calendario"
                element={
                  <ProtectedRoute>
                    <CalendarPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
