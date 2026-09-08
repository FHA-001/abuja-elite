-- Incremental migration: apply after the existing Phase 2 foundation.
-- Buckets remain private. public-media checks publication and streams approved
-- images; no anonymous object SELECT or signed-URL creation is granted.
begin;

-- A gallery item associated with a draft is also withheld from public readers.
drop policy if exists "published gallery items are public" on public.gallery_items;
create policy "published gallery items are public" on public.gallery_items
for select to anon, authenticated using (
 published and
 (event_id is null or exists(select 1 from public.events e where e.id=event_id and e.published)) and
 (story_id is null or exists(select 1 from public.stories s where s.id=story_id and s.published and s.published_at<=now())) and
 (collaboration_id is null or exists(select 1 from public.collaborations c where c.id=collaboration_id and c.published))
);

create table if not exists app_private.form_limits (
 key text primary key,
 window_start timestamptz not null,
 attempts integer not null check(attempts>0)
);
alter table app_private.form_limits enable row level security;
revoke all on app_private.form_limits from public, anon, authenticated;

-- Service-only, transactionally persistent controls. An over-limit request
-- rolls back its increment but leaves the previous successful count intact.
create or replace function public.submit_public_enquiry(p_kind text,p_payload jsonb,p_rate_key text)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,app_private
as $$
declare
 v_email text; v_name text; v_message text; v_event uuid;
 v_count integer; v_global integer; v_hour timestamptz:=date_trunc('hour',now());
begin
 if p_kind is null or p_kind not in ('contact','application','newsletter','event')
 or p_payload is null or jsonb_typeof(p_payload)<>'object'
 or p_rate_key is null or p_rate_key !~ '^[a-f0-9]{64}$'
 or p_payload->'consent' is distinct from 'true'::jsonb then raise exception 'invalid_submission'; end if;
 v_email:=lower(btrim(p_payload->>'email'));v_name:=btrim(coalesce(p_payload->>'name',''));v_message:=btrim(coalesce(p_payload->>'message',''));
 if v_email is null or length(v_email) not between 3 and 320
 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or length(v_name)>160 or length(v_message)>5000
 or length(coalesce(p_payload->>'phone',''))>40
 or length(coalesce(p_payload->>'subject',''))>200
 or length(coalesce(p_payload->>'interest',''))>160
 or (p_kind<>'newsletter' and length(v_name)<1)
 or (p_kind in ('contact','application') and length(v_message)<10)
 or (p_kind='application' and length(btrim(coalesce(p_payload->>'interest','')))<1)
 then raise exception 'invalid_submission'; end if;
 -- One fixed global key first provides consistent lock ordering.
 insert into app_private.form_limits as f(key,window_start,attempts) values('global',v_hour,1)
 on conflict(key) do update set window_start=v_hour,attempts=case when f.window_start=v_hour then f.attempts+1 else 1 end returning attempts into v_global;
 if v_global>500 then raise exception 'rate_limit';end if;
 insert into app_private.form_limits as f(key,window_start,attempts) values(p_rate_key,v_hour,1)
 on conflict(key) do update set window_start=v_hour,attempts=case when f.window_start=v_hour then f.attempts+1 else 1 end returning attempts into v_count;
 if v_count>5 then raise exception 'rate_limit';end if;
 delete from app_private.form_limits where window_start<now()-interval '2 days';
 if p_kind='contact' then
  insert into public.contact_messages(name,email,subject,message) values(v_name,v_email,nullif(btrim(p_payload->>'subject'),''),v_message);
 elsif p_kind='application' then
  insert into public.applications(name,email,phone,message,interest) values(v_name,v_email,nullif(btrim(p_payload->>'phone'),''),v_message,btrim(p_payload->>'interest'));
 elsif p_kind='newsletter' then
  insert into public.newsletter_subscribers(normalized_email,consent,consent_at,status) values(v_email,true,now(),'pending') on conflict(normalized_email) do nothing;
 else
  begin v_event:=(p_payload->>'event_id')::uuid;exception when invalid_text_representation then raise exception 'invalid_submission';end;
  -- Generic receipt for an unavailable event; no draft existence disclosure.
  if exists(select 1 from public.events where id=v_event and published and status='scheduled' and coalesce(ends_at,starts_at)>now()) then
   insert into public.event_interests(event_id,name,email,message) values(v_event,v_name,v_email,nullif(v_message,'')) on conflict(event_id,normalized_email) do nothing;
  end if;
 end if;
 return jsonb_build_object('received',true);
end;
$$;
revoke all on function public.submit_public_enquiry(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.submit_public_enquiry(text,jsonb,text) to service_role;
commit;
