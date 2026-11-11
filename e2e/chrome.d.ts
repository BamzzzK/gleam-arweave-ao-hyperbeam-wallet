/**
 * The few `chrome.*` calls the e2e tests make inside extension pages and
 * the service worker (`page.evaluate`, `worker.evaluate`). The repo has no
 * `@types/chrome`; WXT's browser types belong to the extension package.
 */
declare namespace chrome {
  namespace runtime {
    function sendMessage(message: unknown, reply: (response: { res?: unknown; err?: { message: string } } | undefined) => void): void;
  }
  namespace downloads {
    function search(query: { id?: number }): Promise<Array<{ id: number; url: string }>>;
    function download(options: { url: string; filename?: string }): Promise<number>;
  }
  namespace storage {
    const local: {
      get(key: string): Promise<Record<string, unknown>>;
      clear(): Promise<void>;
    };
  }
}
