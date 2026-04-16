import { useEffect, useState } from 'react';
import { X, TrendingUp, TrendingDown, AlertCircle, Loader } from 'lucide-react';
import api from '../../services/api';
import { DemandForecast } from '../../types';
import toast from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';

interface ForecastModalProps {
  productId: string;
  productName: string;
  onClose: () => void;
}

export default function ForecastModal({
  productId,
  productName,
  onClose,
}: ForecastModalProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [forecast, setForecast] = useState<DemandForecast | null>(null);
  const [forecastDays, setForecastDays] = useState(30);

  useEffect(() => {
    loadForecast();
  }, [forecastDays]);

  const loadForecast = async () => {
    try {
      setLoading(true);
      const response = await api.getDemandForecast(productId, forecastDays);
      setForecast(response.data);
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('Failed to load forecast'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{t('Demand Forecast')}</h2>
            <p className="text-sm text-gray-600 mt-1">{productName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Forecast Period Selector */}
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">
              {t('Forecast Period:')}
            </label>
            <select
              value={forecastDays}
              onChange={(e) => setForecastDays(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value={7}>{t('7 days')}</option>
              <option value={14}>{t('14 days')}</option>
              <option value={30}>{t('30 days')}</option>
              <option value={60}>{t('60 days')}</option>
              <option value={90}>{t('90 days')}</option>
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : forecast ? (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">{t('Current Stock')}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {forecast.forecast.currentStock}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">{t('Avg Daily Sales')}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {forecast.forecast.avgDailySales.toFixed(1)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">{t('Forecasted Demand')}</p>
                  <p className="text-2xl font-bold text-indigo-600 mt-1">
                    {forecast.forecast.forecastedDemand}
                  </p>
                </div>
              </div>

              {/* Trend Indicator */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{t('Trend Analysis')}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      {forecast.forecast.trend === 'increasing' ? (
                        <>
                          <TrendingUp className="w-6 h-6 text-green-600" />
                          <span className="text-lg font-bold text-green-600">
                            {t('Increasing')}
                          </span>
                        </>
                      ) : forecast.forecast.trend === 'decreasing' ? (
                        <>
                          <TrendingDown className="w-6 h-6 text-red-600" />
                          <span className="text-lg font-bold text-red-600">
                            {t('Decreasing')}
                          </span>
                        </>
                      ) : (
                        <>
                          <TrendingUp className="w-6 h-6 text-gray-600" />
                          <span className="text-lg font-bold text-gray-600">
                            {t('Stable')}
                          </span>
                        </>
                      )}
                      <span className="text-sm text-gray-600">
                        ({forecast.forecast.trendPercentage > 0 ? '+' : ''}
                        {forecast.forecast.trendPercentage}%)
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">{t('Confidence Level')}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            forecast.confidence >= 80
                              ? 'bg-green-500'
                              : forecast.confidence >= 60
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${forecast.confidence}%` }}
                        />
                      </div>
                      <span className="text-lg font-bold text-gray-900">
                        {forecast.confidence}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stockout Warning */}
              {forecast.forecast.needsReorder && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-orange-900">
                      {t('Reorder Recommended')}
                    </p>
                    <p className="text-sm text-orange-800 mt-1">
                      {t('Stock will run out in approximately')}{' '}
                      <span className="font-bold">
                        {forecast.forecast.daysUntilStockout} {t('days')}
                      </span>
                      . {t('Suggested order quantity:')}{' '}
                      <span className="font-bold">
                        {forecast.forecast.suggestedOrderQuantity} {t('units')}
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* AI Insights */}
              {forecast.aiInsights && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <p className="font-semibold text-indigo-900 mb-2">
                    {t('AI Insights')}
                  </p>
                  <p className="text-sm text-indigo-800 whitespace-pre-line">
                    {forecast.aiInsights}
                  </p>
                </div>
              )}

              {/* Forecast Details */}
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-600">
                  {t('Based on')} {forecast.historicalDataPoints} {t('days of historical data')}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {t('Forecast uses hybrid algorithm combining moving average, linear regression, and AI analysis')}
                </p>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">{t('No forecast data available')}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {t('Close')}
          </button>
          {forecast?.forecast.needsReorder && (
            <button
              onClick={() => {
                toast.success(t('Reorder feature will be available soon'));
                onClose();
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              {t('Create Reorder')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
