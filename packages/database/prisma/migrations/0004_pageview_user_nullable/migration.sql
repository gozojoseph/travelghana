-- D37 fix: PageView.userId is optional in the schema (anonymous visitors have
-- no user row to correlate with), so the column must be nullable for the
-- ON DELETE SET NULL foreign key to be meaningful.
ALTER TABLE "PageView" ALTER COLUMN "userId" DROP NOT NULL;
