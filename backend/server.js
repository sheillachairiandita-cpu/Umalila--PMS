import './loadEnv.js';
import express from 'express';
import { nextPropertyDisplayId } from './lib/propertyDisplayId.js';
import { nextUserDisplayId, resolveTenantUserPrefix } from './lib/userDisplayId.js';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { config } from './config/index.js';
import {
  mapDiscountRow,
  discountPayloadFromBody,
  validateDiscountPayload,
} from './lib/discountUtils.js';
import { registerFinancialRoutes } from './routes/financialRoutes.js';
import { registerBookingsRoutes } from './routes/bookingsRoutes.js';
import { createBuildFinancialSummary } from './lib/bookingFinancialSummary.js';
import { createSummaryCache } from './lib/summaryCache.js';
import { createUpsertReservationProfitability } from './lib/reservationProfitability.js';
import { fetchPricingHolidays } from './lib/bookingOperations.js';
import { todayISO, currentMonthBounds } from './lib/stayUtils.js';
import {
  FINANCE_INCOME_WITH_BOOKING_SELECT,
  sumCountableFinanceIncome,
} from './lib/financeEligibility.js';
import {
  findBlockingReservationsForBlock,
  formatBlockConflictError,
} from './lib/blockUtils.js';
import {
  hashPassword,
  createAuthHandlers,
  createAuthMiddleware,
  rbacMiddleware,
} from './lib/auth.js';
import { createTenantMiddleware, finishScope, withTenantId, scoped } from './lib/tenant/index.js';
import { assertEmailMatchesTenant } from './lib/tenant/resolveTenantFromEmail.js';
import { createBookingAccessMiddleware } from './lib/bookingAccess.js';

const app = express();

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

const tenantMiddleware = createTenantMiddleware(supabase);
const bookingAccessMiddleware = createBookingAccessMiddleware(supabase);
const S = (req, table) => scoped(supabase, req.tenantId, table);
const INS = (req, table, data, opts) => supabase.from(table).insert(withTenantId(data, req.tenantId, table), opts);
const scopeQ = (tenantId, table) => scoped(supabase, tenantId, table);
const { buildFinancialSummary } = createBuildFinancialSummary(scopeQ);
const { getCachedSummary, invalidateSummary } = createSummaryCache(buildFinancialSummary);
const upsertReservationProfitability = createUpsertReservationProfitability(scopeQ, buildFinancialSummary);

app.use(cors({ origin: config.cors.origin, credentials: true }));
app.use(express.json({ limit: '20mb' }));

const authMiddleware = createAuthMiddleware(supabase);
const { login, logout, me, changePassword } = createAuthHandlers(supabase);

app.use(authMiddleware);
app.use(rbacMiddleware);
app.use(tenantMiddleware);

app.post('/api/auth/login', login);
app.post('/api/auth/logout', logout);
app.get('/api/auth/me', me);
app.patch('/api/auth/change-password', changePassword);

/** Allowed values for orders.status (matches Supabase orders_status_check) */
const ORDER_STATUS_OPEN = 'open';

/** Blocks use inclusive [start_date, end_date]; bookings use half-open [check_in, check_out). */
async function findBlockConflicts(propertyIds, checkIn, checkOut, tenantId) {
  let query = scopeQ(tenantId, 'property_date_blocks')
    .select('id, property_id, start_date, end_date, reason')
    .lt('start_date', checkOut)
    .gte('end_date', checkIn);

  if (Array.isArray(propertyIds) && propertyIds.length > 0) {
    query = query.in('property_id', propertyIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ─────────────────────────────────────────────────────────────
// 🍽️  MENU ITEMS
// ─────────────────────────────────────────────────────────────

app.get('/api/menu-items', async (req, res) => {
  try {
    let query = S(req, 'menu_items').select('id, name, category, price, is_available, created_at').order('category').order('name');
    if (req.query.all !== 'true') {
      query = query.eq('is_available', true);
    }
    const { data, error } = await query;

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/menu-items', async (req, res) => {
  const { name, category = 'food', price, is_available = true } = req.body;
  if (!name?.trim() || price === undefined) {
    return res.status(400).json({ error: 'Name and price are required.' });
  }
  try {
    const { data, error } = await INS(req, 'menu_items', [{ name: name.trim(), category, price: Number(price), is_available }]).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/menu-items/:id', async (req, res) => {
  const { id } = req.params;
  const payload = {};
  if (req.body.name !== undefined) payload.name = req.body.name.trim();
  if (req.body.category !== undefined) payload.category = req.body.category;
  if (req.body.price !== undefined) payload.price = Number(req.body.price);
  if (req.body.is_available !== undefined) payload.is_available = !!req.body.is_available;
  try {
    const { data, error } = await S(req, 'menu_items').update(payload).eq('id', id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/menu-items/:id', async (req, res) => {
  try {
    const { error } = await S(req, 'menu_items').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Menu item deleted.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 🧾  ORDERS
// ─────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────
// 🏡  PROPERTIES
// ─────────────────────────────────────────────────────────────

app.get('/api/properties/gantt', async (req, res) => {
  try {
    const { data: properties, error: propertyError } = await S(req, 'properties')
      .select('id, name, capacity, base_rate_per_night, display_id, category')
      .order('name');

    if (propertyError) throw propertyError;

    const { data: bookings, error: bookingError } = await S(req, 'bookings')
      .select(`id, display_id, status, check_in_date, check_out_date, guests (full_name), booking_properties (property_id)`)
      .not('status', 'eq', 'cancelled');

    if (bookingError) throw bookingError;

    const { data: blocks } = await scopeQ(req.tenantId, 'property_date_blocks')
      .select('id, property_id, start_date, end_date, reason, created_at, created_by, users:created_by (name)');

    const ganttData = properties.map((property) => {
      const propertyBookings = bookings
        .filter(b => b.booking_properties?.some(bv => bv.property_id === property.id))
        .map(b => ({
          id: b.id,
          displayId: b.display_id || null,
          guest: b.guests?.full_name || 'Unknown Guest',
          checkIn: b.check_in_date,
          checkOut: b.check_out_date,
          status: b.status,
        }));

      const propertyBlocks = (blocks || [])
        .filter(blk => blk.property_id === property.id)
        .map(blk => ({
          id: blk.id,
          startDate: blk.start_date,
          endDate: blk.end_date,
          reason: blk.reason,
          createdAt: blk.created_at,
          createdBy: blk.users?.name || null,
        }));

      return {
        id: property.id,
        name: property.name,
        category: property.category || null,
        bookings: propertyBookings,
        blocks: propertyBlocks,
      };
    });

    res.json(ganttData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/properties/blocks', async (req, res) => {
  const { property_id, start_date, end_date, reason } = req.body;
  if (!property_id || !start_date || !end_date || !reason?.trim()) {
    return res.status(400).json({ error: 'Property, start date, end date, and reason are required.' });
  }
  if (end_date < start_date) {
    return res.status(400).json({ error: 'End date must be on or after start date.' });
  }
  try {
    const conflicts = await findBlockingReservationsForBlock(
      supabase,
      property_id,
      start_date,
      end_date,
    );
    if (conflicts.length > 0) {
      return res.status(409).json({
        error: formatBlockConflictError(conflicts),
        conflicts,
      });
    }

    const insertPayload = {
      property_id,
      start_date,
      end_date,
      reason: reason.trim(),
    };
    if (req.user?.id) {
      insertPayload.created_by = req.user.id;
    }

    const { data, error } = await INS(req, 'property_date_blocks', [insertPayload])
      .select('id, property_id, start_date, end_date, reason, created_at, created_by, users:created_by (name)')
      .single();
    if (error) throw error;
    res.status(201).json({
      id: data.id,
      property_id: data.property_id,
      startDate: data.start_date,
      endDate: data.end_date,
      reason: data.reason,
      createdAt: data.created_at,
      createdBy: data.users?.name || null,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/properties/blocks/:id', async (req, res) => {
  try {
    const { error } = await S(req, 'property_date_blocks').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/properties/availability', async (req, res) => {
  const { check_in, check_out } = req.query;
  if (!check_in || !check_out) {
    return res.status(400).json({ error: 'Missing check_in or check_out parameters.' });
  }

  try {
    const { data: conflicts, error } = await supabase
      .from('booking_properties')
      .select(`property_id, bookings!inner (status, check_in_date, check_out_date, tenant_id)`)
      .eq('bookings.tenant_id', req.tenantId)
      .not('bookings.status', 'eq', 'cancelled')
      .lt('bookings.check_in_date', check_out)
      .gt('bookings.check_out_date', check_in);

    if (error) throw error;
    const occupiedPropertyIds = conflicts ? [...new Set(conflicts.map((c) => c.property_id))] : [];

    const blockRows = await findBlockConflicts(null, check_in, check_out, req.tenantId);
    const blockedPropertyIds = [...new Set(blockRows.map((b) => b.property_id))];
    const blockedDetails = blockRows.map((b) => ({
      property_id: b.property_id,
      start_date: b.start_date,
      end_date: b.end_date,
      reason: b.reason,
    }));

    res.json({ occupiedPropertyIds, blockedPropertyIds, blockedDetails });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/properties', async (req, res) => {
  try {
    const { data, error } = await S(req, 'properties')
      .select('id, name, capacity, base_rate_per_night, weekend_rate_per_night, holiday_rate_per_night, description, base_breakfast, display_id, category, created_at')
      .order('name');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function generateNextPropertyDisplayId(tenantId) {
  const { data, error } = await scopeQ(tenantId, 'properties')
    .select('display_id');
  if (error) throw error;

  return nextPropertyDisplayId((data || []).map((row) => row.display_id));
}

app.post('/api/properties', async (req, res) => {
  const {
    name,
    capacity = 1,
    base_rate_per_night,
    weekend_rate_per_night,
    holiday_rate_per_night,
    description = '',
    base_breakfast = 0,
    category = 'Villa',
  } = req.body;
  if (!name?.trim() || base_rate_per_night === undefined) {
    return res.status(400).json({ error: 'Name and weekday rate are required.' });
  }
  try {
    const display_id = await generateNextPropertyDisplayId(req.tenantId);
    const row = {
      name: name.trim(),
      capacity: Number(capacity) || 1,
      base_rate_per_night: Number(base_rate_per_night),
      description,
      base_breakfast: Number(base_breakfast) || 0,
      category: String(category || 'Villa').trim() || 'Villa',
      display_id,
    };
    if (weekend_rate_per_night !== undefined && weekend_rate_per_night !== '') {
      row.weekend_rate_per_night = Number(weekend_rate_per_night);
    }
    if (holiday_rate_per_night !== undefined && holiday_rate_per_night !== '') {
      row.holiday_rate_per_night = Number(holiday_rate_per_night);
    }
    const { data, error } = await INS(req, 'properties', [row]).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/properties/:id', async (req, res) => {
  const { id } = req.params;
  const payload = {};
  if (req.body.name !== undefined) payload.name = req.body.name.trim();
  if (req.body.capacity !== undefined) payload.capacity = Number(req.body.capacity);
  if (req.body.base_rate_per_night !== undefined) payload.base_rate_per_night = Number(req.body.base_rate_per_night);
  if (req.body.weekend_rate_per_night !== undefined) {
    payload.weekend_rate_per_night = req.body.weekend_rate_per_night === '' || req.body.weekend_rate_per_night == null
      ? null
      : Number(req.body.weekend_rate_per_night);
  }
  if (req.body.holiday_rate_per_night !== undefined) {
    payload.holiday_rate_per_night = req.body.holiday_rate_per_night === '' || req.body.holiday_rate_per_night == null
      ? null
      : Number(req.body.holiday_rate_per_night);
  }
  if (req.body.description !== undefined) payload.description = req.body.description;
  if (req.body.base_breakfast !== undefined) payload.base_breakfast = Number(req.body.base_breakfast) || 0;
  if (req.body.category !== undefined) payload.category = String(req.body.category || 'Villa').trim() || 'Villa';
  try {
    const { data, error } = await S(req, 'properties').update(payload).eq('id', id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/pricing/holidays', async (req, res) => {
  try {
    const data = await fetchPricingHolidays(scopeQ, req.tenantId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/pricing/holidays', async (req, res) => {
  const { name, start_date, end_date } = req.body;
  if (!name?.trim() || !start_date || !end_date) {
    return res.status(400).json({ error: 'Name, start date, and end date are required.' });
  }
  if (end_date < start_date) {
    return res.status(400).json({ error: 'End date must be on or after start date.' });
  }
  try {
    const { data, error } = await INS(req, 'pricing_holidays', [{
        name: name.trim(),
        start_date,
        end_date,
      }]).select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/pricing/holidays/:id', async (req, res) => {
  try {
    const { error } = await S(req, 'pricing_holidays').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Holiday period deleted.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/properties/:id', async (req, res) => {
  try {
    const { error } = await S(req, 'properties').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Property deleted.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 👤  GUESTS & ADD-ONS
// ─────────────────────────────────────────────────────────────

app.post('/api/guests', async (req, res) => {
  const { full_name, email, phone_number, id_card_number } = req.body;
  try {
    const { data, error } = await INS(req, 'guests', [{
        full_name,
        email,
        phone_number,
        ...(id_card_number !== undefined ? { id_card_number } : {}),
      }]).select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/addons', async (req, res) => {
  try {
    const { data, error } = await S(req, 'addons').select('id, name, price, is_per_night, base_breakfast, created_at').order('name');
    if (error) throw error;
    res.json((data || []).map(mapAddonRow));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/addons', async (req, res) => {
  const {
    name,
    price,
    price_per_night,
    base_breakfast = 0,
    is_per_night = true,
  } = req.body;
  const resolvedPrice = price ?? price_per_night;
  if (!name?.trim() || resolvedPrice === undefined) {
    return res.status(400).json({ error: 'Name and price are required.' });
  }
  try {
    const numericPrice = Number(resolvedPrice);
    const { data, error } = await INS(req, 'addons', [{
        name: name.trim(),
        price: numericPrice,
        base_breakfast: Number(base_breakfast) || 0,
        is_per_night: is_per_night !== false,
      }]).select()
      .single();
    if (error) throw error;
    res.status(201).json(mapAddonRow(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/addons/:id', async (req, res) => {
  const { id } = req.params;
  const payload = {};
  if (req.body.name !== undefined) payload.name = req.body.name.trim();
  if (req.body.price !== undefined) {
    payload.price = Number(req.body.price);
  } else if (req.body.price_per_night !== undefined) {
    payload.price = Number(req.body.price_per_night);
  }
  if (req.body.base_breakfast !== undefined) payload.base_breakfast = Number(req.body.base_breakfast) || 0;
  if (req.body.is_per_night !== undefined) payload.is_per_night = !!req.body.is_per_night;
  try {
    const { data, error } = await S(req, 'addons').update(payload).eq('id', id).select().single();
    if (error) throw error;
    res.json(mapAddonRow(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/addons/:id', async (req, res) => {
  try {
    const { error } = await S(req, 'addons').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Add-on deleted.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 🏷️  DISCOUNTS
// ─────────────────────────────────────────────────────────────

app.get('/api/discounts', async (req, res) => {
  try {
    const { data, error } = await S(req, 'discounts').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json((data || []).map(mapDiscountRow));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/discounts', async (req, res) => {
  const payload = discountPayloadFromBody(req.body);
  const validation = validateDiscountPayload(payload);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.errors[0] });
  }

  try {
    const { data: existing, error: existingError } = await S(req, 'discounts')
      .select('id')
      .eq('code', payload.code)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      return res.status(400).json({ error: 'Promo code must be unique.' });
    }

    const { data, error } = await INS(req, 'discounts', [payload]).select().single();
    if (error) throw error;
    res.status(201).json(mapDiscountRow(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/discounts/:id', async (req, res) => {
  const payload = discountPayloadFromBody(req.body, { partial: true, forUpdate: true });
  if (Object.keys(payload).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update.' });
  }

  const validation = validateDiscountPayload(payload, { partial: true });
  if (!validation.valid) {
    return res.status(400).json({ error: validation.errors[0] });
  }

  try {
    if (payload.code) {
      const { data: existing, error: existingError } = await S(req, 'discounts')
        .select('id')
        .eq('code', payload.code)
        .neq('id', req.params.id)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        return res.status(400).json({ error: 'Promo code must be unique.' });
      }
    }

    const { data, error } = await S(req, 'discounts')
      .update(payload)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(mapDiscountRow(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/discounts/:id', async (req, res) => {
  try {
    const { data, error } = await S(req, 'discounts')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ message: 'Discount archived.', discount: mapDiscountRow(data) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 💳  BOOKING HELPERS (addons catalog)
// ─────────────────────────────────────────────────────────────

function mapAddonRow(row) {
  if (!row) return row;
  const price = Number(row.price) || 0;
  return { ...row, price, price_per_night: price };
}

registerBookingsRoutes(app, {
  supabase,
  scopeQ,
  S,
  INS,
  bookingAccessMiddleware,
  findBlockConflicts,
  buildFinancialSummary,
  invalidateSummary,
  upsertReservationProfitability,
  ORDER_STATUS_OPEN,
});

// ─────────────────────────────────────────────────────────────
// 📊  FINANCIAL ENDPOINTS
// ─────────────────────────────────────────────────────────────

registerFinancialRoutes(app, {
  supabase,
  S,
  INS,
  getCachedSummary,
  upsertReservationProfitability,
});



// ─────────────────────────────────────────────────────────────
// 📊  DASHBOARD
// ─────────────────────────────────────────────────────────────

app.get('/api/dashboard', async (req, res) => {
  try {
    const today = todayISO();
    const { start: monthStart } = currentMonthBounds();

    const [
      { count: arrivalsToday, error: arrivalsError },
      { count: departuresToday, error: departuresError },
      { count: inHouse, error: inHouseError },
      { data: incomeRows, error: incomeError },
    ] = await Promise.all([
      S(req, 'bookings')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'cancelled')
        .eq('check_in_date', today),
      S(req, 'bookings')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'cancelled')
        .eq('check_out_date', today),
      S(req, 'bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'checked_in'),
      S(req, 'finances')
        .select(FINANCE_INCOME_WITH_BOOKING_SELECT)
        .eq('type', 'income')
        .eq('status', 'approved')
        .gte('transaction_date', monthStart)
        .lte('transaction_date', today),
    ]);

    const error = arrivalsError || departuresError || inHouseError || incomeError;
    if (error) throw error;

    res.json({
      arrivalsToday: arrivalsToday ?? 0,
      departuresToday: departuresToday ?? 0,
      inHouse: inHouse ?? 0,
      monthRevenue: sumCountableFinanceIncome(incomeRows),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 👤 USERS
// ─────────────────────────────────────────────────────────────

const USER_ROLES = ['staff', 'owner', 'admin', 'manager', 'receptionist', 'housekeeping'];
const USER_STATUSES = ['active', 'deactivated'];

function mapUserRow(row) {
  return {
    id: row.id,
    display_id: row.display_id || null,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status || 'active',
    created_at: row.created_at,
  };
}

async function generateNextUserDisplayId(tenantId) {
  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('id, name');

  if (tenantsError) throw tenantsError;

  const tenant = (tenants || []).find((row) => row.id === tenantId);
  if (!tenant) {
    const err = new Error('Tenant not found.');
    err.status = 404;
    throw err;
  }

  const prefix = resolveTenantUserPrefix(
    tenant.name,
    (tenants || []).map((row) => row.name),
  );

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('display_id')
    .eq('tenant_id', tenantId);

  if (usersError) throw usersError;

  return nextUserDisplayId((users || []).map((row) => row.display_id), prefix);
}

app.get('/api/users', async (req, res) => {
  try {
    const { data, error } = await S(req, 'users')
      .select('id, email, name, role, created_at, display_id, status')
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json((data || []).map((row) => mapUserRow(row)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  const { name, email, password, role = 'staff' } = req.body;

  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  if (!USER_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Invalid role.' });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    await assertEmailMatchesTenant(supabase, req.tenantId, normalizedEmail);

    const { data: existing, error: existingError } = await S(req, 'users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }

    const display_id = await generateNextUserDisplayId(req.tenantId);

    const { data, error } = await INS(req, 'users', [{
        name: name.trim(),
        email: normalizedEmail,
        password_hash: hashPassword(password),
        role,
        display_id,
        status: 'active',
      }]).select('id, email, name, role, created_at, display_id, status')
      .single();

    if (error) throw error;
    res.status(201).json(mapUserRow(data));
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
});

app.patch('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const payload = {};

  if (req.body.name !== undefined) payload.name = req.body.name.trim();
  if (req.body.email !== undefined) payload.email = req.body.email.trim().toLowerCase();
  if (req.body.role !== undefined) {
    if (!USER_ROLES.includes(req.body.role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }
    payload.role = req.body.role;
  }
  if (req.body.password) {
    payload.password_hash = hashPassword(req.body.password);
  }

  if (Object.keys(payload).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update.' });
  }

  try {
    if (payload.email) {
      await assertEmailMatchesTenant(supabase, req.tenantId, payload.email);

      const { data: existing, error: existingError } = await S(req, 'users')
        .select('id')
        .eq('email', payload.email)
        .neq('id', id)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing) {
        return res.status(409).json({ error: 'A user with this email already exists.' });
      }
    }

    const { data, error } = await S(req, 'users')
      .update(payload)
      .eq('id', id)
      .select('id, email, name, role, created_at, display_id, status')
      .single();

    if (error) throw error;
    res.json(mapUserRow(data));
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
});

app.patch('/api/users/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!USER_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Status must be active or deactivated.' });
  }

  try {
    const { data, error } = await S(req, 'users')
      .update({ status })
      .eq('id', id)
      .select('id, email, name, role, created_at, display_id, status')
      .single();

    if (error) throw error;
    res.json(mapUserRow(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
app.get('/status', (req, res) => res.json({ status: 'Umalila Engine Running Smoothly' }));

app.listen(config.server.port, config.server.host, () => {
  console.log(`Server running on ${config.server.host}:${config.server.port} (${config.env})`);
});