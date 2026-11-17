/** Leave room for the session token and request envelope below Fastify's 1 MiB body limit. */
export const IMPORT_REQUEST_BYTES = 850_000;
export const IMPORT_MARKDOWN_CHARS = 700_000;
export const importJsonBytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length + 1;
