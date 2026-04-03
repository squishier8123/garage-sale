-- =============================================================================
-- Phase 6: Enable Realtime on messages + pickup_time_slots
-- =============================================================================

-- Enable Realtime publication for messages (pickup messaging)
alter publication supabase_realtime add table messages;

-- Enable Realtime publication for pickup_time_slots (slot selection updates)
alter publication supabase_realtime add table pickup_time_slots;

-- Add buyer update policy for pickup_time_slots (selecting a slot)
-- Guest buyers go through API routes with admin client, but authenticated
-- buyers (future v2) need this policy
create policy "pickup_slots_update_buyer" on pickup_time_slots
  for update using (
    exists (
      select 1 from transactions
      where transactions.id = pickup_time_slots.transaction_id
      and (transactions.buyer_id = auth.uid() or transactions.buyer_email = current_setting('request.jwt.claims', true)::json->>'email')
    )
  )
  with check (
    -- Buyers can only update the 'selected' field (enforced at app layer)
    true
  );
