import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import pdfmake from 'pdfmake';

const require = createRequire(import.meta.url);
const pdfkitEntry = require.resolve('pdfkit');
const pdfkitDataDir = join(dirname(pdfkitEntry), 'data');

const AFM_FILES = [
  'Helvetica.afm',
  'Helvetica-Bold.afm',
  'Helvetica-Oblique.afm',
  'Helvetica-BoldOblique.afm',
];

AFM_FILES.forEach((file) => {
  const vfsPath = `data/${file}`;
  pdfmake.virtualfs.writeFileSync(vfsPath, readFileSync(join(pdfkitDataDir, file), 'utf8'), 'utf8');
});

pdfmake.setFonts({
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
});

const BUILTIN_FONTS = new Set([
  'Helvetica',
  'Helvetica-Bold',
  'Helvetica-Oblique',
  'Helvetica-BoldOblique',
]);

pdfmake.setLocalAccessPolicy((path) => BUILTIN_FONTS.has(path));
pdfmake.setUrlAccessPolicy(() => false);

export default pdfmake;
