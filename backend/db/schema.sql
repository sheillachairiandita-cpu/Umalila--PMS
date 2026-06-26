-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.users (display_id text, password_hash text NOT NULL, name text NOT NULL, email text NOT NULL, status text DEFAULT 'active'::text NOT NULL, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()), role USER-DEFINED DEFAULT 'staff'::user_role NOT NULL, id uuid DEFAULT gen_random_uuid() NOT NULL);
CREATE TABLE public.villas (description text, id uuid DEFAULT gen_random_uuid() NOT NULL, base_breakfast smallint DEFAULT '0'::smallint NOT NULL, display_id text, weekend_rate_per_night numeric, holiday_rate_per_night numeric, base_rate_per_night numeric NOT NULL, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()), name text NOT NULL, capacity integer NOT NULL);
CREATE TABLE public.guests (email text, full_name text NOT NULL, display_id text, id_card_number text, phone_number text NOT NULL, id uuid DEFAULT gen_random_uuid() NOT NULL, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()));
CREATE TABLE public.bookings (discount_amount numeric DEFAULT 0.00, display_id text, payment_status text DEFAULT 'pending'::text NOT NULL, notes text, id uuid DEFAULT gen_random_uuid() NOT NULL, guest_id uuid, check_in_date date NOT NULL, total_guests integer NOT NULL, check_out_date date NOT NULL, total_price numeric NOT NULL, status USER-DEFINED DEFAULT 'pending'::booking_status NOT NULL, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()), amount_paid numeric DEFAULT 0.00, discount_id uuid);
CREATE TABLE public.finances (order_id uuid, description text, category text NOT NULL, type text NOT NULL, amount numeric NOT NULL, booking_id uuid, transaction_date date DEFAULT CURRENT_DATE NOT NULL, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()), display_id text, status text DEFAULT 'approved'::text NOT NULL, id uuid DEFAULT gen_random_uuid() NOT NULL);
CREATE TABLE public.addons (created_at timestamp with time zone DEFAULT timezone('utc'::text, now()), base_breakfast smallint DEFAULT '0'::smallint NOT NULL, price numeric DEFAULT 0.00 NOT NULL, is_per_night boolean DEFAULT false NOT NULL, name text NOT NULL, id uuid DEFAULT gen_random_uuid() NOT NULL);
CREATE TABLE public.booking_addons (addon_id uuid, booking_id uuid, id uuid DEFAULT gen_random_uuid() NOT NULL, subtotal numeric, unit_price numeric DEFAULT 0.00 NOT NULL, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()), quantity integer DEFAULT 1 NOT NULL);
CREATE TABLE public.menu_items (category USER-DEFINED DEFAULT 'food'::menu_category NOT NULL, id uuid DEFAULT gen_random_uuid() NOT NULL, price numeric NOT NULL, is_available boolean DEFAULT true NOT NULL, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()), name text NOT NULL);
CREATE TABLE public.orders (created_at timestamp with time zone DEFAULT timezone('utc'::text, now()), id uuid DEFAULT gen_random_uuid() NOT NULL, staff_note text, booking_id uuid, total_amount numeric DEFAULT 0 NOT NULL, status text DEFAULT 'pending'::order_status NOT NULL);
CREATE TABLE public.order_items (menu_item_id uuid, order_id uuid, id uuid DEFAULT gen_random_uuid() NOT NULL, unit_cost numeric DEFAULT 0.00 NOT NULL, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()), subtotal numeric, unit_price numeric NOT NULL, quantity integer DEFAULT 1 NOT NULL);
CREATE TABLE public.booking_villas (rate_per_night numeric NOT NULL, id uuid DEFAULT gen_random_uuid() NOT NULL, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()), nights integer NOT NULL, booking_id uuid NOT NULL, villa_id uuid NOT NULL);
CREATE TABLE public.discounts (stackable boolean DEFAULT false NOT NULL, id uuid DEFAULT gen_random_uuid() NOT NULL, value numeric NOT NULL, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()), villa_id uuid, max_discount_amount numeric, booking_start_date date, booking_end_date date, stay_start_date date, stay_end_date date, villa_ids jsonb DEFAULT '[]'::jsonb NOT NULL, min_booking_amount numeric, min_nights integer, total_usage_limit integer, per_guest_limit integer, usage_count integer DEFAULT 0 NOT NULL, updated_at timestamp with time zone, priority integer DEFAULT 0 NOT NULL, created_by uuid, updated_by uuid, applicable_villas text DEFAULT 'all'::text NOT NULL, code text NOT NULL, name text NOT NULL, type text NOT NULL, application_rule text DEFAULT 'all_items'::text NOT NULL, scope text NOT NULL, status text DEFAULT 'active'::text NOT NULL, description text);
CREATE TABLE public.villa_date_blocks (start_date date NOT NULL, end_date date NOT NULL, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()), reason text NOT NULL, id uuid DEFAULT gen_random_uuid() NOT NULL, villa_id uuid NOT NULL);
CREATE TABLE public.pricing_holidays (start_date date NOT NULL, id uuid DEFAULT gen_random_uuid() NOT NULL, name text NOT NULL, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()), end_date date NOT NULL);
CREATE TABLE public.reservation_profitability (fb_revenue numeric DEFAULT 0 NOT NULL, room_revenue numeric DEFAULT 0 NOT NULL, calculated_at timestamp with time zone DEFAULT timezone('utc'::text, now()), nights integer DEFAULT 0 NOT NULL, cost_per_night_snapshot numeric DEFAULT 0 NOT NULL, fixed_stay_cost_snapshot numeric DEFAULT 0 NOT NULL, gross_profit numeric DEFAULT 0 NOT NULL, cogs numeric DEFAULT 0 NOT NULL, addon_revenue numeric DEFAULT 0 NOT NULL, revenue numeric DEFAULT 0 NOT NULL, villa_id uuid NOT NULL, booking_id uuid NOT NULL, id uuid DEFAULT gen_random_uuid() NOT NULL);
CREATE TABLE public.villa_cost_profiles (id uuid DEFAULT gen_random_uuid() NOT NULL, villa_id uuid NOT NULL, fixed_stay_cost numeric DEFAULT 0 NOT NULL, cost_per_night numeric DEFAULT 0 NOT NULL, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()), updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()));

CREATE TYPE public.booking_status AS ENUM ('checked_out', 'completed', 'cancelled', 'pending', 'confirmed', 'checked_in');
CREATE TYPE public.finance_category AS ENUM ('salary', 'room_revenue', 'fb_revenue', 'addon_revenue', 'operational_expense', 'maintenance', 'marketing', 'other');
CREATE TYPE public.finance_type AS ENUM ('expense', 'income');
CREATE TYPE public.menu_category AS ENUM ('partner_kitchen', 'other', 'dessert', 'beverage', 'snack', 'food');
CREATE TYPE public.order_status AS ENUM ('billed', 'pending', 'preparing', 'served');
CREATE TYPE public.user_role AS ENUM ('staff', 'owner', 'admin');

-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role USER-DEFINED NOT NULL DEFAULT 'staff'::user_role,
  name text NOT NULL,
  display_id text UNIQUE,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'deactivated'::text])),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.villas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  capacity integer NOT NULL,
  base_rate_per_night numeric NOT NULL CHECK (base_rate_per_night >= 0::numeric),
  weekend_rate_per_night numeric CHECK (weekend_rate_per_night IS NULL OR weekend_rate_per_night >= 0::numeric),
  holiday_rate_per_night numeric CHECK (holiday_rate_per_night IS NULL OR holiday_rate_per_night >= 0::numeric),
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  base_breakfast smallint NOT NULL DEFAULT '0'::smallint CHECK (base_breakfast >= 0),
  display_id text UNIQUE,
  CONSTRAINT villas_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pricing_holidays (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT pricing_holidays_pkey PRIMARY KEY (id),
  CONSTRAINT pricing_holidays_date_range CHECK (end_date >= start_date)
);
CREATE TABLE public.guests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  phone_number text NOT NULL,
  id_card_number text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  display_id text UNIQUE,
  CONSTRAINT guests_pkey PRIMARY KEY (id)
);
CREATE TABLE public.bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  guest_id uuid,
  check_in_date date NOT NULL,
  check_out_date date NOT NULL,
  total_guests integer NOT NULL,
  total_price numeric NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::booking_status,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  amount_paid numeric DEFAULT 0.00,
  payment_status text NOT NULL DEFAULT 'pending'::text CHECK (payment_status = ANY (ARRAY['pending'::text, 'partial'::text, 'complete'::text, 'cancelled'::text])),
  display_id text UNIQUE,
  discount_id uuid,
  discount_amount numeric DEFAULT 0.00 CHECK (discount_amount >= 0::numeric),
  CONSTRAINT bookings_pkey PRIMARY KEY (id),
  CONSTRAINT bookings_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES public.guests(id),
  CONSTRAINT bookings_discount_id_fkey FOREIGN KEY (discount_id) REFERENCES public.discounts(id)
);
CREATE TABLE public.finances (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid,
  type text NOT NULL CHECK (type = ANY (ARRAY['income'::text, 'expense'::text])),
  amount numeric NOT NULL,
  category text NOT NULL,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  order_id uuid,
  status text NOT NULL DEFAULT 'approved'::text,
  display_id text UNIQUE,
  CONSTRAINT finances_pkey PRIMARY KEY (id),
  CONSTRAINT finances_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT finances_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.addons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  base_breakfast smallint NOT NULL DEFAULT '0'::smallint,
  price numeric NOT NULL DEFAULT 0.00 CHECK (price >= 0::numeric),
  is_per_night boolean NOT NULL DEFAULT false,
  CONSTRAINT addons_pkey PRIMARY KEY (id)
);
CREATE TABLE public.booking_addons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid,
  addon_id uuid,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  unit_price numeric NOT NULL DEFAULT 0.00,
  subtotal numeric DEFAULT ((quantity)::numeric * unit_price),
  CONSTRAINT booking_addons_pkey PRIMARY KEY (id),
  CONSTRAINT booking_addons_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT booking_addons_addon_id_fkey FOREIGN KEY (addon_id) REFERENCES public.addons(id)
);
CREATE TABLE public.menu_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category USER-DEFINED NOT NULL DEFAULT 'food'::menu_category,
  price numeric NOT NULL,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT menu_items_pkey PRIMARY KEY (id)
);
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid,
  staff_note text,
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'::order_status CHECK (status = ANY (ARRAY['open'::text, 'served'::text, 'billed'::text, 'cancelled'::text])),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id)
);
CREATE TABLE public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid,
  menu_item_id uuid,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric NOT NULL,
  subtotal numeric DEFAULT ((quantity)::numeric * unit_price),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  unit_cost numeric NOT NULL DEFAULT 0.00,
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id)
);
CREATE TABLE public.booking_villas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  villa_id uuid NOT NULL,
  rate_per_night numeric NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  nights integer NOT NULL CHECK (nights > 0),
  CONSTRAINT booking_villas_pkey PRIMARY KEY (id),
  CONSTRAINT booking_villas_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT booking_villas_villa_id_fkey FOREIGN KEY (villa_id) REFERENCES public.villas(id)
);
CREATE TABLE public.discounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['percentage'::text, 'fixed'::text])),
  value numeric NOT NULL CHECK (value >= 0::numeric),
  scope text NOT NULL CHECK (scope = ANY (ARRAY['global'::text, 'villas'::text, 'addons'::text, 'menu'::text])),
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text])),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  villa_id uuid,
  application_rule text NOT NULL DEFAULT 'all_items'::text CHECK (application_rule = ANY (ARRAY['all_items'::text, 'highest_priced_single'::text, 'lowest_priced_single'::text])),
  description text,
  max_discount_amount numeric,
  booking_start_date date,
  booking_end_date date,
  stay_start_date date,
  stay_end_date date,
  applicable_villas text NOT NULL DEFAULT 'all'::text,
  villa_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  min_booking_amount numeric,
  min_nights integer,
  total_usage_limit integer,
  per_guest_limit integer,
  usage_count integer NOT NULL DEFAULT 0,
  stackable boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 0,
  created_by uuid,
  updated_by uuid,
  updated_at timestamp with time zone,
  CONSTRAINT discounts_pkey PRIMARY KEY (id),
  CONSTRAINT discounts_villa_id_fkey FOREIGN KEY (villa_id) REFERENCES public.villas(id)
);
CREATE TABLE public.villa_date_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  villa_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  created_by uuid,
  CONSTRAINT villa_date_blocks_pkey PRIMARY KEY (id),
  CONSTRAINT villa_date_blocks_villa_id_fkey FOREIGN KEY (villa_id) REFERENCES public.villas(id),
  CONSTRAINT villa_date_blocks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.villa_cost_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  villa_id uuid NOT NULL,
  fixed_stay_cost numeric NOT NULL DEFAULT 0 CHECK (fixed_stay_cost >= 0),
  cost_per_night numeric NOT NULL DEFAULT 0 CHECK (cost_per_night >= 0),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT villa_cost_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT villa_cost_profiles_villa_id_key UNIQUE (villa_id),
  CONSTRAINT villa_cost_profiles_villa_id_fkey FOREIGN KEY (villa_id) REFERENCES public.villas(id) ON DELETE CASCADE
);
CREATE TABLE public.reservation_profitability (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  villa_id uuid NOT NULL,
  revenue numeric NOT NULL DEFAULT 0,
  room_revenue numeric NOT NULL DEFAULT 0,
  addon_revenue numeric NOT NULL DEFAULT 0,
  fb_revenue numeric NOT NULL DEFAULT 0,
  cogs numeric NOT NULL DEFAULT 0,
  gross_profit numeric NOT NULL DEFAULT 0,
  fixed_stay_cost_snapshot numeric NOT NULL DEFAULT 0,
  cost_per_night_snapshot numeric NOT NULL DEFAULT 0,
  nights integer NOT NULL DEFAULT 0,
  calculated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT reservation_profitability_pkey PRIMARY KEY (id),
  CONSTRAINT reservation_profitability_booking_villa_key UNIQUE (booking_id, villa_id),
  CONSTRAINT reservation_profitability_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE,
  CONSTRAINT reservation_profitability_villa_id_fkey FOREIGN KEY (villa_id) REFERENCES public.villas(id) ON DELETE CASCADE
);