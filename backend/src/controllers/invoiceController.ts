import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../config/logger';
import { processInvoice, validateInvoiceData, checkDuplicateInvoice, generateCorrectionSuggestions } from '../services/ocrService';
import { deleteFile } from '../config/upload';
import { templateService, applyTemplateValidation } from '../services/invoiceTemplateService';

// Upload and process invoice
export const uploadInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      errorResponse(res, 'Unauthorized', 401);
      return;
    }

    if (!req.file) {
      errorResponse(res, 'No file uploaded', 400);
      return;
    }

    const filePath = req.file.path;
    logger.info('Processing uploaded invoice', { filePath, userId });

    // Extract data using OCR
    const extractedData = await processInvoice(filePath, true);

    // Validate extracted data
    const validation = validateInvoiceData(extractedData);

    // Check for duplicates
    const duplicateCheck = await checkDuplicateInvoice(
      extractedData.invoiceNumber,
      extractedData.supplierName,
      prisma
    );

    // Generate correction suggestions
    const corrections = await generateCorrectionSuggestions(extractedData, validation);

    // Find or create supplier for template validation
    const supplier = await prisma.supplier.findFirst({
      where: {
        OR: [
          { name: { contains: extractedData.supplierName } },
          extractedData.supplierGSTIN ? { gstin: extractedData.supplierGSTIN } : {},
        ],
      },
    });

    let templateValidation = null;
    let supplierInsights = null;

    if (supplier) {
      // Apply template-based validation
      const templateResult = await applyTemplateValidation(extractedData, supplier.id);
      templateValidation = templateResult.templateValidation;

      // Get supplier insights
      supplierInsights = await templateService.getSupplierInsights(supplier.id);
    }

    successResponse(res, {
      extractedData,
      validation,
      duplicateCheck,
      corrections,
      templateValidation,
      supplierInsights,
      filePath: req.file.filename,
      message: validation.canAutoApprove
        ? 'Invoice processed successfully - qualifies for auto-approval'
        : validation.valid
          ? 'Invoice processed successfully - manual review recommended'
          : 'Invoice processed with errors - review required',
    });
  } catch (error: any) {
    logger.error('Error processing invoice:', error);

    // Clean up uploaded file on error
    if (req.file) {
      deleteFile(req.file.path);
    }

    next(error);
  }
};

// Create purchase bill from extracted data
export const createPurchaseBill = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      errorResponse(res, 'Unauthorized', 401);
      return;
    }

    const {
      invoiceNumber,
      invoiceDate,
      supplierName,
      supplierGSTIN,
      subtotal,
      cgst,
      sgst,
      igst,
      totalAmount,
      items,
      filePath,
      status = 'PENDING',
    } = req.body;

    // Find or create supplier
    let supplier = await prisma.supplier.findFirst({
      where: {
        OR: [
          { name: { contains: supplierName } },
          supplierGSTIN ? { gstin: supplierGSTIN } : {},
        ],
      },
    });

    if (!supplier) {
      // Create new supplier
      supplier = await prisma.supplier.create({
        data: {
          name: supplierName,
          gstin: supplierGSTIN,
          activeStatus: 1,
        },
      });
      logger.info('Created new supplier', { supplierId: supplier.id, name: supplierName });
    }

    // Check for duplicate
    const existing = await prisma.purchaseBill.findFirst({
      where: {
        invoiceNumber,
        supplierId: supplier.id,
      },
    });

    if (existing) {
      errorResponse(res, 'Duplicate invoice - this invoice already exists in the system', 409);
      return;
    }

    // Create purchase bill
    const purchaseBill = await prisma.purchaseBill.create({
      data: {
        invoiceNumber,
        invoiceDate: new Date(invoiceDate),
        supplierId: supplier.id,
        subtotal,
        cgstAmount: cgst || 0,
        sgstAmount: sgst || 0,
        igstAmount: igst || 0,
        totalAmount,
        status,
        filePath,
        uploadedBy: userId,
        lineItems: {
          create: items.map((item: any) => ({
            itemName: item.name,
            hsnCode: item.hsnCode,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            gstRate: item.gstRate,
            gstAmount: (item.amount * item.gstRate) / 100,
            lineTotal: item.amount,
            confidenceScore: 85,
          })),
        },
      },
      include: {
        supplier: true,
        lineItems: true,
      },
    });

    // Update inventory if approved
    if (status === 'APPROVED') {
      for (const item of items) {
        // Find matching product
        const product = await prisma.product.findFirst({
          where: {
            OR: [
              { name: { contains: item.name } },
              item.hsnCode ? { hsnCode: item.hsnCode } : {},
            ],
            supplierId: supplier.id,
          },
        });

        if (product) {
          // Update stock
          await prisma.product.update({
            where: { id: product.id },
            data: {
              currentStock: {
                increment: item.quantity,
              },
            },
          });

          // Create inventory transaction
          await prisma.inventoryTransaction.create({
            data: {
              productId: product.id,
              transactionType: 'PURCHASE',
              quantity: item.quantity,
              referenceType: 'PURCHASE_BILL',
              referenceId: purchaseBill.id,
              notes: `Invoice ${invoiceNumber}`,
            },
          });
        }
      }

      // Learn from this invoice for future predictions
      const wasAccurate = true; // Approved invoices are assumed accurate
      await templateService.learnFromInvoice(
        {
          invoiceNumber,
          invoiceDate,
          supplierName,
          supplierGSTIN,
          subtotal,
          cgst,
          sgst,
          igst,
          totalAmount,
          items,
          confidence: 95, // High confidence for manually approved bills
        },
        supplier.id,
        wasAccurate
      );
    }

    successResponse(res, purchaseBill, 'Purchase bill created successfully', 201);
  } catch (error) {
    logger.error('Error creating purchase bill:', error);
    next(error);
  }
};

// Get all purchase bills
export const getPurchaseBills = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, supplierId, startDate, endDate, limit = '50', offset = '0' } = req.query;

    const where: any = {};

    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;
    if (startDate || endDate) {
      where.invoiceDate = {};
      if (startDate) where.invoiceDate.gte = new Date(startDate as string);
      if (endDate) where.invoiceDate.lte = new Date(endDate as string);
    }

    const [bills, total] = await Promise.all([
      prisma.purchaseBill.findMany({
        where,
        include: {
          supplier: true,
          uploader: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              lineItems: true,
            },
          },
        },
        orderBy: { invoiceDate: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.purchaseBill.count({ where }),
    ]);

    successResponse(res, {
      bills,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    logger.error('Error fetching purchase bills:', error);
    next(error);
  }
};

// Get single purchase bill
export const getPurchaseBill = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const bill = await prisma.purchaseBill.findUnique({
      where: { id },
      include: {
        supplier: true,
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        lineItems: true,
        transactions: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!bill) {
      errorResponse(res, 'Purchase bill not found', 404);
      return;
    }

    successResponse(res, bill);
  } catch (error) {
    logger.error('Error fetching purchase bill:', error);
    next(error);
  }
};

// Update purchase bill status
export const updateBillStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      errorResponse(res, 'Invalid status', 400);
      return;
    }

    const bill = await prisma.purchaseBill.findUnique({
      where: { id },
      include: {
        lineItems: true,
        supplier: true,
      },
    });

    if (!bill) {
      errorResponse(res, 'Purchase bill not found', 404);
      return;
    }

    // Update status
    const updated = await prisma.purchaseBill.update({
      where: { id },
      data: { status },
      include: {
        supplier: true,
        lineItems: true,
      },
    });

    // If approved, update inventory
    if (status === 'APPROVED' && bill.status !== 'APPROVED') {
      for (const item of bill.lineItems) {
        if (item.productId) {
          await prisma.product.update({
            where: { id: item.productId },
            data: {
              currentStock: {
                increment: item.quantity,
              },
            },
          });

          await prisma.inventoryTransaction.create({
            data: {
              productId: item.productId,
              transactionType: 'PURCHASE',
              quantity: item.quantity,
              referenceType: 'PURCHASE_BILL',
              referenceId: bill.id,
              notes: `Invoice ${bill.invoiceNumber} approved`,
            },
          });
        }
      }
    }

    successResponse(res, updated);
  } catch (error) {
    logger.error('Error updating bill status:', error);
    next(error);
  }
};

// Delete purchase bill
export const deletePurchaseBill = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const bill = await prisma.purchaseBill.findUnique({
      where: { id },
    });

    if (!bill) {
      errorResponse(res, 'Purchase bill not found', 404);
      return;
    }

    // Delete associated file
    if (bill.filePath) {
      const fullPath = `uploads/invoices/${bill.filePath}`;
      deleteFile(fullPath);
    }

    await prisma.purchaseBill.delete({
      where: { id },
    });

    successResponse(res, { message: 'Purchase bill deleted successfully' });
  } catch (error) {
    logger.error('Error deleting purchase bill:', error);
    next(error);
  }
};

// Batch process invoices
export const batchProcessInvoices = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
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

    logger.info('Batch processing invoices', { count: req.files.length });

    const results = await Promise.allSettled(
      req.files.map(async (file) => {
        try {
          const extractedData = await processInvoice(file.path, true);
          const validation = validateInvoiceData(extractedData);
          const duplicateCheck = await checkDuplicateInvoice(
            extractedData.invoiceNumber,
            extractedData.supplierName,
            prisma
          );

          return {
            filename: file.filename,
            success: true,
            extractedData,
            validation,
            duplicateCheck,
          };
        } catch (error: any) {
          deleteFile(file.path);
          return {
            filename: file.filename,
            success: false,
            error: error.message,
          };
        }
      })
    );

    const processed = results.map((result, index) =>
      result.status === 'fulfilled' ? result.value : { ...result.reason, index }
    );

    successResponse(res, {
      total: req.files.length,
      processed: processed.filter((r) => r.success).length,
      failed: processed.filter((r) => !r.success).length,
      results: processed,
    });
  } catch (error) {
    logger.error('Error batch processing invoices:', error);
    next(error);
  }
};
