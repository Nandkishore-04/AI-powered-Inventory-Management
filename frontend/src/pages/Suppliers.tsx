import { useEffect, useState } from 'react';
import { Search, Mail, Phone } from 'lucide-react';
import api from '../services/api';
import { Supplier } from '../types';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';

export default function Suppliers() {
  const { t } = useLanguage();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const response = await api.getSuppliers({ search });
      setSuppliers(response.data || []);
    } catch (error) {
      toast.error(t('Failed to load suppliers'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('Suppliers')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('Suppliers are auto-created from processed invoices')}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-200">
        {t('Manual supplier changes are disabled. Upload and process invoices to add or update suppliers.')}
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder={t('Search suppliers...')}
              className="input pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && loadSuppliers()}
            />
          </div>
          <button className="btn btn-primary" onClick={loadSuppliers}>
            {t('Search')}
          </button>
        </div>
      </div>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {suppliers.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            {t('No suppliers found yet. Upload an invoice to populate suppliers.')}
          </div>
        ) : (
          suppliers.map((supplier) => (
            <div key={supplier.id} className="card p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                    {supplier.name}
                  </h3>
                  {supplier.gstin && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      GSTIN: {supplier.gstin}
                    </p>
                  )}
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    supplier.activeStatus
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-400'
                  }`}
                >
                  {supplier.activeStatus ? t('Active') : t('Inactive')}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                {supplier.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Mail size={14} />
                    <span>{supplier.email}</span>
                  </div>
                )}
                {supplier.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Phone size={14} />
                    <span>{supplier.phone}</span>
                  </div>
                )}
                {supplier.city && supplier.state && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {supplier.city}, {supplier.state}
                  </p>
                )}
                {supplier.rating !== undefined && supplier.rating > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-500">★</span>
                    <span className="text-sm font-medium">{supplier.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                {t('Source: invoice ingestion workflow')}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
