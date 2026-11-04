/**
 * Recovery phrases with the seed, address and full-key digest that
 * Wander's own stack derives from them (`bip39-web-crypto` 4.0.1,
 * `human-crypto-keys` 0.1.4, `node-forge` 1.3.1, WebCrypto JWK export).
 * Test phrases only: never fund these addresses. `jwkSha256` is SHA-256
 * of `JSON.stringify([kty, e, n, d, p, q, dp, dq, qi])`.
 *
 * Ordered fastest first. The default run derives only the first; set
 * `GLEAM_PHRASE_VECTORS=all` to derive every one (about three minutes),
 * which any change to forge or this derivation must pass.
 */
export const WANDER_PHRASE_VECTORS = [
  {
    words: 18,
    mnemonic: "thrive erode invest float voyage express enemy rubber cross strong myth despair belt volume volcano memory easy record",
    seed: "61938f84a4d53c884248b2eb38375b2a89549abe79a0026cba96be7c77fe2e545a0a575940c0a36d7afd1767b7e076a9ef7a2cc81d9dc5268da06d663e12bce5",
    address: "Q1QlWDqHz3NL169kyXNI8VAdU7K07Ed8O3uIRmNOk3s",
    jwkSha256: "05e287c752c245dcbe177869ff8329b13b29566d7907decae5bfd0cad3729d63",
  },
  {
    words: 21,
    mnemonic: "surround crash brand tip battle treat orient coil sudden laugh lab middle empower ship melt marble grow gentle drum ketchup nose",
    seed: "4423f9c2e85c2bcc163f50f0e2e9ccd5441791b206cc683fa7f0fc6eea709e994774e6a3da085b5d6d57a144e1d26ca80b93a2e5e35923e6207369fe0ed8a8b7",
    address: "bDbQaV0uvAu8kNcYpYxsg90LQc1WvkL7P3L9tkb04HA",
    jwkSha256: "28579aca562808d7a3c8135c211fecd280487481720ac1bc696bc683289dafa8",
  },
  {
    words: 15,
    mnemonic: "fault parade warrior window crouch refuse bullet belt list fix tattoo toe honey rude clog",
    seed: "193e22e2f0cd9ed37ea62a54ce9bc2367171005e8211d732ee58dd7be91a61b165b7b7d8acc0b10351b3494ff89068f8e95fa1bd16e25f43e07776ed6239396d",
    address: "7OHYqoyPT7qJrithE6KKl707QD0wDy-Z7FvITl-wibA",
    jwkSha256: "f1e6e16b32dbe6dc6bfd92fecdd0f81e459d741b5c5b66c48d7a526b5378b5ab",
  },
  {
    words: 12,
    mnemonic: "legal winner thank year wave sausage worth useful legal winner thank yellow",
    seed: "878386efb78845b3355bd15ea4d39ef97d179cb712b77d5c12b6be415fffeffe5f377ba02bf3f8544ab800b955e51fbff09828f682052a20faa6addbbddfb096",
    address: "4gko33o-g-_iAJ-EaBQT_MX1m3GqW380z6Nz3HuszAk",
    jwkSha256: "574d65f636575231f11046f8fa5e28b8959e9e674c7496b39b13f10c6e9b8d6b",
  },
  {
    words: 24,
    mnemonic: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art",
    seed: "408b285c123836004f4b8842c89324c1f01382450c0d439af345ba7fc49acf705489c6fc77dbd4e3dc1dd8cc6bc9f043db8ada1e243c4a0eafb290d399480840",
    address: "tJq3qdBq0dO4y-orolSeNm9CdgyVam2F02ECD2QyjBE",
    jwkSha256: "ec7e002e8d3a04467e9b1992a82746a2d7170ff4249f4f85467b72bf9a465076",
  },
  {
    words: 12,
    mnemonic: "olympic coach payment switch village gas genuine tent one cliff scatter apple",
    seed: "65796712788a73817b85ef74a55c449ba15543e9f84caed5027264e99c454290be7cdbe92e64a738659d346a4624a49fb603a11d2cfda655c8bd7a1dac77faea",
    address: "LlHkmwEzFbWAsPCx3d-9QcAxtbwcGTcpMuO046j8nWw",
    jwkSha256: "7d1a219aa58ec2c99215dda6e901e6ccbd6975af2b37e0146261f2fc00e489d1",
  },
  {
    words: 12,
    mnemonic: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    seed: "5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4",
    address: "l55sI4sCbT9d9AV6WKz2DQpnW4Ld0EcBAZv-CMv_HAQ",
    jwkSha256: "cfaccc7d3f2f4bd0664669f66ad8dc8edfa18c9a5032e8198718097868858982",
  },
] as const;
