-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role USER-DEFINED NOT NULL DEFAULT 'staff'::user_role,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.villas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  capacity integer NOT NULL,
  base_rate_per_night numeric NOT NULL CHECK (base_rate_per_night >= 0::numeric),
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  base_breakfast smallint NOT NULL DEFAULT '0'::smallint CHECK (base_breakfast >= 0),
  display_id text UNIQUE,
  CONSTRAINT villas_pkey PRIMARY KEY (id)
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
  villa_id uuid,
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
  CONSTRAINT bookings_villa_id_fkey FOREIGN KEY (villa_id) REFERENCES public.villas(id),
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
  CONSTRAINT finances_pkey PRIMARY KEY (id),
  CONSTRAINT finances_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id)
);
CREATE TABLE public.addons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price_per_night numeric NOT NULL,
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
  status text NOT NULL DEFAULT 'pending'::order_status CHECK (status = ANY (ARRAY['open'::text, 'served'::text, 'billed'::text])),
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
  custom_rate_per_night numeric,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
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
  CONSTRAINT discounts_pkey PRIMARY KEY (id),
  CONSTRAINT discounts_villa_id_fkey FOREIGN KEY (villa_id) REFERENCES public.villas(id)
);