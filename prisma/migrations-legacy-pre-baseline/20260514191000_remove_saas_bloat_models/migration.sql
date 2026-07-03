-- Remove obsolete SaaS/template models after converting the app to a private finance ledger.
-- These tables belonged to Stripe subscriptions, Make/n8n project automation, and waiting-list audiences.

DROP TABLE IF EXISTS "Subscription";
DROP TABLE IF EXISTS "Project";
DROP TABLE IF EXISTS "Audiences";
DROP TYPE IF EXISTS "SubscriptionStatus";
