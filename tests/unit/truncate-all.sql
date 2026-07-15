DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations')
  LOOP
    EXECUTE 'TRUNCATE TABLE "public"."' || r.tablename || '" CASCADE';
  END LOOP;
END $$;
