begin;
select plan(10);

select has_table('public', 'properties', 'properties table exists');
select has_table('public', 'legal_disclosures', 'legal disclosure table exists');
select has_table('public', 'distribution_targets', 'distribution target table exists');
select hasnt_table('public', 'call_logs', 'call logs are outside the product');
select has_function('public', 'claim_distribution_target', array['uuid','integer'], 'queue lease function exists');
select is((select relrowsecurity from pg_class where oid = 'public.properties'::regclass), true, 'properties RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.customers'::regclass), true, 'customers RLS enabled');
select is((select public from storage.buckets where id = 'property-media'), false, 'property media bucket is private');
select col_is_unique('public', 'distribution_jobs', array['office_id','idempotency_key'], 'job idempotency is enforced');
select col_is_unique('public', 'distribution_targets', array['distribution_job_id','platform'], 'one target per platform');

select * from finish();
rollback;
