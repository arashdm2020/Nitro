ALTER TABLE "Account" ADD CONSTRAINT "user_balance_nonnegative" CHECK ("userId" IS NULL OR "balance" >= 0);
ALTER TABLE "Asset" ADD CONSTRAINT "asset_precision" CHECK ("decimals" BETWEEN 0 AND 18);
ALTER TABLE "Transaction" ADD CONSTRAINT "positive_amount" CHECK ("amount" > 0 AND "fee" >= 0);
CREATE FUNCTION nitro_reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Append-only financial/audit records cannot be modified';
END;
$$;
CREATE TRIGGER ledger_immutable BEFORE UPDATE OR DELETE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION nitro_reject_mutation();
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION nitro_reject_mutation();
CREATE FUNCTION nitro_verify_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE entry_sum NUMERIC; cached NUMERIC; account_sum NUMERIC;
BEGIN
  SELECT COALESCE(SUM("amount"),0) INTO entry_sum FROM "LedgerEntry" WHERE "transactionId" = NEW."transactionId";
  IF entry_sum <> 0 THEN RAISE EXCEPTION 'Ledger transaction is not balanced'; END IF;
  SELECT "balance" INTO cached FROM "Account" WHERE "id" = NEW."accountId";
  SELECT COALESCE(SUM("amount"),0) INTO account_sum FROM "LedgerEntry" WHERE "accountId" = NEW."accountId";
  IF cached <> account_sum THEN RAISE EXCEPTION 'Cached balance does not reconcile with ledger'; END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER ledger_balanced AFTER INSERT ON "LedgerEntry" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION nitro_verify_ledger();
CREATE FUNCTION nitro_verify_account() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_balance NUMERIC; ledger_balance NUMERIC;
BEGIN
 SELECT "balance" INTO current_balance FROM "Account" WHERE "id"=NEW."id";
 SELECT COALESCE(SUM("amount"),0) INTO ledger_balance FROM "LedgerEntry" WHERE "accountId"=NEW."id";
 IF current_balance <> ledger_balance THEN RAISE EXCEPTION 'Balance changes require ledger entries'; END IF;
 RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER account_reconciled AFTER INSERT OR UPDATE ON "Account" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION nitro_verify_account();
