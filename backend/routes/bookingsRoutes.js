import { parsePagination, fetchCursorPage, paginatedJson } from '../lib/pagination.js';
import { streamBookingConfirmationPdf } from '../lib/pdfHelpers.js';
import { buildDiscountBookingContext, isDiscountEligible } from '../lib/discountUtils.js';
import {
  calculateDiscountAmount,
  computeBookingCharges,
  resolveDiscountForBooking,
  fetchPricingHolidays,
  buildBookingPropertyRows,
  buildBookingAddonRows,
  fetchDiscountById,
} from '../lib/bookingOperations.js';
import { ORDER_STATUSES } from '../lib/bookingFinancialSummary.js';
import { stayNights, todayISO } from '../lib/stayUtils.js';
import { auditLog } from '../lib/auditLog.js';
import { encodeExpenseProof } from '../lib/financialMappers.js';
import {
  assertBookingInTenant,
  findPropertyBookingConflicts,
  deleteBookingChildren,
  deleteBookingCascade,
} from '../lib/tenant/bookingScope.js';
import { generateBookingToken } from '../lib/bookingToken.js';
import {
  PAYMENT_PROOFS_BUCKET,
  buildPaymentProofStoragePath,
} from '../lib/storagePaths.js';

export function registerBookingsRoutes(app, ctx) {
  const {
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
  } = ctx;

app.get('/api/bookings', async (req, res) => {
  try {
    const { limit, cursor } = parsePagination(req.query);
    const bookingSelect = `
        id, display_id, status, payment_status, check_in_date, check_out_date,
        total_price, amount_paid, total_guests, notes, created_at, discount_id, discount_amount,
        discounts (id, code, name, type, value, scope, status, application_rule, property_ids, max_discount_amount, min_nights, min_booking_amount),
        guests (full_name, phone_number),
        booking_properties (
          property_id, rate_per_night, nights,
          properties (id, name, base_rate_per_night, weekend_rate_per_night, holiday_rate_per_night, base_breakfast, display_id)
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
      const propertyBreakfast = b.booking_properties?.reduce((sum, bv) => sum + (bv.properties?.base_breakfast || 0), 0) || 0;
      const addonBreakfast = b.booking_addons?.reduce((sum, ba) => sum + ((ba.addons?.base_breakfast || 0) * (ba.quantity || 1)), 0) || 0;
      const totalBreakfast = propertyBreakfast + addonBreakfast;

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
        property_names: b.booking_properties?.map((bv) => bv.properties?.name).filter(Boolean).join(', ') || 'No Properties Assigned',
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
    property_ids,
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
    const conflictingBookings = await findPropertyBookingConflicts(supabase, {
      propertyIds: property_ids,
      checkIn: check_in_date,
      checkOut: check_out_date,
      tenantId: req.tenantId,
    });
    if (conflictingBookings.length > 0) {
      return res.status(409).json({ error: 'One or more properties are already reserved.' });
    }

    const blockConflicts = await findBlockConflicts(property_ids, check_in_date, check_out_date, req.tenantId);
    if (blockConflicts.length > 0) {
      return res.status(409).json({
        error: 'One or more properties are unavailable for these dates due to a scheduled block.',
      });
    }

    const charges = await computeBookingCharges(scopeQ, {
      property_ids,
      selected_addons: selected_addons || [],
      check_in_date,
      check_out_date,
      tenantId: req.tenantId,
    });

    const discountContext = buildDiscountBookingContext({
      checkInDate: check_in_date,
      checkOutDate: check_out_date,
      nights: stayNights(check_in_date, check_out_date),
      bookingAmount: charges.accommodationTotal,
      propertyIds: property_ids,
      guestId: guest_id,
    });

    const { discount, discount_id: resolvedDiscountId } = await resolveDiscountForBooking(scopeQ, {
      apply_discount: !!apply_discount,
      discount_id,
      context: discountContext,
      charges,
      tenantId: req.tenantId,
    });

    let discountAmount = 0;
    if (discount) {
      const result = calculateDiscountAmount(discount, {
        ...discountContext,
        propertyLines: charges.propertyLines,
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

    const holidays = await fetchPricingHolidays(scopeQ, req.tenantId);
    const { data: propertyCatalog, error: propertyFetchError } = await scopeQ(req.tenantId, 'properties')
      .select('id, base_rate_per_night, weekend_rate_per_night, holiday_rate_per_night')
      .in('id', property_ids);
    if (propertyFetchError) throw propertyFetchError;

    const bridgeRows = buildBookingPropertyRows(
      bookingData.id,
      property_ids,
      propertyCatalog,
      check_in_date,
      check_out_date,
      holidays
    );
    const { error: bridgeError } = await supabase.from('booking_properties').insert(bridgeRows);
    if (bridgeError) throw bridgeError;

    if (selected_addons && selected_addons.length > 0) {
      const addonIds = selected_addons.map((a) => a.addon_id);
      const { data: addonCatalog, error: addonFetchError } = await scopeQ(req.tenantId, 'addons')
        .select('id, price, is_per_night')
        .in('id', addonIds);
      if (addonFetchError) throw addonFetchError;

      const addonRows = buildBookingAddonRows(bookingData.id, selected_addons, addonCatalog, nights);
      const { error: addonError } = await supabase.from('booking_addons').insert(addonRows);
      if (addonError) {
        await deleteBookingChildren(supabase, bookingData.id);
        await scopeQ(req.tenantId, 'bookings').delete().eq('id', bookingData.id);
        throw addonError;
      }
    }

    try {
      await upsertReservationProfitability(bookingData.id, req.tenantId);
      invalidateSummary(bookingData.id, req.tenantId);
    } catch (profitErr) {
      console.error('Profitability snapshot failed:', profitErr.message);
    }

    res.status(201).json({ ...bookingData, manage_token: manageToken });
  } catch (error) {
    if (createdBookingId) {
      await deleteBookingCascade(supabase, scopeQ, req.tenantId, createdBookingId);
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
        await upsertReservationProfitability(id, req.tenantId);
        invalidateSummary(id, req.tenantId);
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
    property_ids,
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

    if (Array.isArray(property_ids) && property_ids.length > 0) {
      const conflictingBookings = await findPropertyBookingConflicts(supabase, {
        propertyIds: property_ids,
        checkIn: nextCheckIn,
        checkOut: nextCheckOut,
        tenantId: req.tenantId,
        excludeBookingId: id,
      });
      if (conflictingBookings.length > 0) {
        return res.status(409).json({ error: 'One or more properties are already reserved for these dates.' });
      }

      const blockConflicts = await findBlockConflicts(property_ids, nextCheckIn, nextCheckOut, req.tenantId);
      if (blockConflicts.length > 0) {
        return res.status(409).json({
          error: 'One or more properties are unavailable for these dates due to a scheduled block.',
        });
      }
    }

    const updateData = {};
    if (check_in_date !== undefined) updateData.check_in_date = check_in_date;
    if (check_out_date !== undefined) updateData.check_out_date = check_out_date;
    if (total_guests !== undefined) updateData.total_guests = total_guests;
    if (notes !== undefined) updateData.notes = notes;

    const shouldRecalculate =
      Array.isArray(property_ids) ||
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

      let resolvedPropertyIds = property_ids;
      if (!Array.isArray(resolvedPropertyIds)) {
        const { data: currentProperties, error: propertyFetchError } = await supabase
          .from('booking_properties')
          .select('property_id')
          .eq('booking_id', id);
        if (propertyFetchError) throw propertyFetchError;
        resolvedPropertyIds = (currentProperties || []).map((row) => row.property_id);
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

      const charges = await computeBookingCharges(scopeQ, {
        property_ids: resolvedPropertyIds,
        selected_addons: resolvedAddons,
        check_in_date: nextCheckIn,
        check_out_date: nextCheckOut,
        tenantId: req.tenantId,
      });

      const discountContext = buildDiscountBookingContext({
        checkInDate: nextCheckIn,
        checkOutDate: nextCheckOut,
        nights: stayNights(nextCheckIn, nextCheckOut),
        bookingAmount: charges.accommodationTotal,
        propertyIds: resolvedPropertyIds,
        guestId: bookingMeta.guest_id,
      });

      const { discount } = await resolveDiscountForBooking(scopeQ, {
        apply_discount: apply_discount === true,
        discount_id: apply_discount === true ? discount_id : undefined,
        context: discountContext,
        charges,
        tenantId: req.tenantId,
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
            discountToApply = await fetchDiscountById(scopeQ, currentBooking.discount_id, req.tenantId);
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
            propertyLines: charges.propertyLines,
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

      if (Array.isArray(property_ids)) {
        await supabase.from('booking_properties').delete().eq('booking_id', id);
        if (property_ids.length > 0) {
          const holidays = await fetchPricingHolidays(scopeQ, req.tenantId);
          const { data: propertyCatalog, error: propertyCatalogError } = await scopeQ(req.tenantId, 'properties')
            .select('id, base_rate_per_night, weekend_rate_per_night, holiday_rate_per_night')
            .in('id', property_ids);
          if (propertyCatalogError) throw propertyCatalogError;

          const bridgeRows = buildBookingPropertyRows(
            id,
            property_ids,
            propertyCatalog,
            nextCheckIn,
            nextCheckOut,
            holidays
          );
          const { error: bridgeError } = await supabase.from('booking_properties').insert(bridgeRows);
          if (bridgeError) throw bridgeError;
        }
      } else if (check_in_date !== undefined || check_out_date !== undefined) {
        const { data: currentBridge, error: bridgeFetchError } = await supabase
          .from('booking_properties')
          .select('id, property_id, rate_per_night')
          .eq('booking_id', id);
        if (bridgeFetchError) throw bridgeFetchError;

        if (currentBridge?.length) {
          await Promise.all(
            currentBridge.map((row) =>
              supabase
                .from('booking_properties')
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
          const { data: addonCatalog, error: addonFetchError } = await scopeQ(req.tenantId, 'addons')
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
        discounts (id, code, name, type, value, scope, status, application_rule, property_ids, max_discount_amount, min_nights, min_booking_amount),
        guests (full_name, phone_number),
        booking_properties (
          property_id,
          rate_per_night,
          nights,
          properties (id, name, base_rate_per_night, display_id)
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
      await upsertReservationProfitability(id, req.tenantId);
      invalidateSummary(id, req.tenantId);
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
    invalidateSummary(id, req.tenantId);

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/bookings/:bookingId/orders', async (req, res) => {
  const { bookingId } = req.params;

  try {
    await assertBookingInTenant(supabase, scopeQ, req.tenantId, bookingId);
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
    await assertBookingInTenant(supabase, scopeQ, req.tenantId, bookingId);
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

    try {
      await upsertReservationProfitability(bookingId, req.tenantId);
      invalidateSummary(bookingId, req.tenantId);
    } catch (profitErr) {
      console.error('Profitability snapshot failed:', profitErr.message);
    }

    res.status(201).json({ ...order, items: orderItemRows });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/bookings/:bookingId/food-orders', async (req, res) => {
  const { bookingId } = req.params;

  try {
    await assertBookingInTenant(supabase, scopeQ, req.tenantId, bookingId);
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
    await assertBookingInTenant(supabase, scopeQ, req.tenantId, bookingId);
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
      await upsertReservationProfitability(bookingId, req.tenantId);
      invalidateSummary(bookingId, req.tenantId);
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

    if (data?.booking_id) {
      invalidateSummary(data.booking_id, req.tenantId);
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post('/api/bookings/:bookingId/upload-receipt', async (req, res) => {
  const { bookingId } = req.params;
  const { fileData, fileName, fileType, paymentType } = req.body;

  if (!fileData || !fileName) {
    return res.status(400).json({ error: 'fileData and fileName are required.' });
  }

  try {
    const { error: bookingError } = await S(req, 'bookings')
      .select('id')
      .eq('id', bookingId)
      .single();

    if (bookingError) throw bookingError;

    const storagePath = buildPaymentProofStoragePath({
      tenantId: req.tenantId,
      bookingId,
      paymentType,
      fileName,
    });

    const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const { error: uploadError } = await supabase.storage
      .from(PAYMENT_PROOFS_BUCKET)
      .upload(storagePath, buffer, {
        contentType: fileType || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from(PAYMENT_PROOFS_BUCKET)
      .getPublicUrl(storagePath);

    res.json({
      message: 'Receipt uploaded successfully',
      path: storagePath,
      publicUrl: urlData?.publicUrl || null,
      fileName: storagePath.split('/').pop(),
    });
  } catch (error) {
    console.error('Receipt upload error:', error);
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/bookings/:bookingId/invoice/pdf', async (req, res) => {
  const { bookingId } = req.params;

  try {
    const summary = await buildFinancialSummary(bookingId, req.tenantId);
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
    const summary = await buildFinancialSummary(bookingId, req.tenantId);
    const displayId = summary.displayId;

    const booking = summary.booking;
    const propertyBreakfast = (booking.booking_properties || []).reduce(
      (sum, bv) => sum + (bv.properties?.base_breakfast || 0),
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
      propertyNames: summary.propertyNames,
      totalGuests,
      totalBreakfast: propertyBreakfast + addonBreakfast,
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
    receiptUrl,
    notes,
  } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid payment amount.' });
  }

  try {
    const summary = await buildFinancialSummary(bookingId, req.tenantId);
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

    const paymentLabel = `${paymentType === 'final' ? 'Final' : 'Partial'} payment via ${paymentMethod}`;
    const proofLabel = proofFileName ? `Proof: ${proofFileName}` : null;
    const description = encodeExpenseProof(
      [paymentLabel, proofLabel, notes].filter(Boolean).join('. '),
      receiptUrl || null,
    );

    await INS(req, 'finances', [{
      booking_id: bookingId,
      type: 'income',
      amount: Number(amount),
      category: paymentType === 'final' ? 'final_payment' : 'partial_payment',
      transaction_date: new Date().toISOString().split('T')[0],
      description,
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
      tenantId: req.tenantId,
      userId: req.user?.id,
      action: 'payment.recorded',
      entityType: 'booking',
      entityId: bookingId,
      oldValues: { amount_paid: booking.amount_paid, payment_status: booking.payment_status },
      newValues: { amount_paid: newAmountPaid, payment_status: newPaymentStatus },
      req,
    });

    invalidateSummary(bookingId, req.tenantId);

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

    invalidateSummary(bookingId, req.tenantId);

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
      await upsertReservationProfitability(bookingId, req.tenantId);
      invalidateSummary(bookingId, req.tenantId);
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
}
