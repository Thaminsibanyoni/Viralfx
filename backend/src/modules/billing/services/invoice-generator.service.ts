import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { ConfigService } from '@nestjs/config';
import { BrokerBill } from "../../brokers/entities/broker-bill.entity";

@Injectable()
export class InvoiceGeneratorService {
  private readonly logger = new Logger(InvoiceGeneratorService.name);

  constructor(
    private readonly configService: ConfigService) {}

  async generateInvoice(bill: BrokerBill): Promise<Buffer> {
    try {
      // Create a new PDF document
      const pdfDoc = await PDFDocument.create();

      // Add a blank page to the document
      const page = pdfDoc.addPage([595.28, 841.89]); // A4 size in points

      // Get the standard font
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Set up some constants for layout
      const margin = 50;
      const pageWidth = page.getWidth();
      const pageHeight = page.getHeight();

      // Header section
      // Company name and address (left side)
      const companyName = this.configService.get<string>('INVOICE_COMPANY_NAME') || 'ViralFX';
      const companyAddress = this.configService.get<string>('INVOICE_COMPANY_ADDRESS') || '123 Business Avenue, Sandton, Johannesburg, 2196';
      const companyEmail = this.configService.get<string>('INVOICE_COMPANY_EMAIL') || 'billing@viralfx.co.za';
      const companyPhone = this.configService.get<string>('INVOICE_COMPANY_PHONE') || '+27 11 234 5678';

      page.drawText(companyName, {
        x: margin,
        y: pageHeight - margin,
        size: 24,
        font: boldFont,
        color: rgb(0.2, 0.2, 0.2)
      });

      page.drawText(companyAddress, {
        x: margin,
        y: pageHeight - margin - 30,
        size: 10,
        font,
        color: rgb(0.4, 0.4, 0.4)
      });

      page.drawText(`Email: ${companyEmail}`, {
        x: margin,
        y: pageHeight - margin - 45,
        size: 10,
        font,
        color: rgb(0.4, 0.4, 0.4)
      });

      page.drawText(`Phone: ${companyPhone}`, {
        x: margin,
        y: pageHeight - margin - 60,
        size: 10,
        font,
        color: rgb(0.4, 0.4, 0.4)
      });

      // Invoice details (right side)
      const invoiceNumber = bill.invoiceNumber || `INV-${bill.id}`;
      const invoiceDate = bill.createdAt.toLocaleDateString();
      const dueDate = new Date(bill.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(); // 30 days

      page.drawText('INVOICE', {
        x: pageWidth - margin - 80,
        y: pageHeight - margin - 20,
        size: 28,
        font: boldFont,
        color: rgb(0.1, 0.1, 0.1)
      });

      page.drawText(`Invoice #: ${invoiceNumber}`, {
        x: pageWidth - margin - 150,
        y: pageHeight - margin - 55,
        size: 12,
        font,
        color: rgb(0.3, 0.3, 0.3)
      });

      page.drawText(`Date: ${invoiceDate}`, {
        x: pageWidth - margin - 150,
        y: pageHeight - margin - 70,
        size: 12,
        font,
        color: rgb(0.3, 0.3, 0.3)
      });

      page.drawText(`Due Date: ${dueDate}`, {
        x: pageWidth - margin - 150,
        y: pageHeight - margin - 85,
        size: 12,
        font,
        color: rgb(0.3, 0.3, 0.3)
      });

      // Bill To section
      let currentY = pageHeight - margin - 120;
      page.drawText('BILL TO:', {
        x: margin,
        y: currentY,
        size: 14,
        font: boldFont,
        color: rgb(0.2, 0.2, 0.2)
      });

      currentY -= 20;
      page.drawText(bill.broker.businessName || bill.broker.name, {
        x: margin,
        y: currentY,
        size: 12,
        font: boldFont,
        color: rgb(0.3, 0.3, 0.3)
      });

      currentY -= 15;
      page.drawText(bill.broker.email, {
        x: margin,
        y: currentY,
        size: 10,
        font,
        color: rgb(0.4, 0.4, 0.4)
      });

      if (bill.broker.phone) {
        currentY -= 15;
        page.drawText(bill.broker.phone, {
          x: margin,
          y: currentY,
          size: 10,
          font,
          color: rgb(0.4, 0.4, 0.4)
        });
      }

      if (bill.broker.address) {
        currentY -= 15;
        page.drawText(bill.broker.address, {
          x: margin,
          y: currentY,
          size: 10,
          font,
          color: rgb(0.4, 0.4, 0.4)
        });
      }

      // Table header
      currentY -= 40;
      const tableStartY = currentY;
      const tableHeaders = ['Description', 'Quantity', 'Unit Price', 'Amount'];
      const columnWidths = [250, 80, 80, 80];
      let currentX = margin;

      // Draw table headers background
      page.drawRectangle({
        x: margin,
        y: currentY - 5,
        width: pageWidth - 2 * margin,
        height: 25,
        color: rgb(0.95, 0.95, 0.95)
      });

      // Draw table headers
      tableHeaders.forEach((header, index) => {
        page.drawText(header, {
          x: currentX + 5,
          y: currentY + 5,
          size: 10,
          font: boldFont,
          color: rgb(0.2, 0.2, 0.2)
        });
        currentX += columnWidths[index];
      });

      // Draw table line below headers
      currentY -= 20;
      page.drawLine({
        start: { x: margin, y: currentY },
        end: { x: pageWidth - margin, y: currentY },
        thickness: 1,
        color: rgb(0.8, 0.8, 0.8)
      });

      // Table rows
      const lineItems = [
        {
          description: `Monthly Subscription Fee (${bill.broker.tier || 'STARTER'} Tier)`,
          quantity: 1,
          unitPrice: bill.baseFee,
          amount: bill.baseFee
        },
        ...(bill.transactionFees > 0 ? [{
          description: 'Transaction Processing Fees',
          quantity: 1,
          unitPrice: bill.transactionFees,
          amount: bill.transactionFees
        }] : []),
        ...(bill.additionalServices > 0 ? [{
          description: 'Additional Services',
          quantity: 1,
          unitPrice: bill.additionalServices,
          amount: bill.additionalServices
        }] : []),
        ...(bill.volumeDiscount > 0 ? [{
          description: 'Volume Discount',
          quantity: 1,
          unitPrice: -bill.volumeDiscount,
          amount: -bill.volumeDiscount
        }] : []),
      ];

      currentY -= 20;
      lineItems.forEach((item) => {
        currentX = margin;
        const rowData = [
          item.description,
          item.quantity.toString(),
          `R ${item.unitPrice.toFixed(2)}`,
          `R ${item.amount.toFixed(2)}`,
        ];

        rowData.forEach((data, index) => {
          // Wrap text for description if too long
          if (index === 0 && data.length > 40) {
            const words = data.split(' ');
            let line = '';
            let yOffset = currentY;

            words.forEach((word) => {
              if ((line + word).length > 40) {
                page.drawText(line.trim(), {
                  x: currentX + 5,
                  y: yOffset,
                  size: 9,
                  font,
                  color: rgb(0.3, 0.3, 0.3)
                });
                line = word + ' ';
                yOffset -= 12;
              } else {
                line += word + ' ';
              }
            });

            if (line.trim()) {
              page.drawText(line.trim(), {
                x: currentX + 5,
                y: yOffset,
                size: 9,
                font,
                color: rgb(0.3, 0.3, 0.3)
              });
            }
          } else {
            page.drawText(data, {
              x: currentX + 5,
              y: currentY,
              size: 10,
              font,
              color: rgb(0.3, 0.3, 0.3)
            });
          }
          currentX += columnWidths[index];
        });
        currentY -= 25;
      });

      // Summary section
      currentY -= 20;
      page.drawLine({
        start: { x: margin, y: currentY },
        end: { x: pageWidth - margin, y: currentY },
        thickness: 1,
        color: rgb(0.8, 0.8, 0.8)
      });

      // Calculate totals
      const subtotal = bill.baseFee + bill.transactionFees + bill.additionalServices - bill.volumeDiscount;
      const vatAmount = subtotal * 0.15; // 15% VAT
      const total = subtotal + vatAmount;

      // Draw summary on the right side
      const summaryX = pageWidth - margin - 200;
      const summaryItems = [
        { label: 'Subtotal:', value: `R ${subtotal.toFixed(2)}` },
        { label: 'VAT (15%):', value: `R ${vatAmount.toFixed(2)}` },
        { label: 'Total:', value: `R ${total.toFixed(2)}`, bold: true },
      ];

      currentY -= 20;
      summaryItems.forEach((item) => {
        page.drawText(item.label, {
          x: summaryX,
          y: currentY,
          size: item.bold ? 12 : 10,
          font: item.bold ? boldFont : font,
          color: rgb(0.3, 0.3, 0.3)
        });

        page.drawText(item.value, {
          x: summaryX + 120,
          y: currentY,
          size: item.bold ? 12 : 10,
          font: item.bold ? boldFont : font,
          color: rgb(0.3, 0.3, 0.3)
        });

        currentY -= 20;
      });

      // Payment instructions
      currentY -= 40;
      page.drawText('Payment Instructions:', {
        x: margin,
        y: currentY,
        size: 12,
        font: boldFont,
        color: rgb(0.2, 0.2, 0.2)
      });

      currentY -= 20;
      const paymentInstructions = [
        'Please make payment within 30 days of invoice date.',
        'Bank: First National Bank',
        'Account Name: ViralFX (Pty) Ltd',
        'Account Number: 1234567890',
        'Branch Code: 250655',
        'Reference: ' + invoiceNumber,
      ];

      paymentInstructions.forEach((instruction) => {
        page.drawText(instruction, {
          x: margin,
          y: currentY,
          size: 9,
          font,
          color: rgb(0.4, 0.4, 0.4)
        });
        currentY -= 15;
      });

      // Footer
      const footerY = margin + 30;
      page.drawLine({
        start: { x: margin, y: footerY },
        end: { x: pageWidth - margin, y: footerY },
        thickness: 1,
        color: rgb(0.8, 0.8, 0.8)
      });

      page.drawText('Thank you for your business!', {
        x: margin,
        y: footerY - 20,
        size: 10,
        font,
        color: rgb(0.4, 0.4, 0.4)
      });

      page.drawText('This is a computer-generated invoice and requires no signature.', {
        x: margin,
        y: footerY - 35,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5)
      });

      // Serialize the PDFDocument to bytes
      const pdfBytes = await pdfDoc.save();

      this.logger.log(`Generated invoice PDF for bill ${bill.id}`);
      return Buffer.from(pdfBytes);

    } catch (error) {
      this.logger.error(`Failed to generate invoice PDF for bill ${bill.id}`, error);
      throw new Error(`PDF generation failed: ${error.message}`);
    }
  }
}
