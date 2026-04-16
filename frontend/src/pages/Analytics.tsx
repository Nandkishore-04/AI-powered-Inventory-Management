import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import {
  InventoryAnalytics,
  CategoryAnalytics,
  SupplierPerformance,
  SmartReorderSuggestions,
} from '../types';
import {
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
  AlertTriangle,
  Activity,
  Download,
  RefreshCw,
  ShoppingCart,
  BarChart3,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function Analytics() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<InventoryAnalytics | null>(null);
  const [categoryAnalytics, setCategoryAnalytics] = useState<CategoryAnalytics | null>(null);
  const [supplierPerformance, setSupplierPerformance] = useState<SupplierPerformance | null>(null);
  const [reorderSuggestions, setReorderSuggestions] = useState<SmartReorderSuggestions | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(30);
  const [activeTab, setActiveTab] = useState<'overview' | 'categories' | 'suppliers' | 'reorder'>('overview');

  useEffect(() => {
    loadAnalytics();
  }, [selectedPeriod]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [analyticsRes, categoriesRes, suppliersRes, reorderRes] = await Promise.all([
        api.getAnalytics(selectedPeriod),
        api.getCategoryAnalytics(),
        api.getSupplierPerformance(selectedPeriod),
        api.getSmartReorderSuggestions(),
      ]);

      setAnalytics(analyticsRes.data);
      setCategoryAnalytics(categoriesRes.data);
      setSupplierPerformance(suppliersRes.data);
      setReorderSuggestions(reorderRes.data);
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('Failed to load analytics'));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'inventory' | 'transactions') => {
    try {
      const blob = await api.exportAnalyticsData(type);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-export-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(
        type === 'inventory'
          ? `${t('Inventory Data')} ${t('Export')} OK`
          : `${t('Transactions')} ${t('Export')} OK`
      );
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('Failed to export data'));
    }
  };

  const handleRunAutoReorder = async () => {
    try {
      const result = await api.runAutoReorder();
      toast.success(`${t('Auto-reorder completed')}: ${result.data.posCreated} POs`);
      loadAnalytics();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('Failed to run auto-reorder'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{t('No analytics data available')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Analytics Dashboard')}</h1>
          <p className="text-gray-600 mt-1">{t('Comprehensive inventory insights and forecasting')}</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value={7}>{t('7 days')}</option>
            <option value={30}>{t('30 days')}</option>
            <option value={90}>{t('90 days')}</option>
          </select>
          <button
            onClick={loadAnalytics}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <div className="relative group">
            <button className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              <Download className="w-4 h-4" />
              <span>{t('Export')}</span>
            </button>
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 hidden group-hover:block z-10">
              <button
                onClick={() => handleExport('inventory')}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 rounded-t-lg"
              >
                {t('Inventory Data')}
              </button>
              <button
                onClick={() => handleExport('transactions')}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 rounded-b-lg"
              >
                {t('Transactions')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: t('Overview'), icon: Activity },
            { id: 'categories', label: t('Categories'), icon: BarChart3 },
            { id: 'suppliers', label: t('Suppliers'), icon: Package },
            { id: 'reorder', label: t('Reorder'), icon: ShoppingCart },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">{t('Total Products')}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {analytics.overview.totalProducts}
                  </p>
                </div>
                <div className="p-3 bg-indigo-100 rounded-lg">
                  <Package className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">{t('Inventory Value')}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    ₹{analytics.overview.inventoryValue.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">{t('Low Stock Items')}</p>
                  <p className="text-2xl font-bold text-orange-600 mt-1">
                    {analytics.overview.lowStockCount}
                  </p>
                </div>
                <div className="p-3 bg-orange-100 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">{t('Health Score')}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {analytics.overview.healthScore}/100
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${
                  analytics.overview.healthScore >= 80 ? 'bg-green-100' :
                  analytics.overview.healthScore >= 60 ? 'bg-yellow-100' : 'bg-red-100'
                }`}>
                  <Activity className={`w-6 h-6 ${
                    analytics.overview.healthScore >= 80 ? 'text-green-600' :
                    analytics.overview.healthScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                  }`} />
                </div>
              </div>
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{t('Top Products by Value')}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Product')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Stock')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Unit Price')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Total Value')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Turnover Rate')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {analytics.topProducts.slice(0, 10).map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{product.name}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-600">{product.currentStock}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-600">
                        ₹{product.unitPrice.toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                        ₹{product.totalValue.toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 text-sm text-right">
                        <span className={`inline-flex items-center ${
                          product.turnoverRate > 1 ? 'text-green-600' : 'text-gray-600'
                        }`}>
                          {product.turnoverRate > 1 ? (
                            <TrendingUp className="w-4 h-4 mr-1" />
                          ) : (
                            <TrendingDown className="w-4 h-4 mr-1" />
                          )}
                          {product.turnoverRate.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Monthly Trends */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('Monthly Trends')}</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Month')}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Purchases')}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Sales')}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Adjustments')}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Net Change')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {analytics.monthlyTrends.map((trend) => (
                    <tr key={trend.month} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{trend.month}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-600">+{trend.purchases}</td>
                      <td className="px-4 py-3 text-sm text-right text-red-600">-{trend.sales}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{trend.adjustments}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        <span className={trend.netChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {trend.netChange >= 0 ? '+' : ''}{trend.netChange}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Recommendations */}
          {analytics.recommendations && analytics.recommendations.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-indigo-900 mb-3">{t('AI Recommendations')}</h2>
              <ul className="space-y-2">
                {analytics.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-indigo-600 mt-1">•</span>
                    <span className="text-indigo-800">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && categoryAnalytics && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{t('Category Analysis')}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {categoryAnalytics.totalCategories} {t('categories tracked')}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Category')}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Products')}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Total Stock')}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Avg Price')}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Total Value')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {categoryAnalytics.categories.map((cat) => (
                  <tr key={cat.category} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {cat.category || t('Uncategorized')}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-600">{cat.productCount}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-600">{cat.totalStock}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-600">
                      ₹{cat.avgPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                      ₹{cat.totalValue.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Suppliers Tab */}
      {activeTab === 'suppliers' && supplierPerformance && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{t('Supplier Performance')}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {t('Total spent')}: ₹{supplierPerformance.totalSpent.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Supplier')}</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('Rating')}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Products')}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Orders')}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Total Spent')}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Avg Order')}</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('Performance')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {supplierPerformance.suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{supplier.name}</td>
                    <td className="px-6 py-4 text-sm text-center text-gray-600">
                      ⭐ {supplier.rating.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-600">{supplier.productCount}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-600">{supplier.orderCount}</td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                      ₹{supplier.totalSpent.toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-600">
                      ₹{supplier.avgOrderValue.toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        supplier.performance === 'Excellent' ? 'bg-green-100 text-green-800' :
                        supplier.performance === 'Good' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {t(supplier.performance)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reorder Tab */}
      {activeTab === 'reorder' && reorderSuggestions && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600 text-sm">{t('Items Need Reorder')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{reorderSuggestions.totalItems}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600 text-sm">{t('Estimated Cost')}</p>
              <p className="text-3xl font-bold text-indigo-600 mt-2">
                ₹{reorderSuggestions.totalEstimatedCost.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">{t('Auto-Reorder')}</p>
                <p className="text-sm text-gray-500 mt-2">{t('Run automated reordering')}</p>
              </div>
              <button
                onClick={handleRunAutoReorder}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center space-x-2"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>{t('Run Now')}</span>
              </button>
            </div>
          </div>

          {/* AI Optimization */}
          {reorderSuggestions.aiOptimization && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-indigo-900 mb-2">{t('AI Optimization Advice')}</h3>
              <p className="text-indigo-800 whitespace-pre-line">{reorderSuggestions.aiOptimization}</p>
            </div>
          )}

          {/* Reorder Suggestions Table */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{t('Smart Reorder Suggestions')}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Product')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Supplier')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Current')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Reorder Level')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Suggested Qty')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Est. Cost')}</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('Priority')}</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('Auto-Rule')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reorderSuggestions.suggestions.map((suggestion) => (
                    <tr key={suggestion.productId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{suggestion.productName}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{suggestion.supplierName || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-600">{suggestion.currentStock}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-600">{suggestion.reorderLevel}</td>
                      <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                        {suggestion.suggestedQuantity}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        ₹{suggestion.estimatedCost.toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 text-sm text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          suggestion.priority === 'URGENT' ? 'bg-red-100 text-red-800' :
                          suggestion.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                          suggestion.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {t(suggestion.priority)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-center">
                        {suggestion.hasAutoRule ? (
                          <span className="text-green-600">✓</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
