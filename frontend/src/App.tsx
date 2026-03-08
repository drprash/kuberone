import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';

const AuthLayout = React.lazy(() => import('./layouts/AuthLayout'));
const MainLayout = React.lazy(() => import('./layouts/MainLayout'));

const Login = React.lazy(() => import('./components/Login'));
const Register = React.lazy(() => import('./pages/Register'));
const SetPassword = React.lazy(() => import('./pages/SetPassword'));
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const Accounts = React.lazy(() => import('./components/Accounts'));
const Holdings = React.lazy(() => import('./components/Holdings'));
const Settings = React.lazy(() => import('./pages/Settings'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60 * 1000,
    },
  },
});

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
  </div>
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster position="top-right" />
        <React.Suspense fallback={<Spinner />}>
          <Routes>
            {/* Auth routes */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/set-password" element={<SetPassword />} />
            </Route>

            {/* Protected app routes */}
            <Route element={<MainLayout />}>
              <Route
                path="/dashboard"
                element={<PrivateRoute><Dashboard /></PrivateRoute>}
              />
              <Route
                path="/accounts"
                element={<PrivateRoute><Accounts /></PrivateRoute>}
              />
              <Route
                path="/holdings"
                element={<PrivateRoute><Holdings /></PrivateRoute>}
              />
              <Route
                path="/settings"
                element={<PrivateRoute><Settings /></PrivateRoute>}
              />
            </Route>

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </React.Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
