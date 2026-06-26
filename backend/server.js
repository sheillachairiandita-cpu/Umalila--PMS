import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import {
  calculateDiscountAmount,
  mapDiscountRow,
  discountPayloadFromBody,
  validateDiscountPayload,
  isDiscountEligible,
  buildDiscountBookingContext,
  resolveDiscountApplication,
  normalizeStatus,
} from './lib/discountUtils.js';
import { streamBookingConfirmationPdf } from './lib/pdfHelpers.js';
import { computeVillaStayCharges, buildTieredAccommodationLines } from './lib/villaRateUtils.js';
import {
  calculateReservationCogs,
  calculateGrossProfit,
} from './lib/cogsUtils.js';
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
import { createPropertyMiddleware, finishScope, withPropertyId, scoped } from './lib/tenant/index.js';
import { createBookingAccessMiddleware } from './lib/bookingAccess.js';
import { auditLog } from './lib/auditLog.js';
import { parsePagination, fetchCursorPage, paginatedJson } from './lib/pagination.js';
import { generateBookingToken } from './lib/bookingToken.js';
import {
  assertBookingInProperty,
  findVillaBookingConflicts,
  deleteBookingChildren,
  deleteBookingCascade,
} from './lib/tenant/bookingScope.js';

const app = express();
const PORT = process.env.PORT || 5000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const propertyMiddleware = createPropertyMiddleware(supabase);
const bookingAccessMiddleware = createBookingAccessMiddleware(supabase);
const S = (req, table) => scoped(supabase, req.propertyId, table);
const INS = (req, table, data, opts) => supabase.from(table).insert(withPropertyId(data, req.propertyId, table), opts);
const scopeQ = (propertyId, table) => scoped(supabase, propertyId, table);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '20mb' }));

const authMiddleware = createAuthMiddleware(supabase);
const { login, logout, me, changePassword } = createAuthHandlers(supabase);

app.use(authMiddleware);
app.use(rbacMiddleware);
app.use(propertyMiddleware);

app.post('/api/auth/login', login);
app.post('/api/auth/logout', logout);
app.get('/api/auth/me', me);
app.patch('/api/auth/change-password', changePassword);

/** Allowed values for orders.status (matches Supabase orders_status_check) */
const ORDER_STATUSES = ['open', 'served', 'billed'];
const ORDER_STATUS_OPEN = 'open';

/** Blocks use inclusive [start_date, end_date]; bookings use half-open [check_in, check_out). */
async function findBlockConflicts(villaIds, checkIn, checkOut, propertyId) {
  let query = scopeQ(propertyId, 'villa_date_blocks')
    .select('id, villa_id, start_date, end_date, reason')
    .lt('start_date', checkOut)
    .gte('end_date', checkIn);

  if (Array.isArray(villaIds) && villaIds.length > 0) {
    query = query.in('villa_id', villaIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ─────────────────────────────────────────────────────────────
// 📋 BOOKINGS
// ─────────────────────────────────────────────────────────────

app.get('/api/bookings', async (req, res) => {
  try {
    const { limit, cursor } = parsePagination(req.query);
    const bookingSelect = `
        id, display_id, status, payment_status, check_in_date, check_out_date,
        total_price, amount_paid, total_guests, notes, created_at, discount_id, discount_amount,
        discounts (id, code, name, type, value, scope, status, application_rule),
        guests (full_name, phone_number),
        booking_villas (
          villa_id, rate_per_night, nights,
          villas (id, name, base_rate_per_night, weekend_rate_per_night, holiday_rate_per_night, base_breakfast, display_id)
        ),
        booking_addons (
          addon_id, quantity, unit_price, subtotal,
          addons (id, name, price, is_per_night, base_breakfast)
        )
      `;

    const { data, nextCursor, hasMore } = await fetchCursorPage(
      S(req, 'bookings').select(bookingSelect),
      { limit, cursor },
    );

    const { data: orderTotals, error: orderErr } = await S(req, 'orders')
      .select('booking_id, total_amount')
      .not('status', 'eq', 'billed');

    if (orderErr) throw orderErr;

    const orderTotalMap = {};
    (orderTotals || []).forEach((o) => {
      orderTotalMap[o.booking_id] = (orderTotalMap[o.booking_id] || 0) + Number(o.total_amount);
    });

    const today = new Date().toISOString().split('T')[0];

    const formatted = (data || []).map((b) => {
      const villaBreakfast = b.booking_villas?.reduce((sum, bv) => sum + (bv.villas?.base_breakfast || 0), 0) || 0;
      const addonBreakfast = b.booking_addons?.reduce((sum, ba) => sum + ((ba.addons?.base_breakfast || 0) * (ba.quantity || 1)), 0) || 0;
      const totalBreakfast = villaBreakfast + addonBreakfast;

      const extraBedAddon = b.booking_addons?.find((ba) => ba.addons?.name === 'Extra Bed');
      const extraBedQty = extraBedAddon?.quantity || 0;

      let stayPhase;
      if (b.status === 'checked_in') {
        stayPhase = 'in-house';
      } else if (b.check_in_date === today) {
        stayPhase = 'arrival';
      } else if (b.check_out_date === today) {
        stayPhase = 'departure';
      } else if (b.check_in_date > today) {
        stayPhase = 'upcoming';
      } else {
        stayPhase = 'in-house';
      }

      const orderTotal = orderTotalMap[b.id] || 0;

      return {
        ...b,
        villa_names: b.booking_villas?.map((bv) => bv.villas?.name).filter(Boolean).join(', ') || 'No Units Assigned',
        total_breakfast: totalBreakfast,
        extra_bed_qty: extraBedQty,
        stay_phase: stayPhase,
        order_total: orderTotal,
        grand_total: (b.total_price || 0) + orderTotal,
        payment_status: b.payment_status || 'pending',
        amount_paid: b.amount_paid || 0,
      };
    });

    paginatedJson(res, { data: formatted, nextCursor, hasMore });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bookings', async (req, res) => {
  const {
    villa_ids,
    guest_id,
    check_in_date,
    check_out_date,
    total_guests,
    total_price,
    notes,
    selected_addons,
    apply_discount,
    discount_id,
  } = req.body;

  let createdBookingId = null;

  try {
    const conflictingBookings = await findVillaBookingConflicts(supabase, {
      villaIds: villa_ids,
      checkIn: check_in_date,
      checkOut: check_out_date,
      propertyId: req.propertyId,
    });
    if (conflictingBookings.length > 0) {
      return res.status(409).json({ error: 'One or more villas are already reserved.' });
    }

    const blockConflicts = await findBlockConflicts(villa_ids, check_in_date, check_out_date, req.propertyId);
    if (blockConflicts.length > 0) {
      return res.status(409).json({
        error: 'One or more villas are unavailable for these dates due to a scheduled block.',
      });
    }

    const charges = await computeBookingCharges({
      villa_ids,
      selected_addons: selected_addons || [],
      check_in_date,
      check_out_date,
      propertyId: req.propertyId,
    });

    const discountContext = buildDiscountBookingContext({
      checkInDate: check_in_date,
      checkOutDate: check_out_date,
      nights: stayNights(check_in_date, check_out_date),
      bookingAmount: charges.accommodationTotal,
      villaIds: villa_ids,
      guestId: guest_id,
    });

    const { discount, discount_id: resolvedDiscountId } = await resolveDiscountForBooking({
      apply_discount: !!apply_discount,
      discount_id,
      context: discountContext,
      charges,
      propertyId: req.propertyId,
    });

    let discountAmount = 0;
    if (discount) {
      const result = calculateDiscountAmount(discount, {
        ...discountContext,
        villaLines: charges.villaLines,
        addonLines: charges.addonLines,
        menuLines: [],
      });
      discountAmount = result.amount;
    }

    const computedTotal = Math.max(charges.accommodationTotal - discountAmount, 0);
    const finalTotal = total_price !== undefined ? Number(total_price) : computedTotal;

    const { token: manageToken, hash: manageTokenHash } = generateBookingToken();

    const { data: bookingData, error: bookingError } = await INS(req, 'bookings', [{
      guest_id,
      check_in_date,
      check_out_date,
      total_guests,
      total_price: finalTotal,
      notes,
      discount_id: discount ? resolvedDiscountId : null,
      discount_amount: discountAmount,
      manage_token_hash: manageTokenHash,
    }]).select().single();

    if (bookingError) throw bookingError;
    createdBookingId = bookingData.id;

    const nights = charges.nights;

    const holidays = await fetchPricingHolidays(req.propertyId);
    const { data: villaCatalog, error: villaFetchError } = await scopeQ(req.propertyId, 'villas')
      .select('id, base_rate_per_night, weekend_rate_per_night, holiday_rate_per_night')
      .in('id', villa_ids);
    if (villaFetchError) throw villaFetchError;

    const bridgeRows = buildBookingVillaRows(
      bookingData.id,
      villa_ids,
      villaCatalog,
      check_in_date,
      check_out_date,
      holidays
    );
    const { error: bridgeError } = await supabase.from('booking_villas').insert(bridgeRows);
    if (bridgeError) throw bridgeError;

    if (selected_addons && selected_addons.length > 0) {
      const addonIds = selected_addons.map((a) => a.addon_id);
      const { data: addonCatalog, error: addonFetchError } = await scopeQ(req.propertyId, 'addons')
        .select('id, price, is_per_night')
        .in('id', addonIds);
      if (addonFetchError) throw addonFetchError;

      const addonRows = buildBookingAddonRows(bookingData.id, selected_addons, addonCatalog, nights);
      const { error: addonError } = await supabase.from('booking_addons').insert(addonRows);
      if (addonError) {
        await deleteBookingChildren(supabase, bookingData.id);
        await scopeQ(req.propertyId, 'bookings').delete().eq('id', bookingData.id);
        throw addonError;
      }
    }

    try {
      await upsertReservationProfitability(bookingData.id, req.propertyId);
    } catch (profitErr) {
      console.error('Profitability snapshot failed:', profitErr.message);
    }

    res.status(201).json({ ...bookingData, manage_token: manageToken });
  } catch (error) {
    if (createdBookingId) {
      await deleteBookingCascade(supabase, scopeQ, req.propertyId, createdBookingId);
    }
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/bookings/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const updateData = { status };

    if (status === 'checked_in') {
      // Checked-in bookings always operate in the in-house phase (computed on read).
    }

    const { data, error } = await S(req, 'bookings')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) throw error;

    if (['confirmed', 'checked_in', 'checked_out', 'completed'].includes(status)) {
      try {
        await upsertReservationProfitability(id, req.propertyId);
      } catch (profitErr) {
        console.error('Profitability snapshot failed:', profitErr.message);
      }
    }

    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/bookings/:id', bookingAccessMiddleware, async (req, res) => {
  const { id } = req.params;
  const {
    check_in_date,
    check_out_date,
    total_guests,
    notes,
    total_price,
    villa_ids,
    selected_addons,
    apply_discount,
    discount_id,
  } = req.body;

  try {
    const { data: existing, error: existingError } = await S(req, 'bookings')
      .select('check_in_date, check_out_date, status')
      .eq('id', id)
      .single();

    if (existingError) throw existingError;
    if (existing.status === 'cancelled') {
      return res.status(400).json({ error: 'Cancelled bookings cannot be edited.' });
    }

    const nextCheckIn = check_in_date ?? existing.check_in_date;
    const nextCheckOut = check_out_date ?? existing.check_out_date;

    if (new Date(nextCheckOut) <= new Date(nextCheckIn)) {
      return res.status(400).json({ error: 'Check-out must be after check-in.' });
    }

    if (Array.isArray(villa_ids) && villa_ids.length > 0) {
      const conflictingBookings = await findVillaBookingConflicts(supabase, {
        villaIds: villa_ids,
        checkIn: nextCheckIn,
        checkOut: nextCheckOut,
        propertyId: req.propertyId,
        excludeBookingId: id,
      });
      if (conflictingBookings.length > 0) {
        return res.status(409).json({ error: 'One or more villas are already reserved for these dates.' });
      }

      const blockConflicts = await findBlockConflicts(villa_ids, nextCheckIn, nextCheckOut, req.propertyId);
      if (blockConflicts.length > 0) {
        return res.status(409).json({
          error: 'One or more villas are unavailable for these dates due to a scheduled block.',
        });
      }
    }

    const updateData = {};
    if (check_in_date !== undefined) updateData.check_in_date = check_in_date;
    if (check_out_date !== undefined) updateData.check_out_date = check_out_date;
    if (total_guests !== undefined) updateData.total_guests = total_guests;
    if (notes !== undefined) updateData.notes = notes;

    const shouldRecalculate =
      Array.isArray(villa_ids) ||
      Array.isArray(selected_addons) ||
      apply_discount !== undefined ||
      discount_id !== undefined ||
      check_in_date !== undefined ||
      check_out_date !== undefined;

    if (shouldRecalculate) {
      const { data: bookingMeta, error: bookingMetaError } = await S(req, 'bookings')
        .select('guest_id')
        .eq('id', id)
        .single();
      if (bookingMetaError) throw bookingMetaError;

      let resolvedVillaIds = villa_ids;
      if (!Array.isArray(resolvedVillaIds)) {
        const { data: currentVillas, error: villaFetchError } = await supabase
          .from('booking_villas')
          .select('villa_id')
          .eq('booking_id', id);
        if (villaFetchError) throw villaFetchError;
        resolvedVillaIds = (currentVillas || []).map((row) => row.villa_id);
      }

      let resolvedAddons = selected_addons;
      if (!Array.isArray(resolvedAddons)) {
        const { data: currentAddons, error: addonFetchError } = await supabase
          .from('booking_addons')
          .select('addon_id, quantity')
          .eq('booking_id', id);
        if (addonFetchError) throw addonFetchError;
        resolvedAddons = (currentAddons || []).map((row) => ({
          addon_id: row.addon_id,
          quantity: row.quantity,
        }));
      }

      const charges = await computeBookingCharges({
        villa_ids: resolvedVillaIds,
        selected_addons: resolvedAddons,
        check_in_date: nextCheckIn,
        check_out_date: nextCheckOut,
        propertyId: req.propertyId,
      });

      const discountContext = buildDiscountBookingContext({
        checkInDate: nextCheckIn,
        checkOutDate: nextCheckOut,
        nights: stayNights(nextCheckIn, nextCheckOut),
        bookingAmount: charges.accommodationTotal,
        villaIds: resolvedVillaIds,
        guestId: bookingMeta.guest_id,
      });

      const { discount } = await resolveDiscountForBooking({
        apply_discount: apply_discount === true,
        discount_id: apply_discount === true ? discount_id : undefined,
        context: discountContext,
        charges,
        propertyId: req.propertyId,
      });

      let discountAmount = 0;
      let appliedDiscountId = null;

      if (apply_discount === false) {
        discountAmount = 0;
        appliedDiscountId = null;
      } else {
        let discountToApply = discount;

        if (!discountToApply && apply_discount !== true) {
          const { data: currentBooking, error: currentBookingError } = await S(req, 'bookings')
            .select('discount_id')
            .eq('id', id)
            .single();
          if (currentBookingError) throw currentBookingError;
          if (currentBooking.discount_id) {
            discountToApply = await fetchDiscountById(currentBooking.discount_id, req.propertyId);
          }
        }

        if (discountToApply) {
          const eligibility = isDiscountEligible(discountToApply, discountContext);
          if (!eligibility.eligible) {
            discountToApply = null;
          }
        }

        if (discountToApply) {
          const result = calculateDiscountAmount(discountToApply, {
            ...discountContext,
            villaLines: charges.villaLines,
            addonLines: charges.addonLines,
            menuLines: [],
          });
          discountAmount = result.amount;
          appliedDiscountId = discountToApply.id;
        }
      }

      updateData.total_price = total_price !== undefined
        ? Number(total_price)
        : Math.max(charges.accommodationTotal - discountAmount, 0);
      updateData.discount_id = appliedDiscountId;
      updateData.discount_amount = discountAmount;

      const patchNights = stayNights(nextCheckIn, nextCheckOut);

      if (Array.isArray(villa_ids)) {
        await supabase.from('booking_villas').delete().eq('booking_id', id);
        if (villa_ids.length > 0) {
          const holidays = await fetchPricingHolidays(req.propertyId);
          const { data: villaCatalog, error: villaCatalogError } = await scopeQ(req.propertyId, 'villas')
            .select('id, base_rate_per_night, weekend_rate_per_night, holiday_rate_per_night')
            .in('id', villa_ids);
          if (villaCatalogError) throw villaCatalogError;

          const bridgeRows = buildBookingVillaRows(
            id,
            villa_ids,
            villaCatalog,
            nextCheckIn,
            nextCheckOut,
            holidays
          );
          const { error: bridgeError } = await supabase.from('booking_villas').insert(bridgeRows);
          if (bridgeError) throw bridgeError;
        }
      } else if (check_in_date !== undefined || check_out_date !== undefined) {
        const { data: currentBridge, error: bridgeFetchError } = await supabase
          .from('booking_villas')
          .select('id, villa_id, rate_per_night')
          .eq('booking_id', id);
        if (bridgeFetchError) throw bridgeFetchError;

        if (currentBridge?.length) {
          await Promise.all(
            currentBridge.map((row) =>
              supabase
                .from('booking_villas')
                .update({ nights: patchNights })
                .eq('id', row.id)
            )
          );
        }
      }

      if (Array.isArray(selected_addons)) {
        await supabase.from('booking_addons').delete().eq('booking_id', id);
        if (selected_addons.length > 0) {
          const addonIds = selected_addons.map((a) => a.addon_id);
          const { data: addonCatalog, error: addonFetchError } = await scopeQ(req.propertyId, 'addons')
            .select('id, price, is_per_night')
            .in('id', addonIds);
          if (addonFetchError) throw addonFetchError;

          const addonRows = buildBookingAddonRows(id, selected_addons, addonCatalog, patchNights);
          const { error: addonInsertError } = await supabase.from('booking_addons').insert(addonRows);
          if (addonInsertError) throw addonInsertError;
        }
      }
    } else if (total_price !== undefined) {
      updateData.total_price = total_price;
    }

    const { data, error } = await S(req, 'bookings')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        discounts (id, code, name, type, value, scope, status, application_rule),
        guests (full_name, phone_number),
        booking_villas (
          villa_id,
          rate_per_night,
          nights,
          villas (id, name, base_rate_per_night, display_id)
        ),
        booking_addons (
          addon_id,
          quantity,
          unit_price,
          subtotal,
          addons (id, name, price, is_per_night)
        )
      `)
      .single();

    if (error) throw error;

    try {
      await upsertReservationProfitability(id);
    } catch (profitErr) {
      console.error('Profitability snapshot failed:', profitErr.message);
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/bookings/:id/cancel', bookingAccessMiddleware, async (req, res) => {
  const { id } = req.params;
  const { cancellation_reason } = req.body;

  if (!cancellation_reason || !String(cancellation_reason).trim()) {
    return res.status(400).json({ error: 'Cancellation reason is required.' });
  }

  try {
    const { data: existing, error: fetchError } = await S(req, 'bookings')
      .select('notes, status')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (existing.status === 'cancelled') {
      return res.status(400).json({ error: 'Booking is already cancelled.' });
    }

    const reasonLine = `[CANCELLED ${new Date().toISOString().split('T')[0]}] ${String(cancellation_reason).trim()}`;
    const updatedNotes = existing.notes
      ? `${existing.notes}\n\n${reasonLine}`
      : reasonLine;

    const { data, error } = await S(req, 'bookings')
      .update({
        status: 'cancelled',
        payment_status: 'cancelled',
        notes: updatedNotes,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.message?.includes('check_payment_status')) {
        return res.status(400).json({
          error: 'Could not cancel booking: the database must allow payment_status "cancelled". Run backend/db/migrations/001_allow_cancelled_payment_status.sql in Supabase SQL Editor.',
        });
      }
      throw error;
    }

    await S(req, 'reservation_profitability').delete().eq('booking_id', id);

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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

app.get('/api/bookings/:bookingId/orders', async (req, res) => {
  const { bookingId } = req.params;

  try {
    await assertBookingInProperty(supabase, scopeQ, req.propertyId, bookingId);
    const { data, error } = await S(req, 'orders')
      .select(`
        *,
        order_items (
          id,
          quantity,
          unit_price,
          unit_cost,
          subtotal,
          menu_items (id, name, category)
        )
      `)
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bookings/:bookingId/orders', async (req, res) => {
  const { bookingId } = req.params;
  const { items, staff_note } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one item.' });
  }

  try {
    await assertBookingInProperty(supabase, scopeQ, req.propertyId, bookingId);
    const menuIds = items.map(i => i.menu_item_id);
    const { data: menuData, error: menuError } = await S(req, 'menu_items')
      .select('id, price')
      .in('id', menuIds);

    if (menuError) throw menuError;

    const priceMap = {};
    menuData.forEach(m => { priceMap[m.id] = m.price; });

    const total_amount = items.reduce((sum, item) => {
      return sum + (priceMap[item.menu_item_id] || 0) * item.quantity;
    }, 0);

    const { data: order, error: orderError } = await INS(req, 'orders', [{
      booking_id: bookingId,
      staff_note: staff_note || null,
      total_amount,
      status: ORDER_STATUS_OPEN,
    }]).select().single();

    if (orderError) throw orderError;

    const orderItemRows = items.map(item => {
      const unitPrice = priceMap[item.menu_item_id] || 0;
      const quantity = item.quantity;
      return {
        order_id: order.id,
        menu_item_id: item.menu_item_id,
        quantity,
        unit_price: unitPrice,
        unit_cost: 0,
      };
    });

    const { error: itemsError } = await supabase.from('order_items').insert(orderItemRows);
    if (itemsError) throw itemsError;

    res.status(201).json({ ...order, items: orderItemRows });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/bookings/:bookingId/food-orders', async (req, res) => {
  const { bookingId } = req.params;

  try {
    await assertBookingInProperty(supabase, scopeQ, req.propertyId, bookingId);
    const { data, error } = await S(req, 'orders')
      .select(`
        *,
        order_items (
          id,
          quantity,
          unit_price,
          unit_cost,
          subtotal,
          menu_items (id, name, category)
        )
      `)
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formatted = (data || []).map(order => ({
      ...order,
      total_price: order.total_amount,
      items: (order.order_items || []).map(item => ({
        menu_item_name: item.menu_items?.name || 'Unknown',
        quantity: item.quantity,
        price_at_order: Number(item.unit_price) || 0,
        subtotal: Number(item.subtotal) || Number(item.unit_price) * (item.quantity || 1),
      })),
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bookings/:bookingId/food-orders', async (req, res) => {
  const { bookingId } = req.params;
  const { items } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one item.' });
  }

  try {
    await assertBookingInProperty(supabase, scopeQ, req.propertyId, bookingId);
    const menuIds = items.map(i => i.menu_item_id);
    const { data: menuData, error: menuError } = await S(req, 'menu_items')
      .select('id, price')
      .in('id', menuIds);

    if (menuError) throw menuError;

    const priceMap = {};
    menuData.forEach(m => { priceMap[m.id] = m.price; });

    const total_amount = items.reduce((sum, item) => {
      return sum + (priceMap[item.menu_item_id] || 0) * item.quantity;
    }, 0);

    const { data: order, error: orderError } = await INS(req, 'orders', [{
      booking_id: bookingId,
      total_amount,
      status: ORDER_STATUS_OPEN,
    }]).select().single();

    if (orderError) {
      console.error("❌ Supabase Orders Insert Error:", orderError);
      return res.status(400).json({ error: orderError.message });
    }

    const orderItemRows = items.map(item => {
      const unitPrice = priceMap[item.menu_item_id] || 0;
      const quantity = item.quantity;
      return {
        order_id: order.id,
        menu_item_id: item.menu_item_id,
        quantity,
        unit_price: unitPrice,
        unit_cost: 0,
      };
    });

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemRows);

    if (itemsError) {
      console.error("❌ Supabase Order Items Insert Error:", itemsError);
      throw itemsError;
    }

    try {
      await upsertReservationProfitability(bookingId, req.propertyId);
    } catch (profitErr) {
      console.error('Profitability snapshot failed:', profitErr.message);
    }

    res.status(201).json({ ...order, items: orderItemRows });
  } catch (error) {
    console.error("Backend Food Order Submission Error:", error);
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/orders/:orderId/status', async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `Invalid order status. Allowed: ${ORDER_STATUSES.join(', ')}`,
    });
  }

  try {
    const { data, error } = await S(req, 'orders')
      .update({ status })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 🏡  VILLAS
// ─────────────────────────────────────────────────────────────

app.get('/api/villas/gantt', async (req, res) => {
  try {
    const { data: villas, error: villaError } = await S(req, 'villas')
      .select('id, name, capacity, base_rate_per_night, display_id')
      .order('name');

    if (villaError) throw villaError;

    const { data: bookings, error: bookingError } = await S(req, 'bookings')
      .select(`id, display_id, status, check_in_date, check_out_date, guests (full_name), booking_villas (villa_id)`)
      .not('status', 'eq', 'cancelled');

    if (bookingError) throw bookingError;

    const { data: blocks } = await scopeQ(req.propertyId, 'villa_date_blocks')
      .select('id, villa_id, start_date, end_date, reason, created_at, created_by, users:created_by (name)');

    const ganttData = villas.map(villa => {
      const villaBookings = bookings
        .filter(b => b.booking_villas?.some(bv => bv.villa_id === villa.id))
        .map(b => ({
          id: b.id,
          displayId: b.display_id || null,
          guest: b.guests?.full_name || 'Unknown Guest',
          checkIn: b.check_in_date,
          checkOut: b.check_out_date,
          status: b.status,
        }));

      const villaBlocks = (blocks || [])
        .filter(blk => blk.villa_id === villa.id)
        .map(blk => ({
          id: blk.id,
          startDate: blk.start_date,
          endDate: blk.end_date,
          reason: blk.reason,
          createdAt: blk.created_at,
          createdBy: blk.users?.name || null,
        }));

      return { id: villa.id, name: villa.name, bookings: villaBookings, blocks: villaBlocks };
    });

    res.json(ganttData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/villas/blocks', async (req, res) => {
  const { villa_id, start_date, end_date, reason } = req.body;
  if (!villa_id || !start_date || !end_date || !reason?.trim()) {
    return res.status(400).json({ error: 'Villa, start date, end date, and reason are required.' });
  }
  if (end_date < start_date) {
    return res.status(400).json({ error: 'End date must be on or after start date.' });
  }
  try {
    const conflicts = await findBlockingReservationsForBlock(
      supabase,
      villa_id,
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
      villa_id,
      start_date,
      end_date,
      reason: reason.trim(),
    };
    if (req.user?.id) {
      insertPayload.created_by = req.user.id;
    }

    const { data, error } = await INS(req, 'villa_date_blocks', [insertPayload])
      .select('id, villa_id, start_date, end_date, reason, created_at, created_by, users:created_by (name)')
      .single();
    if (error) throw error;
    res.status(201).json({
      id: data.id,
      villa_id: data.villa_id,
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

app.delete('/api/villas/blocks/:id', async (req, res) => {
  try {
    const { error } = await S(req, 'villa_date_blocks').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/villas/availability', async (req, res) => {
  const { check_in, check_out } = req.query;
  if (!check_in || !check_out) {
    return res.status(400).json({ error: 'Missing check_in or check_out parameters.' });
  }

  try {
    const { data: conflicts, error } = await supabase
      .from('booking_villas')
      .select(`villa_id, bookings!inner (status, check_in_date, check_out_date, property_id)`)
      .eq('bookings.property_id', req.propertyId)
      .not('bookings.status', 'eq', 'cancelled')
      .lt('bookings.check_in_date', check_out)
      .gt('bookings.check_out_date', check_in);

    if (error) throw error;
    const occupiedVillaIds = conflicts ? [...new Set(conflicts.map((c) => c.villa_id))] : [];

    const blockRows = await findBlockConflicts(null, check_in, check_out, req.propertyId);
    const blockedVillaIds = [...new Set(blockRows.map((b) => b.villa_id))];
    const blockedDetails = blockRows.map((b) => ({
      villa_id: b.villa_id,
      start_date: b.start_date,
      end_date: b.end_date,
      reason: b.reason,
    }));

    res.json({ occupiedVillaIds, blockedVillaIds, blockedDetails });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/villas', async (req, res) => {
  try {
    const { data, error } = await S(req, 'villas').select('id, name, capacity, base_rate_per_night, weekend_rate_per_night, holiday_rate_per_night, description, base_breakfast, display_id, created_at').order('name');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/villas', async (req, res) => {
  const {
    name,
    capacity = 1,
    base_rate_per_night,
    weekend_rate_per_night,
    holiday_rate_per_night,
    description = '',
    base_breakfast = 0,
  } = req.body;
  if (!name?.trim() || base_rate_per_night === undefined) {
    return res.status(400).json({ error: 'Name and weekday rate are required.' });
  }
  try {
    const row = {
      name: name.trim(),
      capacity: Number(capacity) || 1,
      base_rate_per_night: Number(base_rate_per_night),
      description,
      base_breakfast: Number(base_breakfast) || 0,
    };
    if (weekend_rate_per_night !== undefined && weekend_rate_per_night !== '') {
      row.weekend_rate_per_night = Number(weekend_rate_per_night);
    }
    if (holiday_rate_per_night !== undefined && holiday_rate_per_night !== '') {
      row.holiday_rate_per_night = Number(holiday_rate_per_night);
    }
    const { data, error } = await INS(req, 'villas', [row]).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/villas/:id', async (req, res) => {
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
  try {
    const { data, error } = await S(req, 'villas').update(payload).eq('id', id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/pricing/holidays', async (req, res) => {
  try {
    const data = await fetchPricingHolidays(req.propertyId);
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

app.delete('/api/villas/:id', async (req, res) => {
  try {
    const { error } = await S(req, 'villas').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Villa deleted.' });
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
// 💳  PAYMENT MANAGEMENT
// ─────────────────────────────────────────────────────────────

function stayNights(checkIn, checkOut) {
  return Math.max(
    Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)),
    1
  );
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function currentMonthBounds() {
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const end = lastDay.toISOString().split('T')[0];
  return { start, end };
}

function addDaysISO(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function encodeExpenseProof(description, proofUrl) {
  const base = (description || '').trim();
  if (!proofUrl) return base || null;
  return base ? `${base}\n[proof:${proofUrl}]` : `[proof:${proofUrl}]`;
}

function parseExpenseRecord(row) {
  const rawDescription = row.description || '';
  const proofMatch = rawDescription.match(/\[proof:([^\]]+)\]/);
  const proof = proofMatch?.[1] || null;
  const description = rawDescription.replace(/\n?\[proof:[^\]]+\]\s*$/, '').trim();
  return {
    id: row.id,
    displayId: row.display_id,
    category: row.category,
    description,
    amount: Number(row.amount) || 0,
    transactionDate: row.transaction_date,
    status: row.status,
    proof,
    createdAt: row.created_at,
  };
}

function addonUnitPrice(addon) {
  return Number(addon?.price) || 0;
}

function mapAddonRow(row) {
  if (!row) return row;
  const price = Number(row.price) || 0;
  return { ...row, price, price_per_night: price };
}

async function fetchPricingHolidays(propertyId) {
  const { data, error } = await scopeQ(propertyId, 'pricing_holidays')
    .select('id, name, start_date, end_date')
    .order('start_date');
  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }
  return data || [];
}

function buildBookingVillaRows(bookingId, villaIds, villaCatalog, checkIn, checkOut, holidays = []) {
  const villaMap = Object.fromEntries((villaCatalog || []).map((v) => [v.id, v]));
  return villaIds.map((villaId) => {
    const villa = villaMap[villaId];
    const { avgRate, nights } = computeVillaStayCharges(villa || {}, checkIn, checkOut, holidays);
    return {
      booking_id: bookingId,
      villa_id: villaId,
      rate_per_night: avgRate,
      nights,
    };
  });
}

function buildBookingAddonRows(bookingId, selectedAddons, addonCatalog, nights) {
  const addonMap = Object.fromEntries((addonCatalog || []).map((a) => [a.id, a]));
  return selectedAddons.map((selection) => {
    const addon = addonMap[selection.addon_id];
    const unitPrice = addon ? addonUnitPrice(addon) : 0;
    const quantity = Number(selection.quantity) || 1;
    return {
      booking_id: bookingId,
      addon_id: selection.addon_id,
      quantity,
      unit_price: unitPrice,
    };
  });
}

async function fetchDiscountById(discountId, propertyId) {
  if (!discountId) return null;
  const { data, error } = await scopeQ(propertyId, 'discounts').select('*').eq('id', discountId).maybeSingle();
  if (error) throw error;
  return data;
}

async function computeBookingCharges({ villa_ids = [], selected_addons = [], check_in_date, check_out_date, propertyId }) {
  const nights = stayNights(check_in_date, check_out_date);
  let villaTotal = 0;
  const villaLines = [];
  const holidays = await fetchPricingHolidays(propertyId);

  if (villa_ids.length > 0) {
    const { data: villas, error } = await scopeQ(propertyId, 'villas').select('id, name, base_rate_per_night, weekend_rate_per_night, holiday_rate_per_night').in('id', villa_ids);
    if (error) throw error;
    (villas || []).forEach((villa) => {
      const { total, avgRate } = computeVillaStayCharges(villa, check_in_date, check_out_date, holidays);
      villaTotal += total;
      villaLines.push({
        type: 'accommodation',
        name: villa.name,
        description: `${villa.name} — ${nights} night${nights !== 1 ? 's' : ''}`,
        quantity: nights,
        unitPrice: avgRate,
        subtotal: total,
        villa_id: villa.id,
      });
    });
  }

  let addonTotal = 0;
  const addonLines = [];

  if (selected_addons.length > 0) {
    const addonIds = selected_addons.map((a) => a.addon_id);
    const { data: addons, error } = await scopeQ(propertyId, 'addons').select('id, name, price, is_per_night').in('id', addonIds);
    if (error) throw error;
    const addonMap = Object.fromEntries((addons || []).map((a) => [a.id, a]));

    selected_addons.forEach(({ addon_id, quantity }) => {
      const addon = addonMap[addon_id];
      if (!addon) return;
      const qty = Number(quantity) || 1;
      const unitPrice = addonUnitPrice(addon);
      const multiplier = addon.is_per_night !== false ? nights : 1;
      const subtotal = unitPrice * qty * multiplier;
      addonTotal += subtotal;
      addonLines.push({
        type: 'addon',
        name: addon.name,
        description: addon.name,
        quantity: qty * multiplier,
        unitPrice,
        subtotal,
      });
    });
  }

  return {
    nights,
    villaTotal,
    addonTotal,
    accommodationTotal: villaTotal + addonTotal,
    villaLines,
    addonLines,
  };
}

async function resolveDiscountForBooking({ apply_discount, discount_id, context = {}, charges = null, propertyId }) {
  if (!apply_discount) {
    return { discount: null, discount_id: null, discount_amount: 0 };
  }

  let discount = null;
  if (discount_id) {
    discount = await fetchDiscountById(discount_id, propertyId);
    if (discount) {
      const eligibility = isDiscountEligible(discount, context);
      if (!eligibility.eligible) {
        return { discount: null, discount_id: null, discount_amount: 0 };
      }
    }
  } else {
    const { data, error } = await scopeQ(propertyId, 'discounts')
      .select('*')
      .eq('status', 'active')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;

    const eligible = (data || []).filter((row) => isDiscountEligible(row, context).eligible);
    if (eligible.length > 0 && charges) {
      const resolved = resolveDiscountApplication(eligible, {
        ...context,
        villaLines: charges.villaLines,
        addonLines: charges.addonLines,
        menuLines: [],
      });
      discount = resolved.discount;
    } else if (eligible.length > 0) {
      discount = eligible[0];
    }
  }

  if (!discount || normalizeStatus(discount.status) !== 'active') {
    return { discount: null, discount_id: null, discount_amount: 0 };
  }

  return { discount, discount_id: discount.id, discount_amount: null };
}

function buildInvoiceId(bookingOrId) {
  if (bookingOrId && typeof bookingOrId === 'object') {
    if (bookingOrId.display_id) return bookingOrId.display_id;
    return `UM-${String(bookingOrId.id).slice(0, 8).toUpperCase()}`;
  }
  return `UM-${String(bookingOrId).slice(0, 8).toUpperCase()}`;
}

async function buildFinancialSummary(bookingId, propertyId) {
  const { data: booking, error: bookingError } = await scopeQ(propertyId, 'bookings')
    .select(`
      *,
      discounts (id, code, name, type, value, scope, status, application_rule),
      guests (full_name, phone_number),
      booking_villas (
        rate_per_night,
        nights,
        villa_id,
        villas (
          id,
          name,
          base_rate_per_night,
          weekend_rate_per_night,
          holiday_rate_per_night,
          base_breakfast
        )
      ),
      booking_addons (
        quantity,
        unit_price,
        subtotal,
        addons (name, price, is_per_night, base_breakfast)
      )
    `)
    .eq('id', bookingId)
    .single();

  if (bookingError) throw bookingError;

  const { data: orders, error: orderError } = await scopeQ(propertyId, 'orders')
    .select(`
      id,
      total_amount,
      status,
      created_at,
      order_items (
        quantity,
        unit_price,
        subtotal,
        menu_items (name, category)
      )
    `)
    .eq('booking_id', bookingId)
    .in('status', ORDER_STATUSES);

  if (orderError) throw orderError;

  const nights = stayNights(booking.check_in_date, booking.check_out_date);
  const holidays = await fetchPricingHolidays(propertyId);
  const villaCatalog = (booking.booking_villas || [])
    .map((bv) => bv.villas)
    .filter(Boolean);

  let accommodationLines = [];
  let calculatedAccommodation = 0;

  if (villaCatalog.length > 0) {
    const tiered = buildTieredAccommodationLines(
      villaCatalog,
      booking.check_in_date,
      booking.check_out_date,
      holidays
    );
    accommodationLines = tiered.lines;
    calculatedAccommodation = tiered.total;
  }

  if (accommodationLines.length === 0) {
    (booking.booking_villas || []).forEach((bv) => {
      const rate = Number(bv.rate_per_night) || Number(bv.villas?.base_rate_per_night) || 0;
      const lineNights = Number(bv.nights) || nights;
      const subtotal = rate > 0 ? rate * lineNights : 0;
      if (rate > 0) {
        calculatedAccommodation += subtotal;
        accommodationLines.push({
          type: 'accommodation',
          name: bv.villas?.name || 'Villa',
          description: `${bv.villas?.name || 'Villa'} — ${lineNights} night${lineNights !== 1 ? 's' : ''}`,
          quantity: lineNights,
          unitPrice: rate,
          subtotal,
          villa_id: bv.villa_id,
        });
      }
    });
  }

  const accommodation = calculatedAccommodation > 0
    ? calculatedAccommodation
    : Number(booking.total_price) || 0;

  if (accommodationLines.length === 0) {
    accommodationLines.push({
      type: 'accommodation',
      name: 'Accommodation',
      description: `Stay ${booking.check_in_date} → ${booking.check_out_date}`,
      quantity: nights,
      unitPrice: nights > 0 ? accommodation / nights : accommodation,
      subtotal: accommodation,
    });
  }

  const addonLines = (booking.booking_addons || []).map((ba) => {
    const unitPrice = Number(ba.unit_price) || addonUnitPrice(ba.addons);
    const quantity = ba.quantity || 1;
    const multiplier = ba.addons?.is_per_night !== false ? nights : 1;
    const billableQty = quantity * multiplier;
    const subtotal = Number(ba.subtotal) || unitPrice * billableQty;
    return {
      type: 'addon',
      name: ba.addons?.name || 'Add-on',
      description: ba.addons?.name || 'Add-on',
      quantity: billableQty,
      unitPrice,
      subtotal,
    };
  });

  let extraBeds = 0;
  let extraBreakfast = 0;
  let otherAddons = 0;
  (booking.booking_addons || []).forEach((ba) => {
    const unitPrice = Number(ba.unit_price) || addonUnitPrice(ba.addons);
    const quantity = ba.quantity || 1;
    const multiplier = ba.addons?.is_per_night !== false ? nights : 1;
    const lineTotal = Number(ba.subtotal) || unitPrice * quantity * multiplier;
    const addonName = (ba.addons?.name || '').toLowerCase();
    if (addonName.includes('extra bed')) extraBeds += lineTotal;
    else if ((ba.addons?.base_breakfast || 0) > 0 || addonName.includes('breakfast')) extraBreakfast += lineTotal;
    else otherAddons += lineTotal;
  });

  const totalAddons = addonLines.reduce((sum, line) => sum + line.subtotal, 0);

  const menuLines = [];
  let menuTotal = 0;
  (orders || []).forEach((order) => {
    if (order.order_items?.length) {
      order.order_items.forEach((item) => {
        const unitPrice = Number(item.unit_price) || 0;
        const quantity = item.quantity || 1;
        const subtotal = Number(item.subtotal) || unitPrice * quantity;
        menuTotal += subtotal;
        menuLines.push({
          type: 'menu',
          name: item.menu_items?.name || 'Menu Item',
          description: item.menu_items?.name || 'Menu Item',
          category: item.menu_items?.category || null,
          quantity,
          unitPrice,
          subtotal,
          orderDate: order.created_at,
        });
      });
    } else if (Number(order.total_amount) > 0) {
      menuTotal += Number(order.total_amount);
      menuLines.push({
        type: 'menu',
        name: 'Order (unspecified items)',
        description: 'Order total',
        quantity: 1,
        unitPrice: Number(order.total_amount),
        subtotal: Number(order.total_amount),
        orderDate: order.created_at,
      });
    }
  });

  const menuItems = menuLines.map(({ name, quantity, subtotal, unitPrice }) => ({
    name, quantity, subtotal, unitPrice,
  }));

  const subtotalBeforeDiscount = accommodation + totalAddons + menuTotal;

  let discountAmount = 0;
  let discountLines = [];
  let discountMeta = null;

  if (booking.discount_id && booking.discounts) {
    const discountResult = calculateDiscountAmount(booking.discounts, {
      checkInDate: booking.check_in_date,
      checkOutDate: booking.check_out_date,
      nights,
      bookingAmount: subtotalBeforeDiscount,
      villaIds: (booking.booking_villas || []).map((bv) => bv.villa_id).filter(Boolean),
      villaLines: accommodationLines,
      addonLines,
      menuLines,
    });
    discountAmount = discountResult.amount > 0
      ? discountResult.amount
      : Number(booking.discount_amount) || 0;
    discountLines = discountResult.lines.length > 0
      ? discountResult.lines
      : (discountAmount > 0 ? [{
          type: 'discount',
          name: booking.discounts.name || booking.discounts.code || 'Discount',
          description: `Discount (${booking.discounts.code})`,
          quantity: 1,
          unitPrice: -discountAmount,
          subtotal: -discountAmount,
        }] : []);
    discountMeta = mapDiscountRow(booking.discounts);
  } else if (Number(booking.discount_amount) > 0) {
    discountAmount = Number(booking.discount_amount);
    discountLines = [{
      type: 'discount',
      name: 'Discount',
      description: 'Applied discount',
      quantity: 1,
      unitPrice: -discountAmount,
      subtotal: -discountAmount,
    }];
  }

  const lineItems = [...accommodationLines, ...addonLines, ...menuLines, ...discountLines];
  const total = Math.max(subtotalBeforeDiscount - discountAmount, 0);
  const amountPaid = Number(booking.amount_paid) || 0;
  const balanceDue = Math.max(total - amountPaid, 0);

  const { data: partialPayments } = await scopeQ(propertyId, 'finances')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('category', 'partial_payment')
    .limit(1);

  return {
    booking,
    invoiceId: buildInvoiceId(booking),
    displayId: booking.display_id || buildInvoiceId(booking),
    accommodation,
    totalAccommodation: accommodation,
    totalAddons,
    totalMenuItems: menuTotal,
    extraBeds,
    extraBreakfast,
    otherAddons,
    accommodationLines,
    addonLines,
    menuLines,
    discountLines,
    lineItems,
    menuItems,
    menuTotal,
    subtotalBeforeDiscount,
    discountAmount,
    discount: discountMeta,
    discountCode: discountMeta?.code || null,
    applicationRule: discountMeta?.application_rule || null,
    total,
    amountPaid,
    balanceDue,
    balance: balanceDue,
    reminder: balanceDue,
    paymentStatus: booking.payment_status || 'pending',
    hasPartialPayment: (partialPayments || []).length > 0 || booking.payment_status === 'partial' || booking.payment_status === 'complete',
    villaNames: booking.booking_villas?.map((bv) => bv.villas?.name).filter(Boolean).join(', ') || '—',
    guestName: booking.guests?.full_name || 'Guest',
    phone: booking.guests?.phone_number || '',
    totalGuests: booking.total_guests,
  };
}

async function upsertReservationProfitability(bookingId, propertyId) {
  const { data: booking, error: bookingError } = await scopeQ(propertyId, 'bookings')
    .select('id, status, check_in_date, check_out_date')
    .eq('id', bookingId)
    .single();

  if (bookingError) throw bookingError;

  if (booking.status === 'cancelled') {
    await scopeQ(propertyId, 'reservation_profitability').delete().eq('booking_id', bookingId);
    return [];
  }

  const summary = await buildFinancialSummary(bookingId, propertyId);
  const bookingVillas = summary.booking?.booking_villas || [];
  if (!bookingVillas.length) return [];

  const villaIds = bookingVillas.map((bv) => bv.villa_id).filter(Boolean);
  const { data: profiles } = await scopeQ(propertyId, 'villa_cost_profiles')
    .select('villa_id, fixed_stay_cost, cost_per_night')
    .in('villa_id', villaIds);

  const profileMap = {};
  (profiles || []).forEach((p) => { profileMap[p.villa_id] = p; });

  const nights = stayNights(booking.check_in_date, booking.check_out_date);

  const roomByVilla = {};
  villaIds.forEach((vid) => { roomByVilla[vid] = 0; });
  (summary.accommodationLines || []).forEach((line) => {
    const vid = line.villa_id;
    if (vid && roomByVilla[vid] !== undefined) {
      roomByVilla[vid] += Number(line.subtotal) || 0;
    }
  });

  const totalRoomFromLines = Object.values(roomByVilla).reduce((s, v) => s + v, 0);
  if (totalRoomFromLines === 0 && summary.totalAccommodation > 0) {
    const perVilla = summary.totalAccommodation / bookingVillas.length;
    villaIds.forEach((vid) => { roomByVilla[vid] = perVilla; });
  }

  const totalRoom = Object.values(roomByVilla).reduce((s, v) => s + v, 0);
  const addonTotal = summary.totalAddons || 0;
  const fbTotal = summary.totalMenuItems || 0;

  const rows = bookingVillas.map((bv) => {
    const vid = bv.villa_id;
    const profile = profileMap[vid];
    const fixedSnap = Number(profile?.fixed_stay_cost) || 0;
    const perNightSnap = Number(profile?.cost_per_night) || 0;
    const villaNights = Number(bv.nights) || nights;
    const cogs = calculateReservationCogs(fixedSnap, perNightSnap, villaNights);

    const roomRevenue = roomByVilla[vid] || 0;
    const share = totalRoom > 0 ? roomRevenue / totalRoom : 1 / bookingVillas.length;
    const addonRevenue = addonTotal * share;
    const fbRevenue = fbTotal * share;
    const revenue = roomRevenue + addonRevenue + fbRevenue;
    const grossProfit = calculateGrossProfit(revenue, cogs);

    return {
      booking_id: bookingId,
      villa_id: vid,
      property_id: propertyId,
      revenue,
      room_revenue: roomRevenue,
      addon_revenue: addonRevenue,
      fb_revenue: fbRevenue,
      cogs,
      gross_profit: grossProfit,
      fixed_stay_cost_snapshot: fixedSnap,
      cost_per_night_snapshot: perNightSnap,
      nights: villaNights,
      calculated_at: new Date().toISOString(),
    };
  });

  const { data: existingRows } = await scopeQ(propertyId, 'reservation_profitability')
    .select('villa_id')
    .eq('booking_id', bookingId);

  const removeIds = (existingRows || [])
    .map((r) => r.villa_id)
    .filter((vid) => !villaIds.includes(vid));

  if (removeIds.length) {
    await scopeQ(propertyId, 'reservation_profitability')
      .delete()
      .eq('booking_id', bookingId)
      .in('villa_id', removeIds);
  }

  const { data, error } = await scopeQ(propertyId, 'reservation_profitability')
    .upsert(rows, { onConflict: 'booking_id,villa_id' })
    .select();

  if (error) throw error;
  return data || [];
}

function mapCostProfileRow(row) {
  return {
    id: row.id,
    villaId: row.villa_id,
    villaName: row.villas?.name || '—',
    fixedStayCost: Number(row.fixed_stay_cost) || 0,
    costPerNight: Number(row.cost_per_night) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProfitabilityRow(row) {
  return {
    id: row.id,
    bookingId: row.booking_id,
    villaId: row.villa_id,
    villaName: row.villas?.name || '—',
    checkIn: row.bookings?.check_in_date,
    checkOut: row.bookings?.check_out_date,
    bookingStatus: row.bookings?.status,
    revenue: Number(row.revenue) || 0,
    roomRevenue: Number(row.room_revenue) || 0,
    addonRevenue: Number(row.addon_revenue) || 0,
    fbRevenue: Number(row.fb_revenue) || 0,
    cogs: Number(row.cogs) || 0,
    grossProfit: Number(row.gross_profit) || 0,
    fixedStayCostSnapshot: Number(row.fixed_stay_cost_snapshot) || 0,
    costPerNightSnapshot: Number(row.cost_per_night_snapshot) || 0,
    nights: row.nights,
    calculatedAt: row.calculated_at,
  };
}

// ─────────────────────────────────────────────────────────────
// 📎  RECEIPT UPLOAD — Supabase Storage
// ─────────────────────────────────────────────────────────────

app.post('/api/bookings/:bookingId/upload-receipt', async (req, res) => {
  const { bookingId } = req.params;
  const { fileData, fileName, fileType, paymentType } = req.body;

  if (!fileData || !fileName) {
    return res.status(400).json({ error: 'fileData and fileName are required.' });
  }

  try {
    const { data: booking, error: bookingError } = await S(req, 'bookings')
      .select('id, guest_id, payment_status, amount_paid')
      .eq('id', bookingId)
      .single();

    if (bookingError) throw bookingError;

    let suffix = '_partial';
    if (paymentType === 'final' || booking.payment_status === 'complete') {
      suffix = '_full';
    }

    const dotIdx = fileName.lastIndexOf('.');
    const baseName = dotIdx !== -1 ? fileName.slice(0, dotIdx) : fileName;
    const ext      = dotIdx !== -1 ? fileName.slice(dotIdx)    : '';
    const finalFileName = `${baseName}${suffix}${ext}`;

    const storagePath = `receipt/guest/${booking.guest_id}/${bookingId}/${finalFileName}`;

    const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('transaction_reservation')
      .upload(storagePath, buffer, {
        contentType: fileType || 'application/octet-stream',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('transaction_reservation')
      .getPublicUrl(storagePath);

    res.json({
      message: 'Receipt uploaded successfully',
      path: storagePath,
      publicUrl: urlData?.publicUrl || null,
      fileName: finalFileName,
      suffix,
    });
  } catch (error) {
    console.error('Receipt upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 📊  FINANCIAL ENDPOINTS
// ─────────────────────────────────────────────────────────────

app.get('/api/financial/income', async (req, res) => {
  try {
    const { limit, cursor } = parsePagination(req.query);
    const { data, nextCursor, hasMore } = await fetchCursorPage(
      supabase.from('booking_income_summary').select('*').eq('property_id', req.propertyId),
      { limit, cursor },
    );

    const rows = (data || []).map((row) => ({
      bookingId: row.booking_id,
      displayId: row.display_id,
      invoiceId: row.display_id,
      guestName: row.guest_name || 'Unknown Guest',
      checkIn: row.check_in_date,
      checkOut: row.check_out_date,
      totalAccommodation: Number(row.total_accommodation) || 0,
      totalAddons: Number(row.total_addons) || 0,
      totalMenuItems: Number(row.total_menu_items) || 0,
      subtotalBeforeDiscount: Number(row.subtotal_before_discount) || 0,
      discountAmount: Number(row.discount_amount) || 0,
      discountCode: row.discount_code || null,
      total: Number(row.total) || 0,
      amountPaid: Number(row.amount_paid) || 0,
      balanceDue: Number(row.balance_due) || 0,
      paymentStatus: row.payment_status,
      bookingStatus: row.booking_status,
    }));

    paginatedJson(res, { data: rows, nextCursor, hasMore });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/financial/kpis', async (req, res) => {
  try {
    const { start, end } = currentMonthBounds();
    const today = todayISO();
    const depositWindowEnd = addDaysISO(today, 30);

    const { data: incomeRows, error: incomeError } = await S(req, 'finances')
      .select('amount')
      .eq('type', 'income')
      .eq('status', 'approved')
      .gte('transaction_date', start)
      .lte('transaction_date', end);

    if (incomeError) throw incomeError;

    const { data: expenseRows, error: expenseError } = await S(req, 'finances')
      .select('amount')
      .eq('type', 'expense')
      .eq('status', 'approved')
      .gte('transaction_date', start)
      .lte('transaction_date', end);

    if (expenseError) throw expenseError;

    const totalRevenue = (incomeRows || []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const totalExpenses = (expenseRows || []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    const { data: upcomingBookings, error: upcomingError } = await S(req, 'bookings')
      .select('id, amount_paid, payment_status, status, check_in_date')
      .eq('status', 'confirmed')
      .in('payment_status', ['partial', 'partially_paid'])
      .gt('check_in_date', today);

    if (upcomingError) throw upcomingError;

    const { data: pendingDepositBookings, error: depositError } = await S(req, 'bookings')
      .select('id, total_price, payment_status, status, check_in_date')
      .eq('status', 'confirmed')
      .eq('payment_status', 'pending')
      .gte('check_in_date', today)
      .lte('check_in_date', depositWindowEnd);

    if (depositError) throw depositError;

    let upcomingRevenue = 0;
    for (const booking of upcomingBookings || []) {
      const summary = await buildFinancialSummary(booking.id, req.propertyId);
      upcomingRevenue += Math.max(summary.total - (Number(booking.amount_paid) || 0), 0);
    }

    let pendingDeposits = 0;
    for (const booking of pendingDepositBookings || []) {
      const summary = await buildFinancialSummary(booking.id, req.propertyId);
      pendingDeposits += summary.total;
    }

    res.json({
      totalRevenue,
      upcomingRevenue,
      pendingDeposits,
      totalExpenses,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/financial/transactions', async (req, res) => {
  try {
    const { data, error } = await S(req, 'finances')
      .select('id, type, amount, category, transaction_date, status, booking_id')
      .eq('status', 'approved')
      .order('transaction_date', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/financial/expenses', async (req, res) => {
  try {
    const { data, error } = await S(req, 'finances')
      .select('id, display_id, category, description, amount, transaction_date, status, created_at')
      .eq('type', 'expense')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json((data || []).map(parseExpenseRecord));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/financial/expenses/upload-proof', async (req, res) => {
  const { fileData, fileName, fileType } = req.body;

  if (!fileData || !fileName) {
    return res.status(400).json({ error: 'fileData and fileName are required.' });
  }

  try {
    const dotIdx = fileName.lastIndexOf('.');
    const ext = dotIdx !== -1 ? fileName.slice(dotIdx) : '';
    const storagePath = `proofs/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

    const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const { error: uploadError } = await supabase.storage
      .from('expenses')
      .upload(storagePath, buffer, {
        contentType: fileType || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('expenses')
      .getPublicUrl(storagePath);

    res.json({
      message: 'Proof uploaded successfully',
      path: storagePath,
      publicUrl: urlData?.publicUrl || null,
    });
  } catch (error) {
    console.error('Expense proof upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/financial/expenses', async (req, res) => {
  const { category, description, amount, transactionDate, proofUrl } = req.body;

  if (!category || !amount || !transactionDate) {
    return res.status(400).json({ error: 'category, amount, and transactionDate are required.' });
  }

  const validCategories = ['operational', 'maintenance', 'salary', 'f&b_cost', 'marketing', 'other_expense'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Invalid expense category.' });
  }

  try {
    const payload = {
      type: 'expense',
      category,
      description: encodeExpenseProof(description, proofUrl),
      amount: Number(amount),
      transaction_date: transactionDate,
      status: 'pending',
    };

    const { data, error } = await INS(req, 'finances', [payload])
      .select('id, display_id, category, description, amount, transaction_date, status, created_at')
      .single();

    if (error) throw error;

    res.status(201).json(parseExpenseRecord(data));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/financial/expenses/:expenseId', async (req, res) => {
  const { expenseId } = req.params;
  const { status, category, description, amount, transactionDate, proofUrl } = req.body;

  try {
    const { data: existing, error: fetchError } = await S(req, 'finances')
      .select('id, description, type, status, amount')
      .eq('id', expenseId)
      .single();

    if (fetchError) throw fetchError;
    if (existing.type !== 'expense') {
      return res.status(400).json({ error: 'Record is not an expense.' });
    }

    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (category !== undefined) updateData.category = category;
    if (amount !== undefined) updateData.amount = Number(amount);
    if (transactionDate !== undefined) updateData.transaction_date = transactionDate;

    if (description !== undefined || proofUrl !== undefined) {
      const parsed = parseExpenseRecord(existing);
      const nextDescription = description !== undefined ? description : parsed.description;
      const nextProof = proofUrl !== undefined ? proofUrl : parsed.proof;
      updateData.description = encodeExpenseProof(nextDescription, nextProof);
    }

    const { data, error } = await S(req, 'finances')
      .update(updateData)
      .eq('id', expenseId)
      .select('id, display_id, category, description, amount, transaction_date, status, created_at')
      .single();

    if (error) throw error;

    await auditLog(supabase, {
      propertyId: req.propertyId,
      userId: req.user?.id,
      action: status === 'approved' ? 'expense.approved' : status === 'rejected' ? 'expense.rejected' : 'expense.updated',
      entityType: 'finance',
      entityId: expenseId,
      oldValues: { status: existing.status, amount: existing.amount },
      newValues: updateData,
      req,
    });

    res.json(parseExpenseRecord(data));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/financial/cogs/profiles', async (req, res) => {
  try {
    const { data, error } = await S(req, 'villa_cost_profiles')
      .select(`
        id,
        villa_id,
        fixed_stay_cost,
        cost_per_night,
        created_at,
        updated_at,
        villas (id, name)
      `)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    res.json((data || []).map(mapCostProfileRow));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/financial/cogs/profiles', async (req, res) => {
  const { villaId, fixedStayCost, costPerNight } = req.body;

  if (!villaId) {
    return res.status(400).json({ error: 'Villa is required.' });
  }

  try {
    const { data: existing } = await S(req, 'villa_cost_profiles')
      .select('id')
      .eq('villa_id', villaId)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'A cost profile already exists for this villa. Edit the existing profile instead.' });
    }

    const now = new Date().toISOString();
    const { data, error } = await INS(req, 'villa_cost_profiles', [{
        villa_id: villaId,
        fixed_stay_cost: Math.max(Number(fixedStayCost) || 0, 0),
        cost_per_night: Math.max(Number(costPerNight) || 0, 0),
        created_at: now,
        updated_at: now,
      }]).select(`
        id,
        villa_id,
        fixed_stay_cost,
        cost_per_night,
        created_at,
        updated_at,
        villas (id, name)
      `)
      .single();

    if (error) throw error;
    res.status(201).json(mapCostProfileRow(data));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/financial/cogs/profiles/:profileId', async (req, res) => {
  const { profileId } = req.params;
  const { fixedStayCost, costPerNight } = req.body;

  try {
    const updateData = { updated_at: new Date().toISOString() };
    if (fixedStayCost !== undefined) updateData.fixed_stay_cost = Math.max(Number(fixedStayCost) || 0, 0);
    if (costPerNight !== undefined) updateData.cost_per_night = Math.max(Number(costPerNight) || 0, 0);

    const { data, error } = await S(req, 'villa_cost_profiles')
      .update(updateData)
      .eq('id', profileId)
      .select(`
        id,
        villa_id,
        fixed_stay_cost,
        cost_per_night,
        created_at,
        updated_at,
        villas (id, name)
      `)
      .single();

    if (error) throw error;
    res.json(mapCostProfileRow(data));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/financial/cogs/profiles/:profileId', async (req, res) => {
  const { profileId } = req.params;

  try {
    const { error } = await S(req, 'villa_cost_profiles')
      .delete()
      .eq('id', profileId);

    if (error) throw error;
    res.json({ message: 'Cost profile deleted.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/financial/profitability', async (req, res) => {
  try {
    const { data, error } = await S(req, 'reservation_profitability')
      .select(`
        id,
        booking_id,
        villa_id,
        revenue,
        room_revenue,
        addon_revenue,
        fb_revenue,
        cogs,
        gross_profit,
        fixed_stay_cost_snapshot,
        cost_per_night_snapshot,
        nights,
        calculated_at,
        villas (id, name),
        bookings (check_in_date, check_out_date, status)
      `)
      .order('calculated_at', { ascending: false });

    if (error) throw error;
    res.json((data || []).map(mapProfitabilityRow));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/financial/profitability/backfill', async (req, res) => {
  try {
    const { data: bookings, error } = await S(req, 'bookings')
      .select('id')
      .not('status', 'eq', 'cancelled');

    if (error) throw error;

    let updated = 0;
    for (const b of bookings || []) {
      try {
        await upsertReservationProfitability(b.id, req.propertyId);
        updated += 1;
      } catch (err) {
        console.error(`Backfill ${b.id}:`, err.message);
      }
    }

    res.json({ message: `Profitability recalculated for ${updated} reservations.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bookings/:bookingId/invoice/pdf', async (req, res) => {
  const { bookingId } = req.params;

  try {
    const summary = await buildFinancialSummary(bookingId, req.propertyId);
    const displayId = summary.displayId;
    const filename = `Booking Confirmation - ${displayId}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');

    await streamBookingConfirmationPdf(summary, res);
  } catch (error) {
    console.error('PDF generation error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Failed to generate booking confirmation PDF' });
    } else {
      res.end();
    }
  }
});

app.get('/api/bookings/:bookingId/invoice', async (req, res) => {
  const { bookingId } = req.params;

  try {
    const summary = await buildFinancialSummary(bookingId, req.propertyId);
    const displayId = summary.displayId;

    const booking = summary.booking;
    const villaBreakfast = (booking.booking_villas || []).reduce(
      (sum, bv) => sum + (bv.villas?.base_breakfast || 0),
      0
    );
    const addonBreakfast = (booking.booking_addons || []).reduce(
      (sum, ba) => sum + ((ba.addons?.base_breakfast || 0) * (ba.quantity || 1)),
      0
    );
    const adultsMatch = booking.notes?.match(/Adults:\s*(\d+)/);
    const childrenMatch = booking.notes?.match(/Children:\s*(\d+)/);
    const parsedAdults = adultsMatch ? parseInt(adultsMatch[1], 10) : 0;
    const parsedChildren = childrenMatch ? parseInt(childrenMatch[1], 10) : 0;
    const totalGuests = booking.total_guests ?? (
      (parsedAdults || parsedChildren) ? parsedAdults + parsedChildren : null
    );

    res.json({
      invoiceNumber: displayId,
      displayId,
      guestName: booking.guests?.full_name || 'Guest',
      checkIn: booking.check_in_date,
      checkOut: booking.check_out_date,
      villaNames: summary.villaNames,
      totalGuests,
      totalBreakfast: villaBreakfast + addonBreakfast,
      lineItems: summary.lineItems,
      accommodationLines: summary.accommodationLines,
      addonLines: summary.addonLines,
      menuLines: summary.menuLines,
      discountLines: summary.discountLines,
      accommodation: summary.accommodation,
      extraBeds: summary.extraBeds,
      extraBreakfast: summary.extraBreakfast,
      menuItems: summary.menuItems,
      subtotalBeforeDiscount: summary.subtotalBeforeDiscount,
      discountAmount: summary.discountAmount,
      discount: summary.discount,
      discountCode: summary.discountCode,
      applicationRule: summary.applicationRule,
      total: summary.total,
      amountPaid: summary.amountPaid,
      balanceDue: summary.balanceDue,
      paymentStatus: summary.paymentStatus,
      generatedAt: new Date().toLocaleString('en-GB'),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bookings/:bookingId/payments', async (req, res) => {
  const { bookingId } = req.params;
  const {
    amount,
    paymentMethod = 'transfer',
    paymentType = 'general',
    proofFileName,
    notes,
  } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid payment amount.' });
  }

  try {
    const summary = await buildFinancialSummary(bookingId, req.propertyId);
    const booking = summary.booking;

    if (paymentType === 'final' && !summary.hasPartialPayment) {
      return res.status(400).json({ error: 'Record a partial payment before submitting the final payment.' });
    }
    if (paymentType === 'partial' && summary.paymentStatus !== 'pending') {
      return res.status(400).json({ error: 'Partial payment has already been recorded.' });
    }

    const newAmountPaid = Number(booking.amount_paid) + Number(amount);
    const grandTotal = summary.total;

    let newPaymentStatus = 'pending';
    if (paymentType === 'partial') {
      newPaymentStatus = 'partial';
    } else if (paymentType === 'final') {
      if (newAmountPaid >= grandTotal) {
        newPaymentStatus = 'complete';
      } else {
        return res.status(400).json({
          error: `Final payment insufficient. Balance remaining: Rp ${Math.max(grandTotal - newAmountPaid, 0).toLocaleString()}`,
        });
      }
    } else {
      if (newAmountPaid > 0 && newAmountPaid < grandTotal) newPaymentStatus = 'partial';
      else if (newAmountPaid >= grandTotal) newPaymentStatus = 'complete';
    }

    const descriptiveAttachmentLabel = proofFileName ? `Proof: ${proofFileName}` : 'No document uploaded';

    await INS(req, 'finances', [{
      booking_id: bookingId,
      type: 'income',
      amount: Number(amount),
      category: paymentType === 'final' ? 'final_payment' : 'partial_payment',
      transaction_date: new Date().toISOString().split('T')[0],
      description: `${paymentType === 'final' ? 'Final' : 'Partial'} payment via ${paymentMethod}. ${descriptiveAttachmentLabel}${notes ? `. ${notes}` : ''}`,
      status: 'approved',
    }]);

    const { data: updatedBooking, error: updateError } = await S(req, 'bookings')
      .update({
        amount_paid: newAmountPaid,
        payment_status: newPaymentStatus,
      })
      .eq('id', bookingId)
      .select()
      .single();

    if (updateError) throw updateError;

    if (newPaymentStatus === 'complete' && updatedBooking.status === 'checked_out') {
      await S(req, 'bookings').update({ status: 'completed' }).eq('id', bookingId);
    }

    await auditLog(supabase, {
      propertyId: req.propertyId,
      userId: req.user?.id,
      action: 'payment.recorded',
      entityType: 'booking',
      entityId: bookingId,
      oldValues: { amount_paid: booking.amount_paid, payment_status: booking.payment_status },
      newValues: { amount_paid: newAmountPaid, payment_status: newPaymentStatus },
      req,
    });

    res.json({
      message: 'Payment recorded successfully',
      amountPaid: newAmountPaid,
      paymentStatus: newPaymentStatus,
      balanceDue: Math.max(grandTotal - newAmountPaid, 0),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/bookings/:bookingId/payment-status', async (req, res) => {
  const { bookingId } = req.params;
  const { paymentStatus, amountPaid } = req.body;

  try {
    const updateData = { payment_status: paymentStatus };
    if (amountPaid !== undefined) updateData.amount_paid = amountPaid;

    const { data: updatedBooking, error: updateError } = await S(req, 'bookings')
      .update(updateData)
      .eq('id', bookingId)
      .select()
      .single();

    if (updateError) throw updateError;

    if (paymentStatus === 'complete' && updatedBooking.status === 'checked_out') {
      await S(req, 'bookings').update({ status: 'completed' }).eq('id', bookingId);
    }

    res.json(updatedBooking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/bookings/:bookingId/check-in', async (req, res) => {
  const { bookingId } = req.params;

  try {
    const { data: updatedBooking, error: updateError } = await S(req, 'bookings')
      .update({ status: 'checked_in' })
      .eq('id', bookingId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({
      message: 'Guest checked in successfully',
      booking: updatedBooking
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/bookings/:bookingId/check-out', async (req, res) => {
  const { bookingId } = req.params;

  try {
    const { data: booking, error: bookingError } = await S(req, 'bookings')
      .select('payment_status, check_out_date, status')
      .eq('id', bookingId)
      .single();

    if (bookingError) throw bookingError;

    if (booking.status !== 'checked_in') {
      return res.status(400).json({ error: 'Guest must be checked in before check-out.' });
    }

    const today = todayISO();
    if (booking.check_out_date !== today) {
      return res.status(400).json({ error: 'Check-out is only available on the scheduled check-out date.' });
    }

    const { data: updatedBooking, error: updateError } = await S(req, 'bookings')
      .update({ status: 'checked_out' })
      .eq('id', bookingId)
      .select()
      .single();

    if (updateError) throw updateError;

    if (booking.payment_status === 'complete') {
      await S(req, 'bookings').update({ status: 'completed' }).eq('id', bookingId);
    }

    try {
      await upsertReservationProfitability(bookingId, req.propertyId);
    } catch (profitErr) {
      console.error('Profitability snapshot failed:', profitErr.message);
    }

    res.json({
      message: 'Guest checked out successfully',
      booking: updatedBooking
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 📊  DASHBOARD
// ─────────────────────────────────────────────────────────────

app.get('/api/dashboard', async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_dashboard_kpis', {
      p_property_id: req.propertyId,
    });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 👤 USERS
// ─────────────────────────────────────────────────────────────

const USER_ROLES = ['staff', 'owner', 'admin', 'manager', 'receptionist', 'housekeeping'];
const USER_STATUSES = ['active', 'deactivated'];

function mapUserRow(row, fallbackIndex = null) {
  const displayId = row.display_id
    || (fallbackIndex != null ? `UID-${String(fallbackIndex).padStart(4, '0')}` : null);

  return {
    id: row.id,
    display_id: displayId,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status || 'active',
    created_at: row.created_at,
  };
}

async function generateNextUserDisplayId(propertyId) {
  const { data, error } = await scopeQ(propertyId, 'users')
    .select('display_id')
    .order('created_at', { ascending: true });

  if (error) throw error;

  let maxNum = 0;
  for (const row of data || []) {
    const match = row.display_id?.match(/^UID-(\d+)$/i);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }

  return `UID-${String(maxNum + 1).padStart(4, '0')}`;
}

app.get('/api/users', async (req, res) => {
  try {
    const { data, error } = await S(req, 'users')
      .select('id, email, name, role, created_at, display_id, status')
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json((data || []).map((row, index) => mapUserRow(row, index + 1)));
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
    const { data: existing, error: existingError } = await S(req, 'users')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }

    const display_id = await generateNextUserDisplayId(req.propertyId);

    const { data, error } = await INS(req, 'users', [{
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password_hash: hashPassword(password),
        role,
        display_id,
        status: 'active',
      }]).select('id, email, name, role, created_at, display_id, status')
      .single();

    if (error) throw error;
    res.status(201).json(mapUserRow(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
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
    res.status(400).json({ error: error.message });
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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));