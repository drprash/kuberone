import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authAPI } from '../lib/api';
import toast from 'react-hot-toast';
import { Mail, Lock, Key } from 'lucide-react';

type LoginFormData = {
  email: string;
  password: string;
};

const inputCls = "w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500";

export default function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [showSetPasswordMode, setShowSetPasswordMode] = useState(false);
  const [setupToken, setSetupToken] = useState('');
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>();

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    try {
      const response = await authAPI.login(data);
      setAuth(response);
      toast.success(`Welcome back, ${response.user.first_name}!`);
      navigate('/dashboard');
    } catch (error: any) {
      const detail = error?.response?.data?.detail || '';
      const normalized = typeof detail === 'string' ? detail.toLowerCase() : '';

      if (normalized.includes('set your password') || normalized.includes('activation token')) {
        toast.error('You need to set your password first with your activation token');
        setShowSetPasswordMode(true);
      } else if (normalized.includes('invalid credentials')) {
        toast.error('Wrong email or password');
      } else {
        toast.error(typeof detail === 'string' && detail ? detail : 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetPasswordWithToken = () => {
    if (!setupToken.trim()) {
      toast.error('Please enter your activation token');
      return;
    }
    navigate(`/set-password?token=${encodeURIComponent(setupToken)}`);
  };

  if (showSetPasswordMode) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">New Member Setup</h2>

        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4 text-sm text-slate-700 dark:text-slate-300">
          <p className="font-semibold mb-1">Welcome to KuberOne!</p>
          <p>If you were added to the family, use your activation token below to set your password.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Activation Token</label>
          <div className="relative">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={setupToken}
              onChange={(e) => setSetupToken(e.target.value)}
              className={inputCls}
              placeholder="Paste your activation token here"
            />
          </div>
        </div>

        <button
          onClick={handleSetPasswordWithToken}
          className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-medium"
        >
          Set Password
        </button>

        <button
          onClick={() => setShowSetPasswordMode(false)}
          className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium"
        >
          Back to Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">Sign In</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              {...register('email', { required: 'Email is required' })}
              type="email"
              className={inputCls}
              placeholder="you@example.com"
            />
          </div>
          {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              {...register('password', { required: 'Password is required' })}
              type="password"
              className={inputCls}
              placeholder="••••••••"
            />
          </div>
          {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <button
          type="button"
          onClick={() => setShowSetPasswordMode(true)}
          className="w-full text-indigo-600 hover:text-indigo-700 text-sm font-medium"
        >
          Set password with activation token?
        </button>
      </form>

      <div className="border-t dark:border-gray-700 pt-4 text-center">
        <p className="text-gray-600 dark:text-gray-300 text-sm">
          Creating a new family?{' '}
          <Link to="/register" className="text-indigo-600 hover:underline font-medium">
            Create Family Admin Account
          </Link>
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Member accounts are created by your Family Admin.
        </p>
      </div>
    </div>
  );
}
