import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useAuthStore();
  const { language, toggleLanguage, t } = useLanguage();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error(t('Please fill in all fields'));
      return;
    }

    try {
      await login(email, password);
      toast.success(t('Login successful!'));
      navigate('/dashboard');
    } catch (error) {
      toast.error(t('Invalid email or password'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 relative">
      <button
        type="button"
        onClick={toggleLanguage}
        className="absolute top-6 right-6 px-3 py-2 bg-white/90 dark:bg-gray-800 text-sm rounded-lg shadow"
      >
        {language === 'en' ? t('Tamil') : t('English')}
      </button>
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t('Inventory Manager')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {t('Sign in to your account')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('Email Address')}
              </label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder={t('Enter email address')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('Password')}
              </label>
              <input
                id="password"
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={isLoading}
            >
              {isLoading ? t('Signing in...') : t('Sign In')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            {t("Don't have an account?")}{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-500 font-medium">
              {t('Register here')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
