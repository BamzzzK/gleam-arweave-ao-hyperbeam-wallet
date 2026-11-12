-- Coverage carries across releases (SCANS.md § Coverage): a function a scan
-- answered counts as examined on any release where its text is unchanged.
-- One row per answered function, with the hash of its text at the
-- attestation's commit. Voided attestations are left out by joining.
CREATE TABLE examined_functions (
  attestation_id text NOT NULL REFERENCES attestations (id),
  file text NOT NULL,
  symbol text NOT NULL,
  fingerprint text NOT NULL,
  PRIMARY KEY (attestation_id, file, symbol)
);
CREATE INDEX examined_functions_function ON examined_functions (file, symbol, fingerprint);

-- The paid places a release opens, fixed when it is first asked for so the
-- total doesn't move while scans examine its functions.
CREATE TABLE scan_releases (
  release text PRIMARY KEY,
  paid_places integer NOT NULL CHECK (paid_places >= 0),
  created_at timestamptz NOT NULL
);

-- Releases scanned or challenged before places followed coverage opened 100.
INSERT INTO scan_releases (release, paid_places, created_at)
  SELECT release, 100, min(created_at) FROM (
    SELECT release, created_at FROM attestations
    UNION ALL
    SELECT release, created_at FROM challenges
  ) seen GROUP BY release;
