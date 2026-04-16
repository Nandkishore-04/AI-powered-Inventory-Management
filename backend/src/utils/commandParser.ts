import prisma from '../config/database';

interface CommandResult {
  command: string | null;
  response: string;
  data?: any;
  inventoryUpdates?: any;
}

const TAMIL_CHAR_PATTERN = /[\u0B80-\u0BFF]/;

function isTamilInput(input: string): boolean {
  return TAMIL_CHAR_PATTERN.test(input);
}

function parseNumber(value?: string): number | null {
  if (!value) return null;
  const normalized = value.replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractJsonPayload(input: string): any | null {
  const jsonMatch = input.match(/\{[\s\S]*\}$/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

// Regex patterns for commands
const patterns = {
  // Language/help
  helpTamil: /^(?:உதவி|கமாண்டுகள்|என்ன செய்ய முடியும்|help|commands?|\/help)$/i,

  // Product queries
  searchProduct: /(?:search|find|show|get)\s+(?:product|item)s?\s+(?:named?|called)?\s*["']?([^"'\n]+)["']?/i,
  searchProductTamil: /(?:பொருள்|பொருட்கள்)\s+([\w\s\-]+)\s*(?:தேடு|காண்பி)/i,
  lowStock: /(?:show|list|get|find)\s+(?:all\s+)?(?:low\s+stock|out\s+of\s+stock|items\s+below|products\s+below)/i,
  lowStockTamil: /(?:குறைந்த\s+இருப்பு|குறைந்த\s+ஸ்டாக்|ஸ்டாக்\s+குறைவு|இருப்பு\s+குறைவு)/i,
  productsByCategory: /(?:show|list|get|find)\s+(?:all\s+)?(?:products?|items?)\s+(?:in|from|of)\s+(?:category\s+)?["']?([^"'\n]+)["']?/i,

  // Stock queries
  checkStock: /(?:what is|show|check|get)\s+(?:the\s+)?(?:stock|quantity)\s+(?:of|for)\s+["']?([^"'\n]+)["']?/i,
  checkStockTamil: /(?:பொருள்|பொருளின்)\s+([\w\s\-]+)\s*(?:ஸ்டாக்|இருப்பு)\s*(?:என்ன|காண்பி)/i,
  totalInventoryValue: /(?:what is|show|get|calculate)\s+(?:the\s+)?(?:total\s+)?(?:inventory\s+)?value/i,
  totalInventoryValueTamil: /(?:மொத்த\s+இருப்பு\s+மதிப்பு|இன்வெண்டரி\s+மதிப்பு|மொத்த\s+ஸ்டாக்\s+மதிப்பு)/i,

  // Product CRUD
  listProducts: /(?:show|list|get)\s+(?:all\s+)?products?$/i,
  listProductsTamil: /(?:அனைத்து\s+பொருட்கள்|பொருட்கள்\s+பட்டியல்|பொருட்கள்\s+காண்பி)/i,
  createProductJson: /^(?:create|add)\s+product\s+\{[\s\S]*\}$/i,
  createProductInline:
    /^(?:create|add)\s+product\s+(.+?)\s+price\s+([\d.,]+)(?:\s+stock\s+([\d.,]+))?(?:\s+category\s+(.+?))?(?:\s+reorder\s+([\d.,]+))?(?:\s+supplier\s+(.+))?$/i,
  createProductTamil: /^(?:பொருள்\s+சேர்|புதிய\s+பொருள்\s+சேர்)\s+(.+?)\s+விலை\s+([\d.,]+)(?:\s+ஸ்டாக்\s+([\d.,]+))?(?:\s+வகை\s+(.+))?$/i,
  updateProductInline:
    /^(?:update|edit)\s+product\s+(.+?)\s+set\s+(?:stock\s+([\d.,]+))?(?:\s*price\s+([\d.,]+))?(?:\s*category\s+(.+?))?(?:\s*reorder\s+([\d.,]+))?$/i,
  updateProductTamil:
    /^(?:பொருள்\s+புதுப்பி)\s+(.+?)\s+(?:ஸ்டாக்\s+([\d.,]+))?(?:\s*விலை\s+([\d.,]+))?(?:\s*வகை\s+(.+?))?$/i,
  deleteProduct: /^(?:delete|remove)\s+product\s+(.+)$/i,
  deleteProductTamil: /^(?:பொருள்\s+நீக்கு)\s+(.+)$/i,

  // Supplier queries
  searchSupplier: /(?:search|find|show|get)\s+supplier\s+["']?([^"'\n]+)["']?/i,
  searchSupplierTamil: /(?:சப்ளையர்|விற்பனையாளர்)\s+([\w\s\-]+)\s*(?:தேடு|காண்பி)/i,
  listSuppliers: /(?:show|list|get)\s+(?:all\s+)?suppliers?/i,
  listSuppliersTamil: /(?:அனைத்து\s+சப்ளையர்கள்|சப்ளையர்கள்\s+பட்டியல்|விற்பனையாளர்கள்\s+காண்பி)/i,

  // Supplier CRUD
  createSupplierJson: /^(?:create|add)\s+supplier\s+\{[\s\S]*\}$/i,
  createSupplierInline:
    /^(?:create|add)\s+supplier\s+(.+?)(?:\s+gstin\s+([A-Z0-9]+))?(?:\s+phone\s+([+\d\-\s]+))?(?:\s+city\s+([\w\s]+))?$/i,
  createSupplierTamil:
    /^(?:சப்ளையர்\s+சேர்|விற்பனையாளர்\s+சேர்)\s+(.+?)(?:\s+ஜிஎஸ்டிஐஎன்\s+([A-Z0-9]+))?(?:\s+போன்\s+([+\d\-\s]+))?(?:\s+நகரம்\s+([\w\s]+))?$/i,
  deleteSupplier: /^(?:delete|remove)\s+supplier\s+(.+)$/i,
  deleteSupplierTamil: /^(?:சப்ளையர்\s+நீக்கு|விற்பனையாளர்\s+நீக்கு)\s+(.+)$/i,

  // Purchase order (simple, will be expanded in Phase 3)
  createPO: /(?:create|make|generate)\s+(?:a\s+)?(?:purchase\s+order|po)\s+(?:for|with)\s+["']?([^"'\n]+)["']?/i,

  // Help
  help: /^(?:help|what can you do|commands?|\/help)$/i,
};

export const parseCommand = async (
  input: string,
  userId: string,
  preferredLanguage?: 'en' | 'ta'
): Promise<CommandResult> => {
  const trimmedInput = input.trim();
  const tamil = preferredLanguage === 'ta' || isTamilInput(trimmedInput);

  try {
    // Help command
    if (patterns.help.test(trimmedInput) || patterns.helpTamil.test(trimmedInput)) {
      return {
        command: 'help',
        response: tamil
          ? `நான் உதவ முடியும்:

📦 **பொருள் கட்டளைகள்:**
- "பொருள் [பெயர்] தேடு"
- "குறைந்த இருப்பு காண்பி"
- "புதிய பொருள் சேர் [பெயர்] விலை [தொகை] ஸ்டாக் [எண்]"
- "பொருள் புதுப்பி [பெயர்] ஸ்டாக் [எண்]"
- "பொருள் நீக்கு [பெயர்]"

🏢 **சப்ளையர் கட்டளைகள்:**
- "சப்ளையர் [பெயர்] தேடு"
- "சப்ளையர் சேர் [பெயர்]"
- "சப்ளையர் நீக்கு [பெயர்]"

💰 **தகவல் பெறல்:**
- "மொத்த இருப்பு மதிப்பு"

எளிய தமிழிலும் ஆங்கிலத்திலும் கேட்கலாம்.`
          : `I can help you with:

📦 **Product Commands:**
- "Search product [name]" - Find products by name
- "Show low stock" - Display products with low inventory
- "List products" - List products
- "Add product [name] price [amount] stock [qty]" - Create product
- "Update product [name] set stock [qty]" - Update product
- "Delete product [name]" - Delete product
- "Show products in [category]" - Filter by category
- "Check stock of [product name]" - Get stock level

💰 **Inventory Commands:**
- "Show total inventory value" - Calculate total stock value

🏢 **Supplier Commands:**
- "Search supplier [name]" - Find suppliers
- "Show all suppliers" - List all suppliers
- "Add supplier [name]" - Create supplier
- "Delete supplier [name]" - Delete supplier

📝 **Purchase Orders:**
- "Create purchase order for [supplier]" - Start a new PO (coming soon with AI)

Type your question naturally, and I'll do my best to help!`,
      };
    }

    // List products
    if (patterns.listProducts.test(trimmedInput) || patterns.listProductsTamil.test(trimmedInput)) {
      const products = await prisma.product.findMany({
        include: { supplier: true },
        orderBy: { updatedAt: 'desc' },
        take: 25,
      });

      if (products.length === 0) {
        return {
          command: 'list_products',
          response: tamil ? 'இப்போது எந்த பொருளும் இல்லை.' : 'No products found.',
          data: { count: 0 },
        };
      }

      const list = products
        .map(
          (p, idx) =>
            `${idx + 1}. **${p.name}** - Stock: ${p.currentStock}, Price: ₹${p.unitPrice}, Category: ${p.category || 'N/A'}`
        )
        .join('\n');

      return {
        command: 'list_products',
        response: tamil
          ? `மொத்தம் ${products.length} பொருட்கள்:\n\n${list}`
          : `Found ${products.length} products:\n\n${list}`,
        data: { count: products.length, products },
      };
    }

    // Create product (JSON payload)
    if (patterns.createProductJson.test(trimmedInput)) {
      const payload = extractJsonPayload(trimmedInput);
      if (!payload || !payload.name || payload.unitPrice === undefined) {
        return {
          command: 'create_product',
          response: tamil
            ? 'JSON வடிவம் தவறு. உதாரணம்: add product {"name":"USB Cable","unitPrice":150}'
            : 'Invalid JSON payload. Example: add product {"name":"USB Cable","unitPrice":150}',
        };
      }

      const created = await prisma.product.create({
        data: {
          name: String(payload.name),
          description: payload.description ? String(payload.description) : null,
          category: payload.category ? String(payload.category) : null,
          hsnCode: payload.hsnCode ? String(payload.hsnCode) : null,
          gstRate: payload.gstRate !== undefined ? Number(payload.gstRate) : 18,
          currentStock: payload.currentStock !== undefined ? Number(payload.currentStock) : 0,
          reorderLevel: payload.reorderLevel !== undefined ? Number(payload.reorderLevel) : 10,
          unitPrice: Number(payload.unitPrice),
          supplierId: payload.supplierId ? String(payload.supplierId) : null,
          metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
        },
      });

      return {
        command: 'create_product',
        response: tamil
          ? `பொருள் உருவாக்கப்பட்டது: **${created.name}**`
          : `Product created successfully: **${created.name}**`,
        data: { product: created },
        inventoryUpdates: { type: 'product_created', productId: created.id },
      };
    }

    // Create product (inline)
    const createProductInlineMatch = patterns.createProductInline.exec(trimmedInput) ||
      patterns.createProductTamil.exec(trimmedInput);
    if (createProductInlineMatch) {
      const name = createProductInlineMatch[1]?.trim();
      const price = parseNumber(createProductInlineMatch[2]);
      const stock = parseNumber(createProductInlineMatch[3]) ?? 0;
      const category = createProductInlineMatch[4]?.trim() || null;
      const reorderLevel = parseNumber(createProductInlineMatch[5]) ?? 10;
      const supplierName = createProductInlineMatch[6]?.trim();

      if (!name || price === null) {
        return {
          command: 'create_product',
          response: tamil
            ? 'பொருள் பெயர் மற்றும் விலை அவசியம்.'
            : 'Product name and price are required.',
        };
      }

      let supplierId: string | null = null;
      if (supplierName) {
        const supplier = await prisma.supplier.findFirst({
          where: { name: { contains: supplierName } },
        });
        supplierId = supplier?.id || null;
      }

      const created = await prisma.product.create({
        data: {
          name,
          unitPrice: price,
          currentStock: Math.max(0, Math.trunc(stock)),
          reorderLevel: Math.max(0, Math.trunc(reorderLevel)),
          category,
          supplierId,
        },
      });

      return {
        command: 'create_product',
        response: tamil
          ? `புதிய பொருள் சேர்க்கப்பட்டது: **${created.name}**`
          : `Created product **${created.name}** with stock ${created.currentStock} and price ₹${created.unitPrice}.`,
        data: { product: created },
        inventoryUpdates: { type: 'product_created', productId: created.id },
      };
    }

    // Update product
    const updateProductMatch = patterns.updateProductInline.exec(trimmedInput) ||
      patterns.updateProductTamil.exec(trimmedInput);
    if (updateProductMatch) {
      const productName = updateProductMatch[1]?.trim();
      const stock = parseNumber(updateProductMatch[2]);
      const price = parseNumber(updateProductMatch[3]);
      const category = updateProductMatch[4]?.trim() || undefined;
      const reorderLevel = parseNumber(updateProductMatch[5]);

      if (!productName) {
        return {
          command: 'update_product',
          response: tamil ? 'பொருள் பெயரை கொடுக்கவும்.' : 'Please provide product name to update.',
        };
      }

      const existing = await prisma.product.findFirst({ where: { name: { contains: productName } } });
      if (!existing) {
        return {
          command: 'update_product',
          response: tamil ? `"${productName}" பொருள் கிடைக்கவில்லை.` : `Product "${productName}" not found.`,
        };
      }

      const updateData: any = {};
      if (stock !== null) updateData.currentStock = Math.max(0, Math.trunc(stock));
      if (price !== null) updateData.unitPrice = price;
      if (category !== undefined) updateData.category = category;
      if (reorderLevel !== null) updateData.reorderLevel = Math.max(0, Math.trunc(reorderLevel));

      if (Object.keys(updateData).length === 0) {
        return {
          command: 'update_product',
          response: tamil
            ? 'புதுப்பிக்க எந்த மதிப்பும் கொடுக்கவில்லை.'
            : 'No update fields provided. Try stock/price/category/reorder.',
        };
      }

      const updated = await prisma.product.update({
        where: { id: existing.id },
        data: updateData,
      });

      return {
        command: 'update_product',
        response: tamil
          ? `பொருள் புதுப்பிக்கப்பட்டது: **${updated.name}**`
          : `Updated product **${updated.name}** successfully.`,
        data: { product: updated },
        inventoryUpdates: { type: 'product_updated', productId: updated.id },
      };
    }

    // Delete product
    const deleteProductMatch = patterns.deleteProduct.exec(trimmedInput) ||
      patterns.deleteProductTamil.exec(trimmedInput);
    if (deleteProductMatch) {
      const productName = deleteProductMatch[1].trim();
      const existing = await prisma.product.findFirst({
        where: { name: { contains: productName } },
      });

      if (!existing) {
        return {
          command: 'delete_product',
          response: tamil ? `"${productName}" பொருள் கிடைக்கவில்லை.` : `Product "${productName}" not found.`,
        };
      }

      await prisma.product.delete({ where: { id: existing.id } });

      return {
        command: 'delete_product',
        response: tamil
          ? `பொருள் நீக்கப்பட்டது: **${existing.name}**`
          : `Deleted product **${existing.name}** successfully.`,
        data: { productId: existing.id, name: existing.name },
        inventoryUpdates: { type: 'product_deleted', productId: existing.id },
      };
    }

    // Search product
    const searchProductMatch = patterns.searchProduct.exec(trimmedInput);
    const searchProductTamilMatch = patterns.searchProductTamil.exec(trimmedInput);
    if (searchProductMatch || searchProductTamilMatch) {
      const searchTerm = (searchProductMatch?.[1] || searchProductTamilMatch?.[1] || '').trim();
      const products = await prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm } },
            { description: { contains: searchTerm } },
            { hsnCode: { contains: searchTerm } },
          ],
        },
        include: {
          supplier: true,
        },
        take: 10,
      });

      if (products.length === 0) {
        return {
          command: 'search_product',
          response: tamil
            ? `"${searchTerm}" பொருள் கிடைக்கவில்லை.`
            : `No products found matching "${searchTerm}". Try a different search term.`,
          data: { searchTerm, count: 0 },
        };
      }

      const productList = products
        .map(
          (p, idx) =>
            `${idx + 1}. **${p.name}** - Stock: ${p.currentStock} units, Price: ₹${p.unitPrice}\n   Supplier: ${p.supplier?.name || 'N/A'}`
        )
        .join('\n');

      return {
        command: 'search_product',
        response: tamil
          ? `"${searchTerm}" க்கு ${products.length} பொருட்கள் கிடைத்தது:\n\n${productList}`
          : `Found ${products.length} product(s) matching "${searchTerm}":\n\n${productList}`,
        data: { searchTerm, count: products.length, products },
      };
    }

    // Low stock
    if (patterns.lowStock.test(trimmedInput) || patterns.lowStockTamil.test(trimmedInput)) {
      const lowStockProducts = await prisma.product.findMany({
        where: {
          currentStock: {
            lte: prisma.product.fields.reorderLevel,
          },
        },
        include: {
          supplier: true,
        },
        orderBy: {
          currentStock: 'asc',
        },
        take: 20,
      });

      if (lowStockProducts.length === 0) {
        return {
          command: 'low_stock',
          response: tamil
            ? 'அருமை! எல்லா பொருட்களுக்கும் போதுமான ஸ்டாக் உள்ளது.'
            : 'Great news! All products have sufficient stock levels. 🎉',
          data: { count: 0 },
        };
      }

      const productList = lowStockProducts
        .map(
          (p, idx) =>
            `${idx + 1}. **${p.name}** - Current: ${p.currentStock}, Reorder: ${p.reorderLevel}\n   Supplier: ${p.supplier?.name || 'N/A'} | Price: ₹${p.unitPrice}`
        )
        .join('\n');

      return {
        command: 'low_stock',
        response: tamil
          ? `⚠️ குறைந்த ஸ்டாக் உள்ள ${lowStockProducts.length} பொருட்கள்:\n\n${productList}`
          : `⚠️ Found ${lowStockProducts.length} product(s) with low stock:\n\n${productList}\n\nConsider placing purchase orders for these items.`,
        data: { count: lowStockProducts.length, products: lowStockProducts },
      };
    }

    // Products by category
    const categoryMatch = patterns.productsByCategory.exec(trimmedInput);
    if (categoryMatch) {
      const category = categoryMatch[1];
      const products = await prisma.product.findMany({
        where: {
          category: {
            contains: category,
          },
        },
        include: {
          supplier: true,
        },
        take: 20,
      });

      if (products.length === 0) {
        return {
          command: 'products_by_category',
          response: `No products found in category "${category}".`,
          data: { category, count: 0 },
        };
      }

      const productList = products
        .map(
          (p, idx) =>
            `${idx + 1}. **${p.name}** - Stock: ${p.currentStock}, Price: ₹${p.unitPrice}`
        )
        .join('\n');

      return {
        command: 'products_by_category',
        response: `Found ${products.length} product(s) in "${category}":\n\n${productList}`,
        data: { category, count: products.length, products },
      };
    }

    // Check stock
    const stockMatch = patterns.checkStock.exec(trimmedInput);
    const stockTamilMatch = patterns.checkStockTamil.exec(trimmedInput);
    if (stockMatch || stockTamilMatch) {
      const productName = (stockMatch?.[1] || stockTamilMatch?.[1] || '').trim();
      const product = await prisma.product.findFirst({
        where: {
          name: { contains: productName },
        },
        include: {
          supplier: true,
        },
      });

      if (!product) {
        return {
          command: 'check_stock',
          response: tamil
            ? `"${productName}" பொருள் கிடைக்கவில்லை.`
            : `Product "${productName}" not found. Please check the name and try again.`,
          data: { productName },
        };
      }

      const stockStatus =
        product.currentStock <= product.reorderLevel
          ? '⚠️ LOW STOCK'
          : product.currentStock === 0
          ? '❌ OUT OF STOCK'
          : '✅ IN STOCK';

      return {
        command: 'check_stock',
        response: tamil
          ? `**${product.name}** ${stockStatus}\n\nதற்போதைய ஸ்டாக்: ${product.currentStock}\nரீஆர்டர் நிலை: ${product.reorderLevel}\nஒன்றின் விலை: ₹${product.unitPrice}\nசப்ளையர்: ${product.supplier?.name || 'N/A'}`
          : `**${product.name}** ${stockStatus}\n\nCurrent Stock: ${product.currentStock} units\nReorder Level: ${product.reorderLevel} units\nUnit Price: ₹${product.unitPrice}\nSupplier: ${product.supplier?.name || 'N/A'}\nCategory: ${product.category || 'N/A'}`,
        data: { product },
      };
    }

    // Total inventory value
    if (patterns.totalInventoryValue.test(trimmedInput) || patterns.totalInventoryValueTamil.test(trimmedInput)) {
      const products = await prisma.product.findMany({
        select: {
          currentStock: true,
          unitPrice: true,
          name: true,
        },
      });

      const totalValue = products.reduce(
        (sum, p) => sum + p.currentStock * p.unitPrice,
        0
      );
      const totalItems = products.reduce((sum, p) => sum + p.currentStock, 0);

      return {
        command: 'total_inventory_value',
        response: tamil
          ? `📊 **இருப்பு சுருக்கம்:**\n\nமொத்த பொருட்கள்: ${products.length}\nமொத்த ஸ்டாக்: ${totalItems}\nமொத்த மதிப்பு: ₹${totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
          : `📊 **Inventory Summary:**\n\nTotal Products: ${products.length}\nTotal Items in Stock: ${totalItems}\nTotal Inventory Value: ₹${totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        data: { totalValue, totalItems, productCount: products.length },
      };
    }

    // Create supplier (JSON payload)
    if (patterns.createSupplierJson.test(trimmedInput)) {
      const payload = extractJsonPayload(trimmedInput);
      if (!payload || !payload.name) {
        return {
          command: 'create_supplier',
          response: tamil
            ? 'JSON வடிவம் தவறு. உதாரணம்: add supplier {"name":"ABC Traders"}'
            : 'Invalid JSON payload. Example: add supplier {"name":"ABC Traders"}',
        };
      }

      const created = await prisma.supplier.create({
        data: {
          name: String(payload.name),
          gstin: payload.gstin ? String(payload.gstin) : null,
          email: payload.email ? String(payload.email) : null,
          phone: payload.phone ? String(payload.phone) : null,
          city: payload.city ? String(payload.city) : null,
          state: payload.state ? String(payload.state) : null,
          activeStatus: payload.activeStatus !== undefined ? Number(payload.activeStatus) : 1,
        },
      });

      return {
        command: 'create_supplier',
        response: tamil
          ? `சப்ளையர் சேர்க்கப்பட்டது: **${created.name}**`
          : `Supplier created successfully: **${created.name}**`,
        data: { supplier: created },
      };
    }

    // Create supplier (inline)
    const createSupplierMatch = patterns.createSupplierInline.exec(trimmedInput) ||
      patterns.createSupplierTamil.exec(trimmedInput);
    if (createSupplierMatch) {
      const name = createSupplierMatch[1]?.trim();
      const gstin = createSupplierMatch[2]?.trim();
      const phone = createSupplierMatch[3]?.trim();
      const city = createSupplierMatch[4]?.trim();

      if (!name) {
        return {
          command: 'create_supplier',
          response: tamil ? 'சப்ளையர் பெயர் அவசியம்.' : 'Supplier name is required.',
        };
      }

      const created = await prisma.supplier.create({
        data: {
          name,
          gstin: gstin || null,
          phone: phone || null,
          city: city || null,
          activeStatus: 1,
        },
      });

      return {
        command: 'create_supplier',
        response: tamil
          ? `சப்ளையர் சேர்க்கப்பட்டது: **${created.name}**`
          : `Created supplier **${created.name}** successfully.`,
        data: { supplier: created },
      };
    }

    // Search supplier
    const supplierMatch = patterns.searchSupplier.exec(trimmedInput);
    const supplierTamilMatch = patterns.searchSupplierTamil.exec(trimmedInput);
    if (supplierMatch || supplierTamilMatch) {
      const supplierName = (supplierMatch?.[1] || supplierTamilMatch?.[1] || '').trim();
      const suppliers = await prisma.supplier.findMany({
        where: {
          name: { contains: supplierName },
        },
        include: {
          products: {
            select: {
              id: true,
            },
          },
        },
        take: 10,
      });

      if (suppliers.length === 0) {
        return {
          command: 'search_supplier',
          response: tamil
            ? `"${supplierName}" சப்ளையர் கிடைக்கவில்லை.`
            : `No suppliers found matching "${supplierName}".`,
          data: { supplierName, count: 0 },
        };
      }

      const supplierList = suppliers
        .map(
          (s, idx) =>
            `${idx + 1}. **${s.name}**\n   Products: ${s.products.length} | Rating: ${s.rating || 'N/A'} ⭐\n   Contact: ${s.email || s.phone || 'N/A'}\n   GSTIN: ${s.gstin || 'N/A'}`
        )
        .join('\n');

      return {
        command: 'search_supplier',
        response: tamil
          ? `"${supplierName}" க்கு ${suppliers.length} சப்ளையர்கள் கிடைத்தனர்:\n\n${supplierList}`
          : `Found ${suppliers.length} supplier(s) matching "${supplierName}":\n\n${supplierList}`,
        data: { supplierName, count: suppliers.length, suppliers },
      };
    }

    // List all suppliers
    if (patterns.listSuppliers.test(trimmedInput) || patterns.listSuppliersTamil.test(trimmedInput)) {
      const suppliers = await prisma.supplier.findMany({
        where: {
          activeStatus: 1,
        },
        include: {
          products: {
            select: {
              id: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
        take: 20,
      });

      if (suppliers.length === 0) {
        return {
          command: 'list_suppliers',
          response: tamil ? 'செயலில் உள்ள சப்ளையர்கள் இல்லை.' : 'No active suppliers found in the system.',
          data: { count: 0 },
        };
      }

      const supplierList = suppliers
        .map(
          (s, idx) =>
            `${idx + 1}. **${s.name}** (${s.products.length} products) - ${s.city || 'N/A'}, ${s.state || 'N/A'}`
        )
        .join('\n');

      return {
        command: 'list_suppliers',
        response: tamil
          ? `செயலில் உள்ள சப்ளையர்கள் (${suppliers.length}):\n\n${supplierList}`
          : `Active Suppliers (${suppliers.length}):\n\n${supplierList}`,
        data: { count: suppliers.length, suppliers },
      };
    }

    // Delete supplier
    const deleteSupplierMatch = patterns.deleteSupplier.exec(trimmedInput) ||
      patterns.deleteSupplierTamil.exec(trimmedInput);
    if (deleteSupplierMatch) {
      const supplierName = deleteSupplierMatch[1].trim();
      const supplier = await prisma.supplier.findFirst({
        where: { name: { contains: supplierName } },
      });

      if (!supplier) {
        return {
          command: 'delete_supplier',
          response: tamil ? `"${supplierName}" சப்ளையர் கிடைக்கவில்லை.` : `Supplier "${supplierName}" not found.`,
        };
      }

      const productCount = await prisma.product.count({ where: { supplierId: supplier.id } });
      if (productCount > 0) {
        return {
          command: 'delete_supplier',
          response: tamil
            ? `இந்த சப்ளையருடன் ${productCount} பொருட்கள் இணைக்கப்பட்டுள்ளன. முதலில் அந்த பொருட்களை மாற்றவும்.`
            : `Cannot delete supplier. ${productCount} products are linked to this supplier.`,
        };
      }

      await prisma.supplier.delete({ where: { id: supplier.id } });

      return {
        command: 'delete_supplier',
        response: tamil
          ? `சப்ளையர் நீக்கப்பட்டது: **${supplier.name}**`
          : `Deleted supplier **${supplier.name}** successfully.`,
        data: { supplierId: supplier.id },
      };
    }

    // Create PO (simple version, will be enhanced in Phase 3)
    const poMatch = patterns.createPO.exec(trimmedInput);
    if (poMatch) {
      const supplierName = poMatch[1];
      return {
        command: 'create_po',
        response: `Creating a purchase order requires advanced AI capabilities. This feature will be available in Phase 3 with GPT-4 integration.\n\nFor now, please use the Purchase Orders page in the application to create orders manually.`,
        data: { supplierName },
      };
    }

    // No command matched - generic response
    return {
      command: null,
      response: tamil
        ? `நான் இதை புரிந்துகொண்டேன்: "${trimmedInput}"\n\nஇந்த கட்டளைகளை முயற்சிக்கவும்:\n- "உதவி"\n- "குறைந்த இருப்பு காண்பி"\n- "பொருள் [பெயர்] தேடு"\n- "புதிய பொருள் சேர் [பெயர்] விலை [தொகை]"\n- "சப்ளையர் சேர் [பெயர்]"`
        : `I understand you want to: "${trimmedInput}"\n\nTry these commands:\n- "help"\n- "show low stock"\n- "search product [name]"\n- "add product [name] price [amount] stock [qty]"\n- "add supplier [name]"\n- "list suppliers"`,
    };
  } catch (error) {
    console.error('Error parsing command:', error);
    return {
      command: 'error',
      response: 'Sorry, I encountered an error processing your request. Please try again.',
    };
  }
};
