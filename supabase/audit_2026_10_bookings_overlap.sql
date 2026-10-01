-- ═══════════════════════════════════════════════════════════════════════════
-- Prevent overlapping rehearsal bookings server-side. The client check only sees
-- the caller's own bookings (RLS), so two users could book the same slot.
-- Run in Supabase SQL Editor. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.prevent_booking_overlap() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'rejected') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.rehearsal_bookings b
    WHERE b.space_id = NEW.space_id
      AND b.date = NEW.date
      AND b.id <> NEW.id
      AND b.status NOT IN ('cancelled', 'rejected')
      AND b.start_time < NEW.end_time
      AND b.end_time > NEW.start_time
  ) THEN
    RAISE EXCEPTION 'booking_overlap' USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_prevent_booking_overlap ON rehearsal_bookings;
CREATE TRIGGER trg_prevent_booking_overlap
  BEFORE INSERT OR UPDATE OF date, start_time, end_time, status ON rehearsal_bookings
  FOR EACH ROW EXECUTE FUNCTION public.prevent_booking_overlap();
REVOKE EXECUTE ON FUNCTION public.prevent_booking_overlap() FROM PUBLIC, anon, authenticated;

COMMIT;
