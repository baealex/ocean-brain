export interface EmbeddingRuntimeEnvironment {
    [key: string]: string | undefined;
    OCEAN_BRAIN_EMBEDDING_ALLOWED_ORIGINS?: string;
}

export interface EmbeddingRuntimeConfig {
    allowedOrigins: string[];
}

const normalizeAllowedOrigin = (value: string) => {
    const input = value.trim();
    if (!input) {
        return '';
    }
    let url: URL;
    try {
        url = new URL(input);
    } catch {
        throw new Error('Embedding allowed origins must be valid http or https origins.');
    }
    if (
        (url.protocol !== 'http:' && url.protocol !== 'https:') ||
        url.username ||
        url.password ||
        (url.pathname !== '/' && url.pathname !== '') ||
        url.search ||
        url.hash
    ) {
        throw new Error('Embedding allowed origins must contain only a scheme, hostname, and optional port.');
    }
    return url.origin.toLowerCase();
};

export const resolveEmbeddingRuntimeConfig = (
    env: EmbeddingRuntimeEnvironment = process.env,
): EmbeddingRuntimeConfig => {
    const allowedOrigins = [
        ...new Set(
            (env.OCEAN_BRAIN_EMBEDDING_ALLOWED_ORIGINS ?? '').split(',').map(normalizeAllowedOrigin).filter(Boolean),
        ),
    ];

    return { allowedOrigins };
};
