import { useLanguage } from '../../contexts/LanguageContext';

interface HealthScoreGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function HealthScoreGauge({ score, size = 'md' }: HealthScoreGaugeProps) {
  const { t } = useLanguage();
  const sizeClasses = {
    sm: 'w-24 h-24',
    md: 'w-32 h-32',
    lg: 'w-40 h-40',
  };

  const getColor = (score: number) => {
    if (score >= 80) return { stroke: '#10b981', text: 'text-green-600' };
    if (score >= 60) return { stroke: '#f59e0b', text: 'text-yellow-600' };
    return { stroke: '#ef4444', text: 'text-red-600' };
  };

  const { stroke, text } = getColor(score);
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className={`relative ${sizeClasses[size]}`}>
      <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          stroke="#e5e7eb"
          strokeWidth="8"
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          stroke={stroke}
          strokeWidth="8"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center flex-col">
        <span className={`text-2xl font-bold ${text}`}>{score}</span>
        <span className="text-xs text-gray-500">{t('Health Score')}</span>
      </div>
    </div>
  );
}
