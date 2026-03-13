import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: Props) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ username: '', email: '', password: '', login: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(form.login, form.password);
      } else {
        await register(form.username, form.email, form.password);
      }
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-sm"
          >
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition">
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold mb-6">
              {mode === 'login' ? 'Вход' : 'Регистрация'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <input
                  type="text"
                  placeholder="Имя пользователя"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  className="w-full bg-bg border border-white/10 rounded-xl px-4 py-3 text-white
                    focus:outline-none focus:border-accent/50 transition"
                  required
                />
              )}

              {mode === 'register' && (
                <input
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full bg-bg border border-white/10 rounded-xl px-4 py-3 text-white
                    focus:outline-none focus:border-accent/50 transition"
                  required
                />
              )}

              {mode === 'login' && (
                <input
                  type="text"
                  placeholder="Логин или email"
                  value={form.login}
                  onChange={e => setForm(f => ({ ...f, login: e.target.value }))}
                  className="w-full bg-bg border border-white/10 rounded-xl px-4 py-3 text-white
                    focus:outline-none focus:border-accent/50 transition"
                  required
                />
              )}

              <input
                type="password"
                placeholder="Пароль"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full bg-bg border border-white/10 rounded-xl px-4 py-3 text-white
                  focus:outline-none focus:border-accent/50 transition"
                required
              />

              {error && (
                <div className="text-danger text-sm bg-danger/10 px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent text-black font-bold py-3 rounded-xl
                  hover:bg-accent-dark transition disabled:opacity-50"
              >
                {loading ? '...' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                className="text-accent text-sm hover:underline"
              >
                {mode === 'login' ? 'Нет аккаунта? Регистрация' : 'Уже есть аккаунт? Войти'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
