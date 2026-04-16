import { Router } from 'express';
import {
  uploadInvoice,
  createPurchaseBill,
  getPurchaseBills,
  getPurchaseBill,
  updatePurchaseBill,
  updateBillLineItem,
  updateBillStatus,
  deletePurchaseBill,
  batchProcessInvoices,
} from '../controllers/invoiceController';
import { authenticate, authorize } from '../middleware/auth';
import { upload } from '../config/upload';
import { successResponse, errorResponse } from '../utils/response';
import { invoiceQueue } from '../services/invoiceQueue';
import { templateService } from '../services/invoiceTemplateService';
import logger from '../config/logger';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Upload and process single invoice
router.post('/upload', upload.single('invoice'), uploadInvoice);

// Batch upload (immediate processing)
router.post('/upload/batch', upload.array('invoices', 10), batchProcessInvoices);

// Queue-based batch processing (for large batches)
router.post('/upload/queue', upload.array('invoices', 50), async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      errorResponse(res, 'Unauthorized', 401);
      return;
    }

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      errorResponse(res, 'No files uploaded', 400);
      return;
    }

    const files = req.files.map(f => ({ path: f.path, filename: f.filename }));
    const jobIds = invoiceQueue.addBatchJobs(files, userId);

    successResponse(res, {
      message: `${jobIds.length} invoices added to processing queue`,
      jobIds,
      queueStats: invoiceQueue.getQueueStats(),
    });
  } catch (error) {
    logger.error('Error queuing invoices:', error);
    next(error);
  }
});

// Get queue job status
router.get('/queue/job/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = invoiceQueue.getJob(jobId);

    if (!job) {
      errorResponse(res, 'Job not found', 404);
      return;
    }

    // Verify user owns this job
    if (job.userId !== req.user?.userId && req.user?.role !== 'ADMIN') {
      errorResponse(res, 'Unauthorized', 403);
      return;
    }

    successResponse(res, job);
  } catch (error) {
    logger.error('Error fetching job:', error);
    next(error);
  }
});

// Get user's queue jobs
router.get('/queue/jobs', async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      errorResponse(res, 'Unauthorized', 401);
      return;
    }

    const jobs = invoiceQueue.getUserJobs(userId);
    successResponse(res, { jobs, stats: invoiceQueue.getQueueStats() });
  } catch (error) {
    logger.error('Error fetching jobs:', error);
    next(error);
  }
});

// Cancel queued job
router.delete('/queue/job/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = invoiceQueue.getJob(jobId);

    if (!job) {
      errorResponse(res, 'Job not found', 404);
      return;
    }

    if (job.userId !== req.user?.userId && req.user?.role !== 'ADMIN') {
      errorResponse(res, 'Unauthorized', 403);
      return;
    }

    const cancelled = invoiceQueue.cancelJob(jobId);
    if (cancelled) {
      successResponse(res, { message: 'Job cancelled successfully' });
    } else {
      errorResponse(res, 'Job cannot be cancelled (already processing or completed)', 400);
    }
  } catch (error) {
    logger.error('Error cancelling job:', error);
    next(error);
  }
});

// Get supplier invoice insights
router.get('/insights/supplier/:supplierId', async (req, res, next) => {
  try {
    const { supplierId } = req.params;
    const insights = await templateService.getSupplierInsights(supplierId);
    const template = await templateService.getTemplate(supplierId);

    successResponse(res, {
      insights,
      template: template || null,
    });
  } catch (error) {
    logger.error('Error fetching supplier insights:', error);
    next(error);
  }
});

// Get all invoice templates (admin only)
router.get('/templates', authorize('ADMIN'), async (req, res, next) => {
  try {
    const templates = await templateService.getAllTemplates();
    successResponse(res, { templates, count: templates.length });
  } catch (error) {
    logger.error('Error fetching templates:', error);
    next(error);
  }
});

// CRUD operations for purchase bills
router.post('/bills', authorize('ADMIN', 'MANAGER'), createPurchaseBill);
router.get('/bills', getPurchaseBills);
router.get('/bills/:id', getPurchaseBill);
router.patch('/bills/:id', updatePurchaseBill);
router.patch('/bills/:id/line-items/:lineItemId', updateBillLineItem);
router.patch('/bills/:id/status', authorize('ADMIN', 'MANAGER'), updateBillStatus);
router.delete('/bills/:id', deletePurchaseBill);

export default router;
