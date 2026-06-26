/**
 * Mechanical tenant-scoping patches for server.js.
 * Run: node backend/scripts/apply-tenant-patch.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, '..', 'server.js');
let src = fs.readFileSync(serverPath, 'utf8');

if (!src.includes('createPropertyMiddleware')) {
  src = src.replace(
    "} from './lib/auth.js';",
    `} from './lib/auth.js';
import { createPropertyMiddleware, finishScope, withPropertyId, scoped } from './lib/tenant/index.js';
import { createBookingAccessMiddleware } from './lib/bookingAccess.js';
import { auditLog } from './lib/auditLog.js';
import { parsePagination, fetchCursorPage, paginatedJson } from './lib/pagination.js';
import { generateBookingToken } from './lib/bookingToken.js';`,
  );
}

if (!src.includes('const S =')) {
  src = src.replace(
    'const supabase = createClient(supabaseUrl, supabaseKey);',
    `const supabase = createClient(supabaseUrl, supabaseKey);

const propertyMiddleware = createPropertyMiddleware(supabase);
const bookingAccessMiddleware = createBookingAccessMiddleware(supabase);
const S = (req, table) => scoped(supabase, req.propertyId, table);
const INS = (req, table, data, opts) => supabase.from(table).insert(withPropertyId(data, req.propertyId, table), opts);
const scopeQ = (propertyId, table) => scoped(supabase, propertyId, table);`,
  );
}

if (!src.includes('app.use(propertyMiddleware)')) {
  src = src.replace(
    'app.use(rbacMiddleware);',
    `app.use(rbacMiddleware);
app.use(propertyMiddleware);`,
  );
}

// Route-level scoped table access (req in scope)
const routeTables = [
  'bookings', 'villas', 'guests', 'menu_items', 'addons', 'discounts',
  'pricing_holidays', 'villa_date_blocks', 'finances', 'users', 'orders',
  'villa_cost_profiles', 'reservation_profitability',
];

for (const table of routeTables) {
  const re = new RegExp(`await supabase\\s*\\n\\s*\\.from\\('${table}'\\)`, 'g');
  src = src.replace(re, `await S(req, '${table}')`);
  const re2 = new RegExp(`let query = supabase\\.from\\('${table}'\\)`, 'g');
  src = src.replace(re2, `let query = S(req, '${table}')`);
  const re3 = new RegExp(`supabase\\.from\\('${table}'\\)\\.select`, 'g');
  // Only replace in Promise.all dashboard block - careful
}

// Scoped standalone calls in routes (single line)
for (const table of routeTables) {
  src = src.replace(
    new RegExp(`const \\{ data, error \\} = await supabase\\.from\\('${table}'\\)`, 'g'),
    `const { data, error } = await S(req, '${table}')`,
  );
  src = src.replace(
    new RegExp(`const \\{ error \\} = await supabase\\.from\\('${table}'\\)`, 'g'),
    `const { error } = await S(req, '${table}')`,
  );
}

// booking access middleware on public patch routes
src = src.replace(
  "app.patch('/api/bookings/:id/cancel', async (req, res) => {",
  "app.patch('/api/bookings/:id/cancel', bookingAccessMiddleware, async (req, res) => {",
);
src = src.replace(
  "app.patch('/api/bookings/:id', async (req, res) => {",
  "app.patch('/api/bookings/:id', bookingAccessMiddleware, async (req, res) => {",
);

fs.writeFileSync(serverPath, src);
console.log('Applied mechanical tenant patches to server.js');
