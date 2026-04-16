const PDFDocument = require('pdfkit');
const fs = require('fs');

const outputPath = './backend/uploads/invoices/demo_invoice_10_items.pdf';

const items = [
	{ name: 'Basmati Rice 5kg', qty: 2, unitPrice: 620 },
	{ name: 'Sunflower Oil 1L', qty: 6, unitPrice: 150 },
	{ name: 'Toor Dal 1kg', qty: 4, unitPrice: 130 },
	{ name: 'Sugar 1kg', qty: 5, unitPrice: 45 },
	{ name: 'Tea Powder 500g', qty: 3, unitPrice: 220 },
	{ name: 'Bath Soap Pack', qty: 8, unitPrice: 38 },
	{ name: 'Washing Powder 1kg', qty: 3, unitPrice: 95 },
	{ name: 'Milk Biscuit Box', qty: 7, unitPrice: 30 },
	{ name: 'Turmeric Powder 200g', qty: 5, unitPrice: 42 },
	{ name: 'Chilli Powder 200g', qty: 5, unitPrice: 55 },
];

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

function generateInvoicePdf() {
	return new Promise((resolve, reject) => {
		const doc = new PDFDocument({ size: 'A4', margin: 48 });
		const stream = fs.createWriteStream(outputPath);

		stream.on('finish', resolve);
		stream.on('error', reject);
		doc.on('error', reject);

		doc.pipe(stream);

		fs.mkdirSync('./backend/uploads/invoices', { recursive: true });

		const invoiceNumber = `INV-10ITEM-${Date.now()}`;
		const invoiceDate = new Date().toISOString().slice(0, 10);
		const subtotal = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
		const cgst = subtotal * 0.09;
		const sgst = subtotal * 0.09;
		const total = subtotal + cgst + sgst;

		doc.font('Helvetica-Bold').fontSize(20).text('GST Invoice', { align: 'center' });
		doc.moveDown(0.8);

		doc.font('Helvetica').fontSize(12);
		doc.text(`Invoice Number: ${invoiceNumber}`);
		doc.text(`Invoice Date: ${invoiceDate}`);
		doc.text('Supplier: Nand Stores Wholesale');
		doc.text('Supplier GSTIN: 29ABCDE1234F1Z5');
		doc.text('Supplier Address: 45 Market Road, Bengaluru, Karnataka');
		doc.moveDown(0.8);

		doc.font('Courier-Bold').fontSize(12).text('Item Name                  Qty  UnitPrice     Amount', {
			lineBreak: false,
		});
		doc.moveDown(0.3);
		doc.font('Courier').fontSize(11);

		for (const item of items) {
			const amount = item.qty * item.unitPrice;
			doc.text(padLine(item.name, item.qty, item.unitPrice, amount), {
				lineBreak: false,
			});
			doc.moveDown(0.4);
		}

		doc.moveDown(0.8);
		doc.font('Helvetica').fontSize(12);
		doc.text(`Subtotal: ${formatMoney(subtotal)}`);
		doc.text(`CGST: ${formatMoney(cgst)}`);
		doc.text(`SGST: ${formatMoney(sgst)}`);
		doc.text('IGST: 0.00');
		doc.text(`Total Amount: ${formatMoney(total)}`);

		doc.end();
	});
}

generateInvoicePdf()
	.then(() => {
		const stats = fs.statSync(outputPath);
		console.log(`Sample GST invoice PDF generated at ${outputPath} (${stats.size} bytes)`);
	})
	.catch((err) => {
		console.error('Failed to generate sample PDF:', err.message);
		process.exitCode = 1;
	});
