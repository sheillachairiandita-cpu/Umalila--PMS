// backend/lib/pdfkitSetup.js
import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fontsDir = path.resolve(__dirname, 'fonts');

// Verify fonts exist
const fontFiles = {
  'Roboto-Regular.ttf': path.join(fontsDir, 'Roboto-Regular.ttf'),
  'Roboto-Bold.ttf': path.join(fontsDir, 'Roboto-Bold.ttf'),
  'Roboto-Italic.ttf': path.join(fontsDir, 'Roboto-Italic.ttf'),
  'Roboto-BoldItalic.ttf': path.join(fontsDir, 'Roboto-BoldItalic.ttf'),
  'CourierPrime-Regular.ttf': path.join(fontsDir, 'CourierPrime-Regular.ttf'),
  'CourierPrime-Bold.ttf': path.join(fontsDir, 'CourierPrime-Bold.ttf'),
};

// Check fonts on startup
Object.entries(fontFiles).forEach(([name, filePath]) => {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ Font file not found: ${filePath}`);
  }
});

export { PDFDocument, fontFiles, fontsDir };