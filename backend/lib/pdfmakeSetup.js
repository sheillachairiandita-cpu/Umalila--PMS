import PdfPrinter from 'pdfmake/src/printer.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Absolute path pointing directly to: ../backend/lib/fonts
const fontsDir = path.join(__dirname, 'fonts');

const fontDescriptors = {
  Roboto: {
    normal: path.join(fontsDir, 'Roboto-Regular.ttf'),
    bold: path.join(fontsDir, 'Roboto-Bold.ttf'),
    italics: path.join(fontsDir, 'Roboto-Italic.ttf'),
    bolditalics: path.join(fontsDir, 'Roboto-BoldItalic.ttf')
  },
  Courier: {
    normal: path.join(fontsDir, 'CourierPrime-Regular.ttf'),
    bold: path.join(fontsDir, 'CourierPrime-Bold.ttf')
  }
};

// Instantiate the printer instance cleanly
const printer = new PdfPrinter(fontDescriptors);

export default printer;