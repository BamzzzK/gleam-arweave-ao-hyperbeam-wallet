-- Scan rounds (SCANS.md): a wallet scans a release once per area, the
-- surface files of one tier. `area` is null on an attestation made before
-- areas, which covered the whole surface; `round` is null on those too.
ALTER TABLE challenges ADD COLUMN area text;
ALTER TABLE attestations ADD COLUMN area text, ADD COLUMN round integer;

-- Voided rows stay in the key, as before, so a voided scan's area can't be
-- scanned again by the same wallet.
ALTER TABLE attestations DROP CONSTRAINT attestations_address_release_key;
CREATE UNIQUE INDEX attestations_address_release_area ON attestations (address, release, coalesce(area, ''));
