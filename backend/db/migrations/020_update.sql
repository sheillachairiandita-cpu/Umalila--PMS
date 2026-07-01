-- Drop the old policies
DROP POLICY IF EXISTS "objects_tenant_insert" ON storage.objects;
DROP POLICY IF EXISTS "objects_tenant_update" ON storage.objects;
DROP POLICY IF EXISTS "objects_tenant_delete" ON storage.objects;
DROP POLICY IF EXISTS "objects_tenant_select" ON storage.objects;

-- Recreate with your real bucket name
CREATE POLICY "objects_tenant_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'  -- ← change this
    AND (storage.foldername(name))[1] = auth_tenant_id()::text
  );

CREATE POLICY "objects_tenant_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth_tenant_id()::text
  );

CREATE POLICY "objects_tenant_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth_tenant_id()::text
  );

CREATE POLICY "objects_tenant_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth_tenant_id()::text
  );

  -- Core booking queries
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_status 
  ON bookings(tenant_id, status);

CREATE INDEX idx_bookings_tenant_dates 
  ON bookings(tenant_id, check_in_date, check_out_date);

CREATE INDEX idx_bookings_tenant_guest 
  ON bookings(tenant_id, guest_id);

-- Financials
CREATE INDEX idx_finances_tenant_category 
  ON finances(tenant_id, category, type);

CREATE INDEX idx_finances_tenant_booking 
  ON finances(tenant_id, booking_id);

-- F&B
CREATE INDEX idx_orders_tenant_booking 
  ON orders(tenant_id, booking_id, status);

CREATE INDEX idx_order_items_tenant_order 
  ON order_items(tenant_id, order_id);

-- Guests
CREATE INDEX idx_guests_tenant_search 
  ON guests(tenant_id, full_name, email);

-- Properties
CREATE INDEX idx_properties_tenant 
  ON properties(tenant_id, id);

-- Property date blocks (availability checks hit this hard)
CREATE INDEX idx_property_date_blocks_tenant_property_dates 
  ON property_date_blocks(tenant_id, property_id, start_date, end_date);

-- Audit log (append-heavy, index for reads)
CREATE INDEX idx_audit_log_tenant_created 
  ON audit_log(tenant_id, created_at DESC);