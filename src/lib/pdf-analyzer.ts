import { PDFDocument } from 'pdf-lib-with-encrypt';

export interface PDFAnalysis {
  isEncrypted: boolean;
  pageCount: number;
  hasFormFields: boolean;
  hasMixedPageSizes: boolean;
  fileSize: number;
}

export async function analyzePDF(bytes: Uint8Array): Promise<PDFAnalysis> {
  const fileSize = bytes.length;
  let isEncrypted = false;
  let pageCount = 0;
  let hasFormFields = false;
  let hasMixedPageSizes = false;

  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    pageCount = doc.getPageCount();

    const form = doc.getForm();
    hasFormFields = form.getFields().length > 0;

    if (pageCount > 1) {
      const firstPage = doc.getPage(0);
      const { width: w0, height: h0 } = firstPage.getSize();
      for (let i = 1; i < pageCount; i++) {
        const page = doc.getPage(i);
        const { width, height } = page.getSize();
        if (Math.abs(width - w0) > 1 || Math.abs(height - h0) > 1) {
          hasMixedPageSizes = true;
          break;
        }
      }
    }
  } catch {
    isEncrypted = true;
    // Try to get page count from PDF.js which handles encrypted PDFs better
    try {
      const { getPageCount } = await import('./thumbnail-renderer');
      pageCount = await getPageCount(bytes);
    } catch {
      // Can't get page count
    }
  }

  return { isEncrypted, pageCount, hasFormFields, hasMixedPageSizes, fileSize };
}
