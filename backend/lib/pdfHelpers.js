// backend/lib/pdfHelpers.js

import { generateBookingConfirmationPdf } from '../services/bookingConfirmationPdf.js';

/**
 * Stream PDF to response
 */
export async function streamBookingConfirmationPdf(summary, res) {
  try {
    const pdfBuffer = await generateBookingConfirmationPdf(summary);
    res.write(pdfBuffer);
    res.end();
  } catch (error) {
    console.error('Error streaming PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.end();
    }
    throw error;
  }
}
