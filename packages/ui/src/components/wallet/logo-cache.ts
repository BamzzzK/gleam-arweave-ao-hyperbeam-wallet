import { createImageCache } from "./image-cache";

/** Token logos; a token that changes its logo points at a new tx id. */
const logoCache = createImageCache({
  name: "token-logos",
  keyHost: "token-logo.invalid",
  maxEntries: 200,
  accepts: (type) => type.startsWith("image/"),
});

export const useCachedLogo = logoCache.useCachedImage;

/** Test hook: forgets the in-memory object URLs. */
export const resetLogoCacheForTests = logoCache.resetForTests;
