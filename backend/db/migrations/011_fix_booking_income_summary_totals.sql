-- Add computed total columns to booking_income_summary (used by /api/financial/income)

DROP VIEW IF EXISTS public.booking_income_summary;

CREATE VIEW public.booking_income_summary AS
SELECT
  base.*,
  GREATEST(base.subtotal_before_discount - COALESCE(base.discount_amount, 0), 0) AS total,
  GREATEST(
    GREATEST(base.subtotal_before_discount - COALESCE(base.discount_amount, 0), 0)
      - COALESCE(base.amount_paid, 0),
    0
  ) AS balance_due
FROM (
  SELECT
    b.id AS booking_id,
    b.tenant_id,
    b.display_id,
    b.check_in_date,
    b.check_out_date,
    b.payment_status,
    b.status AS booking_status,
    b.amount_paid,
    b.total_price,
    b.discount_amount,
    b.created_at,
    g.full_name AS guest_name,
    d.code AS discount_code,
    COALESCE((
      SELECT SUM(bv.rate_per_night * bv.nights)
      FROM booking_properties bv WHERE bv.booking_id = b.id
    ), 0) AS total_accommodation,
    COALESCE((
      SELECT SUM(ba.subtotal) FROM booking_addons ba WHERE ba.booking_id = b.id
    ), 0) AS total_addons,
    COALESCE((
      SELECT SUM(o.total_amount) FROM orders o
      WHERE o.booking_id = b.id AND o.status IN ('open', 'served', 'billed')
    ), 0) AS total_menu_items,
    COALESCE((
      SELECT SUM(bv.rate_per_night * bv.nights)
      FROM booking_properties bv WHERE bv.booking_id = b.id
    ), 0)
    + COALESCE((
      SELECT SUM(ba.subtotal) FROM booking_addons ba WHERE ba.booking_id = b.id
    ), 0)
    + COALESCE((
      SELECT SUM(o.total_amount) FROM orders o
      WHERE o.booking_id = b.id AND o.status IN ('open', 'served', 'billed')
    ), 0) AS subtotal_before_discount
  FROM bookings b
  LEFT JOIN guests g ON g.id = b.guest_id
  LEFT JOIN discounts d ON d.id = b.discount_id
  WHERE b.status != 'cancelled'
) base;
