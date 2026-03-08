import { Outlet } from 'react-router-dom';

const AuthLayout = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-md p-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-indigo-600">KuberOne</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Portfolio Tracking & Wealth Intelligence</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;
