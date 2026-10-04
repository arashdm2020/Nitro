ALTER TABLE "Account" ADD COLUMN "reservedBalance" DECIMAL(38,18) NOT NULL DEFAULT 0;
ALTER TABLE "Account" ADD CONSTRAINT "valid_reserved_balance"
  CHECK ("reservedBalance" >= 0 AND ("userId" IS NULL OR "reservedBalance" <= "balance"));
ALTER TABLE "Transaction" ADD COLUMN "recipientAddress" TEXT,
  ADD COLUMN "networkId" UUID, ADD COLUMN "networkName" TEXT;
CREATE INDEX "Transaction_senderId_assetId_status_idx" ON "Transaction"("senderId", "assetId", "status");

-- Reservations are backed by actual pending requests, not completed ledger movements.
CREATE FUNCTION nitro_check_reservation(owner_id UUID, asset_id UUID) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE reserved NUMERIC; pending NUMERIC;
BEGIN
  IF owner_id IS NULL THEN RETURN; END IF;
  SELECT "reservedBalance" INTO reserved FROM "Account" WHERE "userId" = owner_id AND "assetId" = asset_id;
  SELECT COALESCE(SUM("amount" + "fee"), 0) INTO pending FROM "Transaction"
    WHERE "senderId" = owner_id AND "assetId" = asset_id AND "type" = 'BLOCKCHAIN' AND "status" = 'PENDING';
  IF reserved IS DISTINCT FROM pending THEN RAISE EXCEPTION 'Reserved balance does not reconcile with pending requests'; END IF;
END;
$$;
CREATE FUNCTION nitro_verify_account_reservation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM nitro_check_reservation(NEW."userId", NEW."assetId");
  RETURN NEW;
END;
$$;
CREATE FUNCTION nitro_verify_request_reservation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'DELETE' THEN PERFORM nitro_check_reservation(NEW."senderId", NEW."assetId"); END IF;
  IF TG_OP <> 'INSERT' THEN PERFORM nitro_check_reservation(OLD."senderId", OLD."assetId"); END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER account_reservation_reconciled AFTER INSERT OR UPDATE ON "Account"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION nitro_verify_account_reservation();
CREATE CONSTRAINT TRIGGER request_reservation_reconciled AFTER INSERT OR UPDATE OR DELETE ON "Transaction"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION nitro_verify_request_reservation();
