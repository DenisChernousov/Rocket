import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tag, Check, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';

interface Props {
  onSuccess: (amount: number, balance: number) => void;
}

export function PromoCodeInput({ onSuccess }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ amount: number } | null>(null);

  const handleSubmit = async () => {
    const trimmed = code.trim();
    if (!trimmed || loading) return;

    setError('');
    setSuccess(null);
    setLoading(true);

    try {
      const result = await api.bonus.redeemPromo(trimmed) as {
        amount: number;
        balance: number;
        code: string;
      };
      setSuccess({ amount: result.amount });
      setCode('');
      onSuccess(result.amount, result.balance);

      // Clear success message after 4 seconds
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неверный промокод');
      setTimeout(() => setError(''), 4000);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={code}
            onChange={e => {
              setCode(e.target.value.toUpperCase());
              setError('');
            }}
            onKeyDown={handleKeyDown}
            placeholder="Промокод"
            disabled={loading}
            className="w-full bg-bg border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm
              placeholder:text-gray-600 focus:outline-none focus:border-accent/50 transition
              disabled:opacity-50"
          />
        </div>
        <motion.button
          onClick={handleSubmit}
          disabled={!code.trim() || loading}
          whileTap={{ scale: 0.95 }}
          className="px-5 py-2.5 rounded-xl bg-purple text-white text-sm font-medium
            hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed
            whitespace-nowrap"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            'Применить'
          )}
        </motion.button>
      </div>

      {/* Feedback messages */}
      <AnimatePresence mode="wait">
        {success && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: -5, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -5, height: 0 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/10 border border-accent/20"
          >
            <Check className="w-4 h-4 text-accent flex-shrink-0" />
            <span className="text-accent text-sm font-medium">
              +${success.amount} зачислено на баланс!
            </span>
          </motion.div>
        )}

        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -5, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -5, height: 0 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-danger/10 border border-danger/20"
          >
            <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
            <span className="text-danger text-sm">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
