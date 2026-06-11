-- Villa date blocks for calendar availability holds (maintenance, owner stay, etc.)
CREATE TABLE IF NOT EXISTS public.villa_date_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  villa_id uuid NOT NULL REFERENCES public.villas(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT villa_date_blocks_dates_check CHECK (end_date >= start_date),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_villa_date_blocks_villa_id ON public.villa_date_blocks(villa_id);
CREATE INDEX IF NOT EXISTS idx_villa_date_blocks_dates ON public.villa_date_blocks(start_date, end_date);
