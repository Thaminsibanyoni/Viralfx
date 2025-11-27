import React from 'react';

interface InvoicePdfViewerProps {
  invoiceUrl?: string;
  invoiceNumber?: string;
}

const InvoicePdfViewer: React.FC<InvoicePdfViewerProps> = ({
  invoiceUrl,
  invoiceNumber,
}) => {
  return (
    <div className="pdf-viewer">
      {invoiceUrl ? (
        <iframe
          src={invoiceUrl}
          title={`Invoice ${invoiceNumber}`}
          width="100%"
          height="600px"
          className="border"
        />
      ) : (
        <div className="text-center py-8 text-gray-500">
          No PDF available
        </div>
      )}
    </div>
  );
};

export default InvoicePdfViewer;