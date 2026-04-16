import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../config/logger';
import { processInvoice, validateInvoiceData, checkDuplicateInvoice, generateCorrectionSuggestions } from '../services/ocrService';
import { deleteFile } from '../config/upload';
import { templateService, applyTemplateValidation } from '../services/invoiceTemplateService';

const canManageBill = (req: Request, bill: { uploadedBy: string }): boolean => {
  const role = req.user?.role;
  const userId = req.user?.userId;
  if (!userId || !role) return false;
  if (role === 'ADMIN' || role === 'MANAGER') return true;
  return bill.uploadedBy === userId;
};

const DEFAULT_IMPORTED_PRODUCT_CATEGORY =
  process.env.INVOICE_DEFAULT_PRODUCT_CATEGORY || 'Invoice Imported';

const toSafeNumber = (value: any, fallback = 0): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
};

const toSafeQuantity = (value: any): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed);
};

interface PreparedLineItem {
  productId: string;
  itemName: string;
  hsnCode: string | null;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  gstAmount: number;
  lineTotal: number;
  confidenceScore: number;
}

const prepareInvoiceLineItems = async (
  supplierId: string,
  items: any[],
  confidence: number
): Promise<PreparedLineItem[]> => {
  const prepared: PreparedLineItem[] = [];

  for (const rawItem of items || []) {
    const itemName =
      typeof rawItem?.name === 'string' && rawItem.name.trim().length > 0
        ? rawItem.name.trim()
        : 'Unnamed Item';
    const hsnCode =
      typeof rawItem?.hsnCode === 'string' && rawItem.hsnCode.trim().length > 0
        ? rawItem.hsnCode.trim()
        : null;
    const quantity = toSafeQuantity(rawItem?.quantity);
    const unitPriceInput = toSafeNumber(rawItem?.unitPrice);
    const amountInput = toSafeNumber(rawItem?.amount);
    const gstRate = Math.min(100, Math.max(0, toSafeNumber(rawItem?.gstRate, 18)));
    const lineTotal = Number(
      (amountInput > 0 ? amountInput : quantity * unitPriceInput).toFixed(2)
    );
    const unitPrice = Number(
      (unitPriceInput > 0
        ? unitPriceInput
        : quantity > 0
          ? lineTotal / quantity
          : 0
      ).toFixed(2)
    );
    const gstAmount = Number(((lineTotal * gstRate) / 100).toFixed(2));

    const existingProduct = await prisma.product.findFirst({
      where: {
        supplierId,
        OR: [
          { name: { equals: itemName } },
          ...(hsnCode ? [{ hsnCode }] : []),
        ],
      },
    });

    let productId = existingProduct?.id;

    if (!productId) {
      const createdProduct = await prisma.product.create({
        data: {
          name: itemName,
          category: DEFAULT_IMPORTED_PRODUCT_CATEGORY,
          hsnCode,
          gstRate,
          currentStock: 0,
          reorderLevel: 5,
          unitPrice,
          supplierId,
          description: `Auto-created from invoice ingestion`,
        },
      });
      productId = createdProduct.id;
    } else {
      const productPatch: any = {};
      if (hsnCode && !existingProduct?.hsnCode) productPatch.hsnCode = hsnCode;
      if (unitPrice > 0) productPatch.unitPrice = unitPrice;
      if (gstRate >= 0) productPatch.gstRate = gstRate;

      if (Object.keys(productPatch).length > 0) {
        await prisma.product.update({
          where: { id: productId },
          data: productPatch,
        });
      }
    }

    prepared.push({
      productId,
      itemName,
      hsnCode,
      quantity,
      unitPrice,
      gstRate,
      gstAmount,
      lineTotal,
      confidenceScore: Math.max(1, Math.min(100, confidence || 75)),
    });
  }

  return prepared;
};

const applyApprovedInventory = async (
  billId: string,
  invoiceNumber: string,
  lineItems: PreparedLineItem[]
): Promise<void> => {
  for (const lineItem of lineItems) {
    if (!lineItem.productId || lineItem.quantity <= 0) continue;

    await prisma.product.update({
      where: { id: lineItem.productId },
      data: {
        currentStock: {
          increment: lineItem.quantity,
        },
      },
    });

    await prisma.inventoryTransaction.create({
      data: {
        productId: lineItem.productId,
        transactionType: 'PURCHASE',
        quantity: lineItem.quantity,
        referenceType: 'PURCHASE_BILL',
        referenceId: billId,
        notes: `Invoice ${invoiceNumber} approved`,
      },
    });
  }
};

const rollbackApprovedInventory = async (
  billId: string,
  lineItems: Array<{ productId?: string | null; quantity: number }>
): Promise<void> => {
  for (const lineItem of lineItems) {
    if (!lineItem.productId || lineItem.quantity <= 0) continue;

    const product = await prisma.product.findUnique({
      where: { id: lineItem.productId },
      select: { id: true, currentStock: true },
    });

    if (!product) continue;

    await prisma.product.update({
      where: { id: product.id },
      data: {
        currentStock: Math.max(0, product.currentStock - lineItem.quantity),
      },
    });
  }

  await prisma.inventoryTransaction.deleteMany({
    where: {
      referenceType: 'PURCHASE_BILL',
      referenceId: billId,
    },
  });
};

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

    const fallbackInvoicePrefix = process.env.INVOICE_FALLBACK_PREFIX || 'AUTO';
    const fallbackSupplierName = process.env.INVOICE_FALLBACK_SUPPLIER_NAME || 'Supplier';

    const hasExtractedInvoiceNumber = !!extractedData.invoiceNumber?.trim();
    const safeInvoiceNumber = hasExtractedInvoiceNumber
      ? extractedData.invoiceNumber.trim()
      : `${fallbackInvoicePrefix}-${Date.now()}`;
    const safeSupplierName = extractedData.supplierName?.trim() || `${fallbackSupplierName} ${new Date().toISOString().slice(0, 10)}`;

    // Check for duplicates only when we have an extracted invoice number
    const duplicateCheck = hasExtractedInvoiceNumber
      ? await checkDuplicateInvoice(
          extractedData.invoiceNumber,
          safeSupplierName,
          prisma
        )
      : { isDuplicate: false, existingInvoice: null };

    // Generate correction suggestions
    const corrections = await generateCorrectionSuggestions(extractedData, validation);

    // Find or create supplier for template validation
    const supplierMatchConditions: any[] = [];
    if (safeSupplierName && safeSupplierName !== fallbackSupplierName) {
      supplierMatchConditions.push({ name: { contains: safeSupplierName } });
    }
    if (extractedData.supplierGSTIN) {
      supplierMatchConditions.push({ gstin: extractedData.supplierGSTIN });
    }

    const supplier = supplierMatchConditions.length
      ? await prisma.supplier.findFirst({
          where: {
            OR: supplierMatchConditions,
          },
        })
      : null;

    let templateValidation = null;
    let supplierInsights = null;
    let autoSavedBill: any = null;

    if (supplier) {
      // Apply template-based validation
      const templateResult = await applyTemplateValidation(extractedData, supplier.id);
      templateValidation = templateResult.templateValidation;

      // Get supplier insights
      supplierInsights = await templateService.getSupplierInsights(supplier.id);
    }

    const autoCreate =
      req.query.autoCreate === 'true' ||
      req.body?.autoCreate === true ||
      req.body?.autoCreate === 'true';
    const autoApproveRequested =
      req.query.autoApprove === 'true' ||
      req.body?.autoApprove === true ||
      req.body?.autoApprove === 'true';

    if (autoCreate && !duplicateCheck.isDuplicate) {
      let billSupplier = supplier;

      if (!billSupplier) {
        billSupplier = await prisma.supplier.create({
          data: {
            name: safeSupplierName,
            gstin: extractedData.supplierGSTIN || null,
            address: extractedData.supplierAddress || null,
            activeStatus: 1,
          },
        });
      }

      // In invoice-first mode, autoApprove should immediately reflect stock across
      // products and dashboard when requested by the client.
      const billStatus = autoApproveRequested ? 'APPROVED' : 'PENDING';

      const preparedLineItems = await prepareInvoiceLineItems(
        billSupplier.id,
        extractedData.items || [],
        extractedData.confidence || 75
      );

      autoSavedBill = await prisma.purchaseBill.create({
        data: {
          invoiceNumber: safeInvoiceNumber,
          invoiceDate: new Date(extractedData.invoiceDate || new Date()),
          supplierId: billSupplier.id,
          subtotal: extractedData.subtotal || 0,
          cgstAmount: extractedData.cgst || 0,
          sgstAmount: extractedData.sgst || 0,
          igstAmount: extractedData.igst || 0,
          totalAmount: extractedData.totalAmount || 0,
          status: billStatus,
          filePath: req.file.filename,
          uploadedBy: userId,
          lineItems: {
            create: preparedLineItems.map((item) => ({
              productId: item.productId,
              itemName: item.itemName,
              hsnCode: item.hsnCode,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              gstRate: item.gstRate,
              gstAmount: item.gstAmount,
              lineTotal: item.lineTotal,
              confidenceScore: item.confidenceScore,
            })),
          },
        },
        include: {
          supplier: true,
          lineItems: true,
        },
      });

      if (billStatus === 'APPROVED') {
        await applyApprovedInventory(
          autoSavedBill.id,
          autoSavedBill.invoiceNumber,
          preparedLineItems
        );
      }
    }

    if (!autoSavedBill && duplicateCheck.isDuplicate && duplicateCheck.existingInvoice) {
      autoSavedBill = duplicateCheck.existingInvoice;
    }

    successResponse(res, {
      extractedData,
      validation,
      duplicateCheck,
      corrections,
      templateValidation,
      supplierInsights,
      autoSavedBill,
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
    const preparedLineItems = await prepareInvoiceLineItems(
      supplier.id,
      items || [],
      85
    );

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
          create: preparedLineItems.map((item) => ({
            productId: item.productId,
            itemName: item.itemName,
            hsnCode: item.hsnCode,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            gstRate: item.gstRate,
            gstAmount: item.gstAmount,
            lineTotal: item.lineTotal,
            confidenceScore: item.confidenceScore,
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
      await applyApprovedInventory(
        purchaseBill.id,
        purchaseBill.invoiceNumber,
        preparedLineItems
      );

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
    const userId = req.user?.userId;
    const role = req.user?.role;

    const where: any = {};

    if (role === 'STAFF' && userId) {
      where.uploadedBy = userId;
    }

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
          lineItems: {
            select: {
              id: true,
              itemName: true,
              quantity: true,
              unitPrice: true,
              lineTotal: true,
              hsnCode: true,
              gstRate: true,
            },
          },
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

// Update line item fields for an existing purchase bill
export const updateBillLineItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: billId, lineItemId } = req.params;
    const { itemName, quantity, unitPrice, gstRate, hsnCode } = req.body;

    const existing = await prisma.billLineItem.findFirst({
      where: {
        id: lineItemId,
        billId,
      },
      include: {
        bill: {
          select: {
            uploadedBy: true,
            status: true,
          },
        },
      },
    });

    if (!existing) {
      errorResponse(res, 'Line item not found for this bill', 404);
      return;
    }

    if (!canManageBill(req, { uploadedBy: existing.bill.uploadedBy })) {
      errorResponse(res, 'Insufficient permissions', 403);
      return;
    }

    const updateData: any = {};

    if (itemName !== undefined) {
      if (typeof itemName !== 'string' || itemName.trim().length < 2) {
        errorResponse(res, 'Item description must be at least 2 characters', 400);
        return;
      }
      updateData.itemName = itemName.trim();
    }

    const nextQuantity = quantity !== undefined ? Number(quantity) : existing.quantity;
    const nextUnitPrice = unitPrice !== undefined ? Number(unitPrice) : existing.unitPrice;
    const nextGstRate = gstRate !== undefined ? Number(gstRate) : existing.gstRate;

    if (quantity !== undefined) {
      if (!Number.isFinite(nextQuantity) || nextQuantity < 0) {
        errorResponse(res, 'Quantity must be a valid non-negative number', 400);
        return;
      }
      updateData.quantity = nextQuantity;
    }

    if (unitPrice !== undefined) {
      if (!Number.isFinite(nextUnitPrice) || nextUnitPrice < 0) {
        errorResponse(res, 'Unit price must be a valid non-negative number', 400);
        return;
      }
      updateData.unitPrice = nextUnitPrice;
    }

    if (gstRate !== undefined) {
      if (!Number.isFinite(nextGstRate) || nextGstRate < 0 || nextGstRate > 100) {
        errorResponse(res, 'GST rate must be between 0 and 100', 400);
        return;
      }
      updateData.gstRate = nextGstRate;
    }

    if (hsnCode !== undefined) {
      updateData.hsnCode = hsnCode ? String(hsnCode).trim() : null;
    }

    const nextLineTotal = Number((nextQuantity * nextUnitPrice).toFixed(2));
    updateData.lineTotal = nextLineTotal;
    updateData.gstAmount = Number(((nextLineTotal * nextGstRate) / 100).toFixed(2));

    const updated = await prisma.billLineItem.update({
      where: { id: lineItemId },
      data: updateData,
    });

    if (
      existing.bill.status === 'APPROVED' &&
      existing.productId &&
      updateData.quantity !== undefined
    ) {
      const deltaQuantity = updated.quantity - existing.quantity;

      if (deltaQuantity !== 0) {
        const product = await prisma.product.findUnique({
          where: { id: existing.productId },
          select: { id: true, currentStock: true },
        });

        if (product) {
          const nextStock = Math.max(0, product.currentStock + deltaQuantity);
          await prisma.product.update({
            where: { id: product.id },
            data: {
              currentStock: nextStock,
            },
          });
        }
      }
    }

    if (existing.productId) {
      const productPatch: any = {};
      if (updateData.itemName !== undefined) productPatch.name = updateData.itemName;
      if (updateData.hsnCode !== undefined) productPatch.hsnCode = updateData.hsnCode;
      if (updateData.unitPrice !== undefined) productPatch.unitPrice = updateData.unitPrice;
      if (updateData.gstRate !== undefined) productPatch.gstRate = updateData.gstRate;

      if (Object.keys(productPatch).length > 0) {
        await prisma.product.update({
          where: { id: existing.productId },
          data: productPatch,
        });
      }
    }

    successResponse(res, updated, 'Line item updated successfully');
  } catch (error) {
    logger.error('Error updating bill line item:', error);
    next(error);
  }
};

// Update purchase bill header fields for reference and correction workflow
export const updatePurchaseBill = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      invoiceNumber,
      invoiceDate,
      status,
      subtotal,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalAmount,
      supplierName,
      supplierGSTIN,
    } = req.body;

    const bill = await prisma.purchaseBill.findUnique({
      where: { id },
      include: { supplier: true },
    });

    if (!bill) {
      errorResponse(res, 'Purchase bill not found', 404);
      return;
    }

    if (!canManageBill(req, bill)) {
      errorResponse(res, 'Insufficient permissions', 403);
      return;
    }

    const updateData: any = {};

    if (invoiceNumber !== undefined) {
      const normalized = String(invoiceNumber).trim();
      if (normalized.length < 2) {
        errorResponse(res, 'Invoice number must be at least 2 characters', 400);
        return;
      }

      const duplicate = await prisma.purchaseBill.findFirst({
        where: {
          invoiceNumber: normalized,
          id: { not: id },
        },
        select: { id: true },
      });

      if (duplicate) {
        errorResponse(res, 'Another bill already uses this invoice number', 409);
        return;
      }

      updateData.invoiceNumber = normalized;
    }

    if (invoiceDate !== undefined) {
      const parsedDate = new Date(invoiceDate);
      if (isNaN(parsedDate.getTime())) {
        errorResponse(res, 'Invalid invoice date', 400);
        return;
      }
      updateData.invoiceDate = parsedDate;
    }

    if (status !== undefined) {
      const validStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
      if (!validStatuses.includes(status)) {
        errorResponse(res, 'Invalid status', 400);
        return;
      }
      updateData.status = status;
    }

    const numberFields = {
      subtotal,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalAmount,
    } as const;

    for (const [key, value] of Object.entries(numberFields)) {
      if (value !== undefined) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 0) {
          errorResponse(res, `${key} must be a valid non-negative number`, 400);
          return;
        }
        updateData[key] = parsed;
      }
    }

    let nextSupplierId = bill.supplierId;
    if (supplierName !== undefined || supplierGSTIN !== undefined) {
      const normalizedSupplierName =
        supplierName !== undefined ? String(supplierName).trim() : bill.supplier.name;
      const normalizedSupplierGSTIN =
        supplierGSTIN !== undefined ? (supplierGSTIN ? String(supplierGSTIN).trim() : null) : bill.supplier.gstin;

      if (!normalizedSupplierName || normalizedSupplierName.length < 2) {
        errorResponse(res, 'Supplier name must be at least 2 characters', 400);
        return;
      }

      const supplierConditions: any[] = [{ name: normalizedSupplierName }];
      if (normalizedSupplierGSTIN) {
        supplierConditions.push({ gstin: normalizedSupplierGSTIN });
      }

      const existingSupplier = await prisma.supplier.findFirst({
        where: {
          OR: supplierConditions,
        },
      });

      if (existingSupplier) {
        nextSupplierId = existingSupplier.id;
      } else {
        const createdSupplier = await prisma.supplier.create({
          data: {
            name: normalizedSupplierName,
            gstin: normalizedSupplierGSTIN,
            activeStatus: 1,
          },
        });
        nextSupplierId = createdSupplier.id;
      }
      updateData.supplierId = nextSupplierId;
    }

    const updated = await prisma.purchaseBill.update({
      where: { id },
      data: updateData,
      include: {
        supplier: true,
        lineItems: true,
      },
    });

    if (status !== undefined && bill.status !== updated.status) {
      if (updated.status === 'APPROVED') {
        const approvalLineItems: PreparedLineItem[] = (updated.lineItems || []).map((item) => ({
          productId: item.productId || '',
          itemName: item.itemName,
          hsnCode: item.hsnCode || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          gstRate: item.gstRate,
          gstAmount: item.gstAmount,
          lineTotal: item.lineTotal,
          confidenceScore: item.confidenceScore || 100,
        }));

        await applyApprovedInventory(updated.id, updated.invoiceNumber, approvalLineItems);
      }

      if (bill.status === 'APPROVED' && updated.status !== 'APPROVED') {
        await rollbackApprovedInventory(updated.id, updated.lineItems || []);
      }
    }

    successResponse(res, updated, 'Invoice updated successfully');
  } catch (error) {
    logger.error('Error updating purchase bill:', error);
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

    if (!canManageBill(req, bill)) {
      errorResponse(res, 'Insufficient permissions', 403);
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
      include: {
        lineItems: {
          select: {
            productId: true,
            quantity: true,
          },
        },
      },
    });

    if (!bill) {
      errorResponse(res, 'Purchase bill not found', 404);
      return;
    }

    if (!canManageBill(req, bill)) {
      errorResponse(res, 'Insufficient permissions', 403);
      return;
    }

    const supplierId = bill.supplierId;
    const productIds = Array.from(
      new Set(
        (bill.lineItems || [])
          .map((item) => item.productId)
          .filter((productId): productId is string => !!productId)
      )
    );

    const quantityByProductId = new Map<string, number>();
    for (const item of bill.lineItems || []) {
      if (!item.productId) continue;
      quantityByProductId.set(
        item.productId,
        (quantityByProductId.get(item.productId) || 0) + item.quantity
      );
    }

    await prisma.$transaction(async (tx) => {
      // Undo stock impact for approved bills before removing the bill.
      if (bill.status === 'APPROVED') {
        for (const [productId, quantityToRollback] of quantityByProductId.entries()) {
          const product = await tx.product.findUnique({
            where: { id: productId },
            select: { id: true, currentStock: true },
          });

          if (!product) continue;

          await tx.product.update({
            where: { id: productId },
            data: {
              currentStock: Math.max(0, product.currentStock - quantityToRollback),
            },
          });
        }
      }

      await tx.inventoryTransaction.deleteMany({
        where: {
          referenceType: 'PURCHASE_BILL',
          referenceId: id,
        },
      });

      await tx.purchaseBill.delete({
        where: { id },
      });

      for (const productId of productIds) {
        const stillReferenced = await tx.billLineItem.count({
          where: { productId },
        });

        if (stillReferenced > 0) continue;

        await tx.stockAlert.deleteMany({ where: { productId } });
        await tx.inventoryTransaction.deleteMany({ where: { productId } });
        await tx.product.deleteMany({ where: { id: productId } });
      }

      const [remainingSupplierBills, remainingSupplierProducts] = await Promise.all([
        tx.purchaseBill.count({ where: { supplierId } }),
        tx.product.count({ where: { supplierId } }),
      ]);

      if (remainingSupplierBills === 0 && remainingSupplierProducts === 0) {
        await tx.supplier.deleteMany({
          where: { id: supplierId },
        });
      }
    });

    // Delete associated file only if no bill references it anymore.
    if (bill.filePath) {
      const fileReferences = await prisma.purchaseBill.count({
        where: { filePath: bill.filePath },
      });

      if (fileReferences === 0) {
        const fullPath = `uploads/invoices/${bill.filePath}`;
        deleteFile(fullPath);
      }
    }

    successResponse(res, {
      message: 'Purchase bill deleted successfully',
      cleanup: {
        removedLinkedProducts: productIds.length,
      },
    });
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
