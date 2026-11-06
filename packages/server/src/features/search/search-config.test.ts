import assert from 'node:assert/strict';
import test from 'node:test';
import {
    DEFAULT_SEMANTIC_SEARCH_CONFIG,
    normalizeSemanticSearchConfig,
    SEMANTIC_SEARCH_CONFIG_CACHE_KEY,
    SemanticSearchConfigStore,
} from './search-config.js';

const createCache = () => {
    const values = new Map<string, string>();

    return {
        values,
        cache: {
            async findUnique({ where }: { where: { key: string } }) {
                const value = values.get(where.key);
                return value === undefined ? null : { value };
            },
            async upsert({
                where,
                create,
                update,
            }: {
                where: { key: string };
                create: { key: string; value: string };
                update: { value: string };
            }) {
                values.set(where.key, values.has(where.key) ? update.value : create.value);
            },
        },
    };
};

test('defaults to disabled semantic search when no setting has been saved', async () => {
    const { cache } = createCache();
    const store = new SemanticSearchConfigStore(cache);

    assert.deepEqual(await store.get(), DEFAULT_SEMANTIC_SEARCH_CONFIG);
});

test('persists a normalized OpenAI-compatible embedding configuration', async () => {
    const { cache } = createCache();
    const store = new SemanticSearchConfigStore(cache);

    await store.set({
        enabled: true,
        baseUrl: ' http://127.0.0.1:1234/v1/ ',
        model: ' qwen-embedding ',
        queryTemplate: ' task: search result | query: {query} ',
        documentTemplate: 'title: {title} | text: {content}',
        inputSuffix: ' <|endoftext|> ',
    });

    assert.deepEqual(await store.get(), {
        enabled: true,
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'qwen-embedding',
        queryTemplate: 'task: search result | query: {query}',
        documentTemplate: 'title: {title} | text: {content}',
        inputSuffix: '<|endoftext|>',
    });
});

test('persists successful connection validation separately from editable settings', async () => {
    const { cache } = createCache();
    const store = new SemanticSearchConfigStore(cache);

    await store.markConnectionValidated({
        baseUrl: ' http://127.0.0.1:1234/v1/ ',
        model: ' qwen-embedding ',
    });

    assert.equal(
        await store.isConnectionValidated({
            baseUrl: 'http://127.0.0.1:1234/v1',
            model: 'qwen-embedding',
        }),
        true,
    );
    assert.equal(
        await store.isConnectionValidated({
            baseUrl: 'http://127.0.0.1:5678/v1',
            model: 'qwen-embedding',
        }),
        false,
    );
});

test('invalidates a saved connection when its API key fingerprint changes', async () => {
    const { cache } = createCache();
    const store = new SemanticSearchConfigStore(cache);
    const connection = {
        baseUrl: 'https://embedding.example.com/v1',
        model: 'qwen-embedding',
    };

    await store.markConnectionValidated(connection, 'fingerprint-a');

    assert.equal(await store.isConnectionValidated(connection, 'fingerprint-a'), true);
    assert.equal(await store.isConnectionValidated(connection, 'fingerprint-b'), false);
});

test('reads the retired Korean-specific default instruction as the default query template', async () => {
    const { cache, values } = createCache();
    const store = new SemanticSearchConfigStore(cache);
    values.set(
        SEMANTIC_SEARCH_CONFIG_CACHE_KEY,
        JSON.stringify({
            enabled: true,
            baseUrl: 'http://127.0.0.1:1234/v1',
            model: 'qwen-embedding',
            queryInstruction: 'Given a vague Korean memory query, retrieve relevant passages from personal notes.',
        }),
    );

    const config = await store.get();

    assert.equal(config.queryTemplate, '{query}');
    assert.equal(config.documentTemplate, 'Title: {title}\nContent: {content}');
    assert.equal(config.inputSuffix, '');
});

test('turns a saved query instruction into the matching query template', async () => {
    const { cache, values } = createCache();
    const store = new SemanticSearchConfigStore(cache);
    values.set(
        SEMANTIC_SEARCH_CONFIG_CACHE_KEY,
        JSON.stringify({
            enabled: true,
            baseUrl: 'http://127.0.0.1:1234/v1',
            model: 'qwen-embedding',
            queryInstruction: 'Retrieve relevant notes.',
        }),
    );

    assert.deepEqual(await store.get(), {
        enabled: true,
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'qwen-embedding',
        queryTemplate: 'Instruct: Retrieve relevant notes.\nQuery: {query}',
        documentTemplate: 'Title: {title}\nContent: {content}',
        inputSuffix: '',
    });
});

test('rejects templates without their required placeholder and falls back to defaults when empty', () => {
    const base = {
        enabled: false,
        baseUrl: '',
        model: '',
        queryTemplate: '{query}',
        documentTemplate: 'Title: {title}\nContent: {content}',
        inputSuffix: '',
    };

    assert.throws(() => normalizeSemanticSearchConfig({ ...base, queryTemplate: 'query: ' }), /\{query\}/);
    assert.throws(() => normalizeSemanticSearchConfig({ ...base, documentTemplate: 'title: {title}' }), /\{content\}/);
    assert.equal(normalizeSemanticSearchConfig({ ...base, queryTemplate: '  ' }).queryTemplate, '{query}');
    assert.equal(
        normalizeSemanticSearchConfig({ ...base, documentTemplate: '' }).documentTemplate,
        'Title: {title}\nContent: {content}',
    );
});

test('requires an API URL and model only when semantic search is enabled', () => {
    assert.doesNotThrow(() => normalizeSemanticSearchConfig(DEFAULT_SEMANTIC_SEARCH_CONFIG));
    assert.doesNotThrow(() =>
        normalizeSemanticSearchConfig({
            ...DEFAULT_SEMANTIC_SEARCH_CONFIG,
            enabled: true,
            baseUrl: 'http://127.0.0.1:1234/v1',
            model: 'qwen-embedding',
        }),
    );
    assert.throws(
        () => normalizeSemanticSearchConfig({ ...DEFAULT_SEMANTIC_SEARCH_CONFIG, enabled: true }),
        /URL and model are required/,
    );
    assert.throws(
        () =>
            normalizeSemanticSearchConfig({
                ...DEFAULT_SEMANTIC_SEARCH_CONFIG,
                baseUrl: `https://embedding.example.com/${'a'.repeat(2_048)}`,
            }),
        /URL is too long/,
    );
});
