import { useEffect, useState } from "react";
import { cn } from "../../primitives/cn";
import { createImageCache } from "./image-cache";

/**
 * Raster only: NFT media is untrusted, and an SVG kept as a blob would sit
 * at the wallet's own origin rather than the gateway's sandbox subdomain.
 */
const CACHED_TYPES: ReadonlySet<string> = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]);

const collectibleImages = createImageCache({
  name: "collectible-images",
  keyHost: "collectible-image.invalid",
  maxEntries: 300,
  accepts: (type) => CACHED_TYPES.has(type),
  maxBytes: 5 * 1024 * 1024,
});

/** Test hook: forgets the in-memory object URLs. */
export const resetCollectibleImageCacheForTests = collectibleImages.resetForTests;

/** A flaky network shouldn't read as "no image", so a failed load is retried before the file icon shows. */
const RETRY_DELAYS_MS = [1500, 4000, 10_000];

interface LoadState {
  url: string | undefined;
  tries: number;
  loaded: boolean;
  /** Waiting to retry after a failed load. */
  errored: boolean;
}

const fresh = (url: string | undefined): LoadState => ({ url, tries: 0, loaded: false, errored: false });

/**
 * A square collectible preview. The image loads only through `<img>`:
 * an NFT's media is untrusted, and an element that can run script or
 * navigate (iframe, object, embed) is never an option. The empty tile
 * pulses while the image loads. Without an image, or once every retry
 * has failed, a plain neutral tile with a file icon stands in.
 */
export interface CollectibleThumbnailProps {
  name: string;
  imageUrl?: string;
  className?: string;
  /** Empty alt text where the name is already shown beside the image, as escaped untrusted text. */
  decorative?: boolean;
}

export function CollectibleThumbnail({ name, imageUrl, className, decorative = false }: CollectibleThumbnailProps) {
  const [stored, setStored] = useState<LoadState>(() => fresh(imageUrl));
  const load = stored.url === imageUrl ? stored : fresh(imageUrl);
  const src = collectibleImages.useCachedImage(imageUrl, load.tries);
  const update = (change: (current: LoadState) => LoadState) =>
    setStored((previous) => change(previous.url === imageUrl ? previous : fresh(imageUrl)));

  const failed = load.errored && load.tries >= RETRY_DELAYS_MS.length;
  const waitingToRetry = load.errored && !failed;

  useEffect(() => {
    if (!waitingToRetry) return;
    const retry = () =>
      setStored((previous) =>
        previous.url === imageUrl && previous.errored ? { ...previous, tries: previous.tries + 1, errored: false } : previous,
      );
    const timer = setTimeout(retry, RETRY_DELAYS_MS[load.tries]);
    window.addEventListener("online", retry);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", retry);
    };
  }, [waitingToRetry, load.tries, imageUrl]);

  const showImage = typeof src === "string" && !load.errored;
  const pending = imageUrl !== undefined && !load.loaded && !failed;
  // A cached copy is already on the device, so it appears at once rather than fading in.
  const fade = typeof src === "string" && !src.startsWith("blob:");

  return (
    <div
      data-testid="collectible-tile"
      data-loading={pending || undefined}
      className={cn("relative aspect-square w-full overflow-hidden rounded-lg bg-mist", pending && "gleam-cached-pulse", className)}
    >
      {imageUrl !== undefined && !failed ? (
        showImage ? (
          <img
            key={load.tries}
            src={src}
            alt={decorative ? "" : name}
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={() => update((current) => ({ ...current, loaded: true }))}
            onError={() => {
              if (imageUrl !== undefined && src?.startsWith("blob:")) collectibleImages.forget(imageUrl);
              update((current) => ({ ...current, errored: true }));
            }}
            className={cn(
              "h-full w-full object-cover",
              fade && "transition-opacity duration-300 ease-out",
              fade && !load.loaded && "opacity-0",
            )}
            style={{ objectFit: "cover" }}
          />
        ) : null
      ) : (
        <div data-testid="collectible-placeholder" className="flex h-full w-full items-center justify-center text-faint">
          <FileIcon />
        </div>
      )}
    </div>
  );
}

function FileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
