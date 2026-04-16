import { useState, useCallback, useEffect } from 'react';
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  Save,
  Eye,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { BillLineItem, PurchaseBill } from '../types';

interface UploadedFile {
  file: File;
  preview: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  message?: string;
}

export default function Invoices() {
  const { t } = useLanguage();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [processing, setProcessing] = useState(false);
  const [savedBills, setSavedBills] = useState<PurchaseBill[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);
  const [billDrafts, setBillDrafts] = useState<Record<string, any>>({});
  const [lineItemDrafts, setLineItemDrafts] = useState<Record<string, any>>({});
  const [savingBillId, setSavingBillId] = useState<string | null>(null);
  const [savingLineItemId, setSavingLineItemId] = useState<string | null>(null);
  const [deletingBillId, setDeletingBillId] = useState<string | null>(null);

  const neutralButtonClass =
    'inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600';
  const dangerButtonClass =
    'inline-flex items-center rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30';

  const initializeBillDraft = (bill: PurchaseBill) => {
    setBillDrafts((prev) => ({
      ...prev,
      [bill.id]: {
        invoiceNumber: bill.invoiceNumber,
        invoiceDate: bill.invoiceDate ? bill.invoiceDate.slice(0, 10) : '',
        status: bill.status,
        supplierName: bill.supplier?.name || '',
        supplierGSTIN: bill.supplier?.gstin || '',
        subtotal: bill.subtotal,
        cgstAmount: bill.cgstAmount,
        sgstAmount: bill.sgstAmount,
        igstAmount: bill.igstAmount,
        totalAmount: bill.totalAmount,
      },
    }));

    setLineItemDrafts((prev) => {
      const next = { ...prev };
      for (const item of bill.lineItems || []) {
        if (!next[item.id]) {
          next[item.id] = {
            itemName: item.itemName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            gstRate: item.gstRate,
            hsnCode: item.hsnCode || '',
          };
        }
      }
      return next;
    });
  };

  const loadSavedBills = useCallback(async () => {
    try {
      setLoadingBills(true);
      const response = await api.getInvoices({ limit: 20, offset: 0 });
      setSavedBills(response?.data?.bills || []);
    } catch (error) {
      toast.error(t('Failed to load saved invoices'));
    } finally {
      setLoadingBills(false);
    }
  }, [t]);

  useEffect(() => {
    loadSavedBills();
  }, [loadSavedBills]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      status: 'pending' as const,
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/pdf': ['.pdf'],
    },
    maxSize: 10485760, // 10MB
  });

  const processFiles = async () => {
    if (files.length === 0) {
      toast.error(t('Please upload at least one invoice'));
      return;
    }

    setProcessing(true);

    for (let i = 0; i < files.length; i++) {
      if (files[i].status !== 'pending') continue;

      setFiles(prev =>
        prev.map((f, idx) =>
          idx === i ? { ...f, status: 'processing' } : f
        )
      );

      try {
        const formData = new FormData();
        formData.append('invoice', files[i].file);

        const result = await api.uploadInvoice(formData, {
          autoCreate: true,
          autoApprove: true,
        });

        const savedBill = result?.data?.autoSavedBill;
        const billDetails = savedBill
          ? ` (Bill: ${savedBill.invoiceNumber} - ${savedBill.status})`
          : '';
        const statusMessage = savedBill
          ? t('Invoice processed and stored successfully')
          : t('Invoice processed successfully, but not auto-stored (manual review required)');

        setFiles(prev =>
          prev.map((f, idx) =>
            idx === i
              ? {
                  ...f,
                  status: 'success',
                  message: `${statusMessage}${billDetails}`,
                }
              : f
          )
        );

        toast.success(`${files[i].file.name} processed successfully`);
        await loadSavedBills();
      } catch (error: any) {
        setFiles(prev =>
          prev.map((f, idx) =>
            idx === i
              ? {
                  ...f,
                  status: 'error',
                  message: error.response?.data?.error || t('Processing failed'),
                }
              : f
          )
        );

        toast.error(`Failed to process ${files[i].file.name}`);
      }
    }

    setProcessing(false);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  const clearAll = () => {
    setFiles([]);
  };

  const toggleBillDetails = (bill: PurchaseBill) => {
    if (expandedBillId === bill.id) {
      setExpandedBillId(null);
      return;
    }
    initializeBillDraft(bill);
    setExpandedBillId(bill.id);
  };

  const handleBillDraftChange = (billId: string, field: string, value: string | number) => {
    setBillDrafts((prev) => ({
      ...prev,
      [billId]: {
        ...prev[billId],
        [field]: value,
      },
    }));
  };

  const handleLineItemDraftChange = (lineItemId: string, field: string, value: string | number) => {
    setLineItemDrafts((prev) => ({
      ...prev,
      [lineItemId]: {
        ...prev[lineItemId],
        [field]: value,
      },
    }));
  };

  const saveBillChanges = async (bill: PurchaseBill) => {
    const draft = billDrafts[bill.id];
    if (!draft) return;

    try {
      setSavingBillId(bill.id);
      const response = await api.updateInvoice(bill.id, {
        invoiceNumber: draft.invoiceNumber,
        invoiceDate: draft.invoiceDate,
        status: draft.status,
        supplierName: draft.supplierName,
        supplierGSTIN: draft.supplierGSTIN || null,
        subtotal: Number(draft.subtotal),
        cgstAmount: Number(draft.cgstAmount),
        sgstAmount: Number(draft.sgstAmount),
        igstAmount: Number(draft.igstAmount),
        totalAmount: Number(draft.totalAmount),
      });

      const updatedBill = response?.data;
      if (updatedBill) {
        setSavedBills((prev) => prev.map((b) => (b.id === bill.id ? updatedBill : b)));
        initializeBillDraft(updatedBill);
      } else {
        await loadSavedBills();
      }

      toast.success(t('Invoice details updated'));
    } catch (error: any) {
      toast.error(error?.response?.data?.error || t('Failed to update invoice details'));
    } finally {
      setSavingBillId(null);
    }
  };

  const saveLineItem = async (billId: string, lineItem: BillLineItem) => {
    const draft = lineItemDrafts[lineItem.id];
    if (!draft) return;

    if (!String(draft.itemName || '').trim()) {
      toast.error(t('Product description is required'));
      return;
    }

    try {
      setSavingLineItemId(lineItem.id);
      const response = await api.updateInvoiceLineItem(billId, lineItem.id, {
        itemName: String(draft.itemName || '').trim(),
        quantity: Number(draft.quantity),
        unitPrice: Number(draft.unitPrice),
        gstRate: Number(draft.gstRate),
        hsnCode: draft.hsnCode ? String(draft.hsnCode).trim() : null,
      });

      const updatedLineItem = response?.data;

      setSavedBills((prev) =>
        prev.map((bill) =>
          bill.id !== billId
            ? bill
            : {
                ...bill,
                lineItems: bill.lineItems.map((item) =>
                  item.id === lineItem.id ? { ...item, ...(updatedLineItem || {}) } : item
                ),
              }
        )
      );

      toast.success(t('Line item updated'));
    } catch (error: any) {
      toast.error(error?.response?.data?.error || t('Failed to update line item'));
    } finally {
      setSavingLineItemId(null);
    }
  };

  const deleteBill = async (billId: string, billNumber: string) => {
    const ok = window.confirm(`${t('Delete invoice')} ${billNumber}? ${t('This action cannot be undone.')}`);
    if (!ok) return;

    try {
      setDeletingBillId(billId);
      await api.deleteInvoice(billId);
      setSavedBills((prev) => prev.filter((bill) => bill.id !== billId));
      if (expandedBillId === billId) setExpandedBillId(null);
      toast.success(t('Invoice deleted successfully'));
    } catch (error: any) {
      toast.error(error?.response?.data?.error || t('Failed to delete invoice'));
    } finally {
      setDeletingBillId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {t('Invoice Processing')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {t('Upload and process purchase invoices with AI-powered OCR')}
        </p>
      </div>

      {/* Upload Area */}
      <div className="card p-8">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10'
              : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600'
          }`}
        >
          <input {...getInputProps()} />
          <Upload
            className={`mx-auto mb-4 ${
              isDragActive ? 'text-primary-600' : 'text-gray-400'
            }`}
            size={48}
          />
          <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {isDragActive
              ? t('Drop invoices here...')
              : t('Drag & drop invoices here, or click to browse')}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('Supports PDF, JPG, PNG (Max 10MB per file)')}
          </p>
        </div>
      </div>

      {/* Uploaded Files */}
      {files.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('Uploaded Files')} ({files.length})
            </h2>
            <div className="flex gap-2">
              <button
                onClick={clearAll}
                className={`${neutralButtonClass}`}
                disabled={processing}
              >
                {t('Clear All')}
              </button>
              <button
                onClick={processFiles}
                className="inline-flex items-center rounded-md border border-primary-700 bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
                disabled={processing || files.every(f => f.status !== 'pending')}
              >
                {processing ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} />
                    {t('Processing...')}
                  </>
                ) : (
                  t('Process Invoices')
                )}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {files.map((fileItem, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                {/* File Preview */}
                <div className="flex-shrink-0">
                  {fileItem.file.type.startsWith('image/') ? (
                    <img
                      src={fileItem.preview}
                      alt="Preview"
                      className="w-16 h-16 object-cover rounded"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                      <FileText className="text-gray-500" size={32} />
                    </div>
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {fileItem.file.name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {(fileItem.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  {fileItem.message && (
                    <p
                      className={`text-sm mt-1 ${
                        fileItem.status === 'error'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-green-600 dark:text-green-400'
                      }`}
                    >
                      {fileItem.message}
                    </p>
                  )}
                </div>

                {/* Status Icon */}
                <div className="flex-shrink-0">
                  {fileItem.status === 'pending' && (
                    <button
                      onClick={() => removeFile(index)}
                      className="text-gray-400 hover:text-red-600"
                      disabled={processing}
                    >
                      <XCircle size={24} />
                    </button>
                  )}
                  {fileItem.status === 'processing' && (
                    <Loader2 className="text-blue-600 animate-spin" size={24} />
                  )}
                  {fileItem.status === 'success' && (
                    <CheckCircle className="text-green-600" size={24} />
                  )}
                  {fileItem.status === 'error' && (
                    <XCircle className="text-red-600" size={24} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="card p-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
        <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-2">
          {t('How it works')}
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
          <li>{t('Upload invoice PDFs or images')}</li>
          <li>{t('AI extracts supplier, items, quantities, prices, and GST details')}</li>
          <li>{t('Review and edit extracted data before saving')}</li>
          <li>{t('Inventory is automatically updated after approval')}</li>
        </ul>
      </div>

      {/* Saved Invoices */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('Saved Invoices For Reference')}
          </h2>
          <button onClick={loadSavedBills} className={neutralButtonClass} disabled={loadingBills}>
            {loadingBills ? t('Loading...') : t('Refresh')}
          </button>
        </div>

        {loadingBills ? (
          <div className="text-gray-600 dark:text-gray-300">{t('Loading saved invoices...')}</div>
        ) : savedBills.length === 0 ? (
          <div className="text-gray-600 dark:text-gray-300">{t('No saved invoices yet')}</div>
        ) : (
          <div className="space-y-4">
            {savedBills.map((bill) => (
              <div key={bill.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-semibold text-gray-900 dark:text-white">{bill.invoiceNumber}</span>
                      <span className="text-sm text-gray-600 dark:text-gray-300">{new Date(bill.invoiceDate).toLocaleDateString()}</span>
                      <span className="text-sm text-gray-600 dark:text-gray-300">{bill.supplier?.name}</span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          bill.status === 'APPROVED'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                            : bill.status === 'REJECTED'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300'
                        }`}
                      >
                        {bill.status}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {t('Total')}: {bill.totalAmount.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => toggleBillDetails(bill)} className={neutralButtonClass}>
                        <Eye size={14} className="mr-1" />
                        {expandedBillId === bill.id ? t('Hide Details') : t('Open & Edit')}
                        {expandedBillId === bill.id ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />}
                      </button>
                      <button
                        onClick={() => deleteBill(bill.id, bill.invoiceNumber)}
                        className={dangerButtonClass}
                        disabled={deletingBillId === bill.id}
                      >
                        {deletingBillId === bill.id ? <Loader2 className="animate-spin mr-1" size={14} /> : <Trash2 className="mr-1" size={14} />}
                        {t('Delete')}
                      </button>
                    </div>
                  </div>
                </div>

                {expandedBillId === bill.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400">{t('Invoice Number')}</label>
                        <input
                          className="input mt-1"
                          value={billDrafts[bill.id]?.invoiceNumber || ''}
                          onChange={(e) => handleBillDraftChange(bill.id, 'invoiceNumber', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400">{t('Invoice Date')}</label>
                        <input
                          type="date"
                          className="input mt-1"
                          value={billDrafts[bill.id]?.invoiceDate || ''}
                          onChange={(e) => handleBillDraftChange(bill.id, 'invoiceDate', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400">{t('Status')}</label>
                        <select
                          className="input mt-1"
                          value={billDrafts[bill.id]?.status || 'PENDING'}
                          onChange={(e) => handleBillDraftChange(bill.id, 'status', e.target.value)}
                        >
                          <option value="PENDING">PENDING</option>
                          <option value="APPROVED">APPROVED</option>
                          <option value="REJECTED">REJECTED</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400">{t('Supplier Name')}</label>
                        <input
                          className="input mt-1"
                          value={billDrafts[bill.id]?.supplierName || ''}
                          onChange={(e) => handleBillDraftChange(bill.id, 'supplierName', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400">{t('Supplier GSTIN')}</label>
                        <input
                          className="input mt-1"
                          value={billDrafts[bill.id]?.supplierGSTIN || ''}
                          onChange={(e) => handleBillDraftChange(bill.id, 'supplierGSTIN', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400">{t('Subtotal')}</label>
                        <input
                          type="number"
                          step="0.01"
                          className="input mt-1"
                          value={billDrafts[bill.id]?.subtotal ?? 0}
                          onChange={(e) => handleBillDraftChange(bill.id, 'subtotal', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400">CGST</label>
                        <input
                          type="number"
                          step="0.01"
                          className="input mt-1"
                          value={billDrafts[bill.id]?.cgstAmount ?? 0}
                          onChange={(e) => handleBillDraftChange(bill.id, 'cgstAmount', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400">SGST</label>
                        <input
                          type="number"
                          step="0.01"
                          className="input mt-1"
                          value={billDrafts[bill.id]?.sgstAmount ?? 0}
                          onChange={(e) => handleBillDraftChange(bill.id, 'sgstAmount', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400">IGST</label>
                        <input
                          type="number"
                          step="0.01"
                          className="input mt-1"
                          value={billDrafts[bill.id]?.igstAmount ?? 0}
                          onChange={(e) => handleBillDraftChange(bill.id, 'igstAmount', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400">{t('Total')}</label>
                        <input
                          type="number"
                          step="0.01"
                          className="input mt-1"
                          value={billDrafts[bill.id]?.totalAmount ?? 0}
                          onChange={(e) => handleBillDraftChange(bill.id, 'totalAmount', e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <button
                        onClick={() => saveBillChanges(bill)}
                        className="inline-flex items-center rounded-md border border-primary-700 bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
                        disabled={savingBillId === bill.id}
                      >
                        {savingBillId === bill.id ? <Loader2 className="animate-spin mr-1" size={14} /> : <Save className="mr-1" size={14} />}
                        {t('Save Invoice Changes')}
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                            <th className="py-2 pr-3">{t('Product Description')}</th>
                            <th className="py-2 pr-3">HSN</th>
                            <th className="py-2 pr-3">{t('Qty')}</th>
                            <th className="py-2 pr-3">{t('Unit Price')}</th>
                            <th className="py-2 pr-3">GST %</th>
                            <th className="py-2 pr-0">{t('Actions')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bill.lineItems?.map((item) => (
                            <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800">
                              <td className="py-2 pr-3 min-w-[220px]">
                                <input
                                  className="input"
                                  value={lineItemDrafts[item.id]?.itemName ?? item.itemName}
                                  onChange={(e) => handleLineItemDraftChange(item.id, 'itemName', e.target.value)}
                                />
                              </td>
                              <td className="py-2 pr-3 min-w-[120px]">
                                <input
                                  className="input"
                                  value={lineItemDrafts[item.id]?.hsnCode ?? item.hsnCode ?? ''}
                                  onChange={(e) => handleLineItemDraftChange(item.id, 'hsnCode', e.target.value)}
                                />
                              </td>
                              <td className="py-2 pr-3 min-w-[100px]">
                                <input
                                  type="number"
                                  className="input"
                                  value={lineItemDrafts[item.id]?.quantity ?? item.quantity}
                                  onChange={(e) => handleLineItemDraftChange(item.id, 'quantity', e.target.value)}
                                />
                              </td>
                              <td className="py-2 pr-3 min-w-[130px]">
                                <input
                                  type="number"
                                  step="0.01"
                                  className="input"
                                  value={lineItemDrafts[item.id]?.unitPrice ?? item.unitPrice}
                                  onChange={(e) => handleLineItemDraftChange(item.id, 'unitPrice', e.target.value)}
                                />
                              </td>
                              <td className="py-2 pr-3 min-w-[100px]">
                                <input
                                  type="number"
                                  step="0.01"
                                  className="input"
                                  value={lineItemDrafts[item.id]?.gstRate ?? item.gstRate}
                                  onChange={(e) => handleLineItemDraftChange(item.id, 'gstRate', e.target.value)}
                                />
                              </td>
                              <td className="py-2 pr-0">
                                <button
                                  onClick={() => saveLineItem(bill.id, item)}
                                  className="inline-flex items-center rounded-md border border-primary-700 bg-primary-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
                                  disabled={savingLineItemId === item.id}
                                >
                                  {savingLineItemId === item.id ? <Loader2 className="animate-spin mr-1" size={12} /> : <Save className="mr-1" size={12} />}
                                  {t('Save Item')}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
