import pdfmake from 'pdfmake';
import { customVfs } from './vfs_fonts.js';

// 1. Force-load the base64 compiled asset maps into pdfmake's internal virtual storage
Object.entries(customVfs).forEach(([fileName, base64Content]) => {
  if (base64Content) {
    // Registering with explicit base64 formatting tells pdfmake exactly how to unpack the .ttf binary
    pdfmake.virtualfs.writeFileSync(fileName, base64Content, 'base64');
  }
});

// 2. Set structural font families map matching your style overrides precisely
pdfmake.setFonts({
  Roboto: {
    normal: pdfmake.virtualfs.existsSync('Roboto-Regular.ttf') ? 'Roboto-Regular.ttf' : 'Helvetica',
    bold: pdfmake.virtualfs.existsSync('Roboto-Bold.ttf') ? 'Roboto-Bold.ttf' : 'Helvetica-Bold',
    italics: pdfmake.virtualfs.existsSync('Roboto-Italic.ttf') ? 'Roboto-Italic.ttf' : 'Helvetica-Oblique',
    bolditalics: pdfmake.virtualfs.existsSync('Roboto-BoldItalic.ttf') ? 'Roboto-BoldItalic.ttf' : 'Helvetica-BoldOblique'
  },
  Courier: {
    normal: pdfmake.virtualfs.existsSync('CourierPrime-Regular.ttf') ? 'Courier-Regular.ttf' : 'Courier',
    bold: pdfmake.virtualfs.existsSync('CourierPrime-Bold.ttf') ? 'Courier-Bold.ttf' : 'Courier-Bold'
  }
});

// 3. Open access rules to authorize rendering local asset files safely
pdfmake.setLocalAccessPolicy(() => true);
pdfmake.setUrlAccessPolicy(() => false);

export default pdfmake;