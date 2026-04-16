import { useLanguage } from '../../contexts/LanguageContext';

interface TrendChartProps {
  data: Array<{
    month: string;
    purchases: number;
    sales: number;
    adjustments: number;
    netChange: number;
  }>;
}

export default function TrendChart({ data }: TrendChartProps) {
  const { t } = useLanguage();
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {t('No trend data available')}
      </div>
    );
  }

  const maxValue = Math.max(
    ...data.flatMap((d) => [
      Math.abs(d.purchases),
      Math.abs(d.sales),
      Math.abs(d.adjustments),
    ])
  );

  const getBarHeight = (value: number) => {
    return (Math.abs(value) / maxValue) * 100;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end space-x-4 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span className="text-gray-600">{t('Purchases')}</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span className="text-gray-600">{t('Sales')}</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-500 rounded"></div>
          <span className="text-gray-600">{t('Adjustments')}</span>
        </div>
      </div>

      <div className="flex items-end justify-between h-48 border-b border-gray-200">
        {data.map((item, index) => (
          <div
            key={index}
            className="flex-1 flex flex-col items-center justify-end space-y-1 group relative"
          >
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded-lg p-2 whitespace-nowrap z-10">
              <div>Purchases: +{item.purchases}</div>
              <div>Sales: -{item.sales}</div>
              <div>Adjustments: {item.adjustments}</div>
              <div className="font-bold mt-1">
                Net: {item.netChange >= 0 ? '+' : ''}
                {item.netChange}
              </div>
            </div>

            {/* Bars */}
            <div className="w-full px-1 flex space-x-1 items-end h-full">
              {/* Purchases bar */}
              <div
                className="flex-1 bg-green-500 rounded-t transition-all duration-300 hover:bg-green-600"
                style={{ height: `${getBarHeight(item.purchases)}%` }}
              />
              {/* Sales bar */}
              <div
                className="flex-1 bg-red-500 rounded-t transition-all duration-300 hover:bg-red-600"
                style={{ height: `${getBarHeight(item.sales)}%` }}
              />
              {/* Adjustments bar */}
              <div
                className="flex-1 bg-blue-500 rounded-t transition-all duration-300 hover:bg-blue-600"
                style={{ height: `${getBarHeight(item.adjustments)}%` }}
              />
            </div>

            {/* Month label */}
            <div className="text-xs text-gray-600 mt-2 transform -rotate-45 origin-top-left w-16">
              {item.month}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
