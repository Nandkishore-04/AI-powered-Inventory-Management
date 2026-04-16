const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, 'backend', 'uploads', 'invoices');

function formatMoney(value) {
  return Number(value).toFixed(2);
}

function padLine(name, qty, unitPrice, amount) {
  const itemName = String(name).slice(0, 26).padEnd(26, ' ');
  const qtyText = String(qty).padStart(3, ' ');
  const priceText = formatMoney(unitPrice).padStart(10, ' ');
  const amountText = formatMoney(amount).padStart(10, ' ');
  return `${itemName} ${qtyText} ${priceText} ${amountText}`;
}

function writeInvoicePdf(invoice) {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(outputDir, invoice.fileName);
    const doc = new PDFDocument({ size: 'A4', margin: 44 });
    const stream = fs.createWriteStream(outputPath);

    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
    doc.on('error', reject);

    doc.pipe(stream);

    const subtotal = invoice.items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
    const cgst = Number((subtotal * 0.09).toFixed(2));
    const sgst = Number((subtotal * 0.09).toFixed(2));
    const total = Number((subtotal + cgst + sgst).toFixed(2));

    doc.font('Helvetica-Bold').fontSize(18).text('TAX INVOICE', { align: 'center' });
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(10).text('Original for Recipient', { align: 'center' });

    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(12).text(invoice.vendorName);
    doc.font('Helvetica').fontSize(10);
    doc.text(invoice.vendorAddress);
    doc.text(`GSTIN: ${invoice.vendorGSTIN}`);
    doc.text(`PAN: ${invoice.vendorPAN}`);

    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(10).text('Bill To', { continued: true });
    doc.font('Helvetica').text(`: ${invoice.buyerName}`);
    doc.text(`Invoice Number: ${invoice.invoiceNumber}`);
    doc.text(`Invoice Date: ${invoice.invoiceDate}`);
    doc.text(`Supplier: ${invoice.supplierName}`);
    doc.text(`Supplier GSTIN: ${invoice.supplierGSTIN}`);
    doc.text(`Supplier Address: ${invoice.supplierAddress}`);
    doc.text(`Payment Terms: ${invoice.paymentTerms}`);

    doc.moveDown(0.7);
    doc.font('Courier-Bold').fontSize(11).text('Item Name                  Qty  UnitPrice     Amount');

    doc.moveDown(0.2);
    doc.font('Courier').fontSize(10.5);
    for (const item of invoice.items) {
      const amount = item.qty * item.unitPrice;
      doc.text(padLine(item.name, item.qty, item.unitPrice, amount));
      doc.moveDown(0.35);
    }

    doc.moveDown(0.6);
    doc.font('Helvetica').fontSize(10.5);
    doc.text(`Subtotal: ${formatMoney(subtotal)}`);
    doc.text(`CGST: ${formatMoney(cgst)}`);
    doc.text(`SGST: ${formatMoney(sgst)}`);
    doc.text('IGST: 0.00');
    doc.font('Helvetica-Bold').text(`Total Amount: ${formatMoney(total)}`);

    doc.moveDown(0.8);
    doc.font('Helvetica').fontSize(9);
    doc.text('Declaration: Goods once sold will not be taken back.', { align: 'left' });
    doc.text('This is a computer generated invoice.', { align: 'left' });

    doc.end();
  });
}

const invoices = [
  {
    fileName: 'professional_invoice_01.pdf',
    invoiceNumber: 'PRO-2026-001',
    invoiceDate: '2026-04-14',
    vendorName: 'Southline Distribution Pvt Ltd',
    vendorAddress: '19 Industrial Estate, Bengaluru, Karnataka - 560048',
    vendorGSTIN: '29AABCS1234D1Z9',
    vendorPAN: 'AABCS1234D',
    buyerName: 'Sri Nand Retail Mart',
    supplierName: 'Southline Distribution Pvt Ltd',
    supplierGSTIN: '29AABCS1234D1Z9',
    supplierAddress: '19 Industrial Estate, Bengaluru, Karnataka',
    paymentTerms: 'Net 15 Days',
    items: [
      { name: 'Basmati Rice 5kg', qty: 4, unitPrice: 620 },
      { name: 'Toor Dal Premium 1kg', qty: 6, unitPrice: 138 },
      { name: 'Sugar Refined 1kg', qty: 10, unitPrice: 46 },
      { name: 'Sunflower Oil 1L', qty: 12, unitPrice: 154 },
      { name: 'Tea Leaf Gold 500g', qty: 5, unitPrice: 228 },
      { name: 'Chilli Powder 200g', qty: 8, unitPrice: 58 },
      { name: 'Turmeric Powder 200g', qty: 8, unitPrice: 44 },
      { name: 'Bath Soap Pack 4', qty: 14, unitPrice: 39 },
      { name: 'Detergent Powder 1kg', qty: 7, unitPrice: 98 },
      { name: 'Milk Biscuit Box', qty: 15, unitPrice: 31 },
    ],
  },
  {
    fileName: 'professional_invoice_02.pdf',
    invoiceNumber: 'PRO-2026-002',
    invoiceDate: '2026-04-15',
    vendorName: 'Metro Wholesale Traders LLP',
    vendorAddress: '44 Central Market Road, Chennai, Tamil Nadu - 600032',
    vendorGSTIN: '33AACCM4321F1Z3',
    vendorPAN: 'AACCM4321F',
    buyerName: 'Sri Nand Retail Mart',
    supplierName: 'Metro Wholesale Traders LLP',
    supplierGSTIN: '33AACCM4321F1Z3',
    supplierAddress: '44 Central Market Road, Chennai, Tamil Nadu',
    paymentTerms: 'Net 10 Days',
    items: [
      { name: 'Sona Masoori Rice 25kg', qty: 2, unitPrice: 1480 },
      { name: 'Urad Dal 1kg', qty: 8, unitPrice: 132 },
      { name: 'Chana Dal 1kg', qty: 8, unitPrice: 96 },
      { name: 'Groundnut Oil 1L', qty: 10, unitPrice: 168 },
      { name: 'Mustard Oil 1L', qty: 8, unitPrice: 174 },
      { name: 'Salt Iodized 1kg', qty: 18, unitPrice: 22 },
      { name: 'Coriander Powder 200g', qty: 9, unitPrice: 41 },
      { name: 'Jeera Whole 200g', qty: 7, unitPrice: 66 },
      { name: 'Besan Flour 1kg', qty: 10, unitPrice: 78 },
      { name: 'Rusk Premium Pack', qty: 16, unitPrice: 34 },
    ],
  },
  {
    fileName: 'professional_invoice_03.pdf',
    invoiceNumber: 'PRO-2026-003',
    invoiceDate: '2026-04-16',
    vendorName: 'Prime FMCG Supplies',
    vendorAddress: '71 Commerce Hub, Hyderabad, Telangana - 500081',
    vendorGSTIN: '36AABCP5566K1Z4',
    vendorPAN: 'AABCP5566K',
    buyerName: 'Sri Nand Retail Mart',
    supplierName: 'Prime FMCG Supplies',
    supplierGSTIN: '36AABCP5566K1Z4',
    supplierAddress: '71 Commerce Hub, Hyderabad, Telangana',
    paymentTerms: 'Net 7 Days',
    items: [
      { name: 'Cooking Oil Blend 1L', qty: 14, unitPrice: 149 },
      { name: 'Atta Chakki Fresh 5kg', qty: 6, unitPrice: 272 },
      { name: 'Poha Thick 1kg', qty: 12, unitPrice: 58 },
      { name: 'Suji Premium 1kg', qty: 10, unitPrice: 52 },
      { name: 'Vermicelli Roasted 850g', qty: 8, unitPrice: 64 },
      { name: 'Instant Coffee 100g', qty: 6, unitPrice: 142 },
      { name: 'Green Tea Bags 25', qty: 7, unitPrice: 116 },
      { name: 'Tomato Ketchup 950g', qty: 10, unitPrice: 89 },
      { name: 'Noodles Family Pack', qty: 18, unitPrice: 27 },
      { name: 'Tissue Box 200 Pulls', qty: 12, unitPrice: 48 },
    ],
  },
  {
    fileName: 'professional_invoice_04.pdf',
    invoiceNumber: 'PRO-2026-004',
    invoiceDate: '2026-04-17',
    vendorName: 'Urban Mart Distributors',
    vendorAddress: '88 Trade Tower, Pune, Maharashtra - 411014',
    vendorGSTIN: '27AABCU7788L1Z2',
    vendorPAN: 'AABCU7788L',
    buyerName: 'Sri Nand Retail Mart',
    supplierName: 'Urban Mart Distributors',
    supplierGSTIN: '27AABCU7788L1Z2',
    supplierAddress: '88 Trade Tower, Pune, Maharashtra',
    paymentTerms: 'Net 21 Days',
    items: [
      { name: 'Shampoo Bottle 340ml', qty: 9, unitPrice: 176 },
      { name: 'Hair Oil Coconut 200ml', qty: 12, unitPrice: 74 },
      { name: 'Toothpaste Fresh 150g', qty: 14, unitPrice: 62 },
      { name: 'Toothbrush Medium', qty: 20, unitPrice: 23 },
      { name: 'Handwash Liquid 250ml', qty: 12, unitPrice: 69 },
      { name: 'Face Wash Gentle 100ml', qty: 8, unitPrice: 118 },
      { name: 'Body Lotion 200ml', qty: 7, unitPrice: 132 },
      { name: 'Laundry Bar 250g', qty: 24, unitPrice: 19 },
      { name: 'Floor Cleaner 1L', qty: 10, unitPrice: 93 },
      { name: 'Dishwash Gel 500ml', qty: 11, unitPrice: 81 },
    ],
  },
  {
    fileName: 'professional_invoice_05.pdf',
    invoiceNumber: 'PRO-2026-005',
    invoiceDate: '2026-04-18',
    vendorName: 'National Grocery Network',
    vendorAddress: '12 Logistics Park, Ahmedabad, Gujarat - 380058',
    vendorGSTIN: '24AABCN9900P1Z8',
    vendorPAN: 'AABCN9900P',
    buyerName: 'Sri Nand Retail Mart',
    supplierName: 'National Grocery Network',
    supplierGSTIN: '24AABCN9900P1Z8',
    supplierAddress: '12 Logistics Park, Ahmedabad, Gujarat',
    paymentTerms: 'Net 14 Days',
    items: [
      { name: 'Dry Fruit Mix 250g', qty: 8, unitPrice: 212 },
      { name: 'Cashew Grade W320 250g', qty: 7, unitPrice: 238 },
      { name: 'Raisin Premium 250g', qty: 9, unitPrice: 124 },
      { name: 'Almond Raw 250g', qty: 8, unitPrice: 226 },
      { name: 'Peanut Roasted 500g', qty: 11, unitPrice: 86 },
      { name: 'Jaggery Cube 1kg', qty: 10, unitPrice: 74 },
      { name: 'Honey Pure 500g', qty: 6, unitPrice: 179 },
      { name: 'Instant Oats 1kg', qty: 9, unitPrice: 139 },
      { name: 'Corn Flakes 475g', qty: 10, unitPrice: 118 },
      { name: 'Muesli Fruit 500g', qty: 7, unitPrice: 164 },
    ],
  },
];

async function generateAll() {
  fs.mkdirSync(outputDir, { recursive: true });

  const generated = [];
  for (const invoice of invoices) {
    const outputPath = await writeInvoicePdf(invoice);
    const stats = fs.statSync(outputPath);
    generated.push({
      file: path.basename(outputPath),
      size: stats.size,
      invoiceNumber: invoice.invoiceNumber,
      supplier: invoice.supplierName,
      items: invoice.items.length,
    });
  }

  console.log(JSON.stringify({ generatedCount: generated.length, generated }, null, 2));
}

generateAll().catch((error) => {
  console.error('Failed to generate professional invoices:', error.message);
  process.exitCode = 1;
});
