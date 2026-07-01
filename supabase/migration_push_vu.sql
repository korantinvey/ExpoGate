-- Track when a push notification was acknowledged (clicked by recipient)
alter table public.messages add column if not exists push_vu_at timestamptz;

-- Allow users to mark their own push as seen
-- (existing RLS update policy covers user_id = auth.uid(), so this column is already updatable)
