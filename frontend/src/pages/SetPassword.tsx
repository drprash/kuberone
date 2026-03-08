import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Lock, Mail } from 'lucide-react';

type SetPasswordFormData = {
  password: string;
  confirmPassword: string;
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

const inputWithIconCls = "w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500";
const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1";

export default function SetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAuthStore();
  const [tokenInfo, setTokenInfo] = useState<{ email: string; expiresAt: string } | null>(null);
  const [verifyingToken, setVerifyingToken] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const token = searchParams.get('token');
  const { register, handleSubmit, formState: { errors }, watch } = useForm<SetPasswordFormData>();
  const password = watch('password');
  const strength = getPasswordStrength(password);

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setTokenError('No activation token provided');
        setVerifyingToken(false);
        return;
      }

      try {
        const response = await api.post('/auth/verify-activation-token', null, {
          params: { token },
        });

        if (response.data.valid) {
          setTokenInfo({
            email: response.data.user_email,
            expiresAt: response.data.expires_at,
          });
          setTokenError(null);
        } else {
          setTokenError('Activation token is invalid or expired');
        }
      } catch {
        setTokenError('Failed to verify activation token');
      } finally {
        setVerifyingToken(false);
      }
    };

    verifyToken();
  }, [token]);

  const onSubmit = async (data: SetPasswordFormData) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/set-password', {
        activation_token: token,
        password: data.password,
      });
      setAuth(response.data);
      toast.success('Password set successfully!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to set password');
    } finally {
      setLoading(false);
    }
  };

  if (verifyingToken) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (tokenError) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-center mb-4 text-gray-900 dark:text-white">Account Setup</h2>
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4 text-red-700 dark:text-red-300 text-center">
          <p className="font-semibold mb-1">Token Error</p>
          <p className="text-sm">{tokenError}</p>
          <p className="text-xs mt-2">Contact your family admin to get a new activation token.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-center mb-2 text-gray-900 dark:text-white">Complete Your Setup</h2>
      <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-4">Set your password to activate your account</p>

      {tokenInfo && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3 mb-4 text-sm">
          <p className="text-slate-700 dark:text-slate-300">
            <strong>Account:</strong> {tokenInfo.email}
          </p>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
            Token expires: {new Date(tokenInfo.expiresAt).toLocaleString()}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className={labelCls}>Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="email"
              value={tokenInfo?.email || ''}
              disabled
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Create Password</label>
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
              {...register('confirmPassword', {
                required: 'Please confirm your password',
                validate: (value) => value === password || 'Passwords do not match',
              })}
              type="password"
              className={inputWithIconCls}
              placeholder="••••••••"
            />
          </div>
          {errors.confirmPassword && (
            <p className="text-red-500 text-sm mt-1">{errors.confirmPassword.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
        >
          {loading ? 'Setting up account...' : 'Set Password & Activate Account'}
        </button>
      </form>
    </div>
  );
}
