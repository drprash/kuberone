import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authAPI } from '../lib/api';
import toast from 'react-hot-toast';
import { User, Mail, Lock, Home } from 'lucide-react';
import { CURRENCIES } from '../lib/currencies';

type RegisterFormData = {
  first_name: string;
  last_name: string;
  family_name: string;
  email: string;
  password: string;
  confirm_password: string;
  base_currency: string;
};

const STRENGTH_LEVELS = [
  { label: 'Weak', bar: 'bg-red-500', text: 'text-red-600' },
  { label: 'Fair', bar: 'bg-orange-400', text: 'text-orange-500' },
  { label: 'Good', bar: 'bg-yellow-400', text: 'text-yellow-600' },
  { label: 'Strong', bar: 'bg-green-500', text: 'text-green-600' },
];

const getPasswordStrength = (pwd: string) => {
  if (!pwd) return null;
  let score = 0;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return { score, ...STRENGTH_LEVELS[score - 1] };
};

const inputCls = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500";
const inputWithIconCls = "w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500";
const inputSmIconCls = "w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500";
const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1";

export default function Register() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterFormData>({
    defaultValues: { base_currency: 'INR' },
  });
  const passwordValue = watch('password');
  const strength = getPasswordStrength(passwordValue);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data: RegisterFormData) => {
    const { confirm_password, ...payload } = data;
    setLoading(true);
    try {
      const response = await authAPI.register(payload);
      setAuth(response);
      toast.success('Family account created successfully!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-center mb-2 text-gray-900 dark:text-white">Create Family Account</h2>
      <p className="text-sm text-center text-gray-600 dark:text-gray-400 mb-4">
        Creates a new Family and its first Admin account.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>First Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                {...register('first_name', { required: 'First name is required' })}
                type="text"
                className={inputSmIconCls}
                placeholder="John"
              />
            </div>
            {errors.first_name && <p className="text-red-500 text-xs mt-1">{errors.first_name.message}</p>}
          </div>

          <div>
            <label className={labelCls}>Last Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                {...register('last_name', { required: 'Last name is required' })}
                type="text"
                className={inputSmIconCls}
                placeholder="Doe"
              />
            </div>
            {errors.last_name && <p className="text-red-500 text-xs mt-1">{errors.last_name.message}</p>}
          </div>
        </div>

        <div>
          <label className={labelCls}>Family Name</label>
          <div className="relative">
            <Home className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              {...register('family_name', { required: 'Family name is required' })}
              type="text"
              className={inputWithIconCls}
              placeholder="The Smith Family"
            />
          </div>
          {errors.family_name && <p className="text-red-500 text-sm mt-1">{errors.family_name.message}</p>}
        </div>

        <div>
          <label className={labelCls}>Base Currency</label>
          <select
            {...register('base_currency')}
            className={inputCls}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              {...register('email', { required: 'Email is required' })}
              type="email"
              className={inputWithIconCls}
              placeholder="you@example.com"
            />
          </div>
          {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className={labelCls}>Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'Password must be at least 8 characters' },
              })}
              type="password"
              className={inputWithIconCls}
              placeholder="••••••••"
            />
          </div>
          {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
          {strength && (
            <div className="mt-2">
              <div className="flex gap-1 h-1.5">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-full ${i <= strength.score ? strength.bar : 'bg-gray-200 dark:bg-gray-600'}`}
                  />
                ))}
              </div>
              <p className={`text-xs mt-1 ${strength.text}`}>{strength.label}</p>
            </div>
          )}
        </div>

        <div>
          <label className={labelCls}>Confirm Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              {...register('confirm_password', {
                required: 'Please confirm your password',
                validate: (value) => value === passwordValue || 'Passwords do not match',
              })}
              type="password"
              className={inputWithIconCls}
              placeholder="••••••••"
            />
          </div>
          {errors.confirm_password && (
            <p className="text-red-500 text-sm mt-1">{errors.confirm_password.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="text-center mt-4 text-gray-600 dark:text-gray-300 text-sm">
        Already have an account?{' '}
        <Link to="/login" className="text-indigo-600 hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}
