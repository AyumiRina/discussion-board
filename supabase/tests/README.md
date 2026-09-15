# Supabase checks

Apply [`../schema.sql`](../schema.sql), then run the contract checks with the Supabase CLI:

```sh
supabase test db
```

`rls.test.sql` verifies the tables, RLS enablement, public-read policies, `auth.uid()` ownership checks, reaction target constraints, reaction uniqueness indexes, and title validation. The API route schemas reject malformed JSON and over-limit fields before they reach the database.
