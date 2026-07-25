import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createOpenAiCompatibleEmbeddingClient,
    listOpenAiCompatibleEmbeddingModels,
    normalizeEmbeddingApiUrl,
    normalizeEmbeddingModelsUrl,
} from './embedding-client.js';

test('normalizes an OpenAI-compatible base URL to the embeddings endpoint', () => {
    assert.equal(normalizeEmbeddingApiUrl('http://127.0.0.1:1234/v1'), 'http://127.0.0.1:1234/v1/embeddings');
    assert.equal(
        normalizeEmbeddingApiUrl('http://127.0.0.1:1234/v1/embeddings'),
        'http://127.0.0.1:1234/v1/embeddings',
    );
});

test('normalizes an OpenAI-compatible base URL to the models endpoint', () => {
    assert.equal(normalizeEmbeddingModelsUrl('http://127.0.0.1:1234/v1'), 'http://127.0.0.1:1234/v1/models');
    assert.equal(normalizeEmbeddingModelsUrl('http://127.0.0.1:1234/v1/embeddings'), 'http://127.0.0.1:1234/v1/models');
    assert.throws(() => normalizeEmbeddingModelsUrl('file:///tmp/models'), /must use http or https/);
});

test('discovers and prioritizes likely embedding models', async () => {
    let requestUrl = '';
    let authorization = '';
    let redirect: RequestRedirect | undefined;
    const models = await listOpenAiCompatibleEmbeddingModels('http://127.0.0.1:1234/v1', {
        apiKey: 'provider-secret',
        fetch: async (input, init) => {
            requestUrl = String(input);
            authorization = new Headers(init?.headers).get('Authorization') ?? '';
            redirect = init?.redirect;
            return Response.json({
                data: [
                    { id: 'chat-model' },
                    { id: 'text-embedding-qwen3' },
                    { id: 'nomic-embed-text' },
                    { id: 'text-embedding-qwen3' },
                ],
            });
        },
    });

    assert.equal(requestUrl, 'http://127.0.0.1:1234/v1/models');
    assert.equal(authorization, 'Bearer provider-secret');
    assert.equal(redirect, 'error');
    assert.deepEqual(models, [
        { id: 'nomic-embed-text', likelyEmbedding: true },
        { id: 'text-embedding-qwen3', likelyEmbedding: true },
        { id: 'chat-model', likelyEmbedding: false },
    ]);
});

test('sends document text unchanged and preserves response index order', async () => {
    let requestUrl = '';
    let requestBody: unknown;
    let authorization = '';
    const client = createOpenAiCompatibleEmbeddingClient(
        {
            baseUrl: 'http://127.0.0.1:1234/v1',
            model: 'qwen-embedding',
            apiKey: 'provider-secret',
        },
        {
            fetch: async (input, init) => {
                requestUrl = String(input);
                requestBody = JSON.parse(String(init?.body));
                authorization = new Headers(init?.headers).get('Authorization') ?? '';
                return Response.json({
                    data: [
                        { index: 1, embedding: [0, 1] },
                        { index: 0, embedding: [1, 0] },
                    ],
                });
            },
        },
    );

    const embeddings = await client.embedDocuments(['First document', 'Second document']);

    assert.equal(requestUrl, 'http://127.0.0.1:1234/v1/embeddings');
    assert.equal(authorization, 'Bearer provider-secret');
    assert.deepEqual(requestBody, {
        model: 'qwen-embedding',
        input: ['First document', 'Second document'],
        encoding_format: 'float',
    });
    assert.deepEqual(embeddings, [
        [1, 0],
        [0, 1],
    ]);
});

test('adds the configured instruction only to query embeddings', async () => {
    const inputs: string[][] = [];
    const client = createOpenAiCompatibleEmbeddingClient(
        {
            baseUrl: 'http://127.0.0.1:1234/v1',
            model: 'qwen-embedding',
            queryInstruction: 'Retrieve relevant personal notes.',
        },
        {
            fetch: async (_input, init) => {
                const body = JSON.parse(String(init?.body)) as { input: string[] };
                inputs.push(body.input);
                return Response.json({ data: body.input.map((_value, index) => ({ index, embedding: [1, 0] })) });
            },
        },
    );

    await client.embedDocuments(['Document']);
    await client.embedQuery('fortune teller death');

    assert.deepEqual(inputs, [
        ['Document'],
        ['Instruct: Retrieve relevant personal notes.\nQuery: fortune teller death'],
    ]);
});

test('rejects malformed embedding vectors instead of storing them', async () => {
    const client = createOpenAiCompatibleEmbeddingClient(
        {
            baseUrl: 'http://127.0.0.1:1234/v1',
            model: 'qwen-embedding',
        },
        {
            fetch: async () => Response.json({ data: [{ index: 0, embedding: [1, 'bad'] }] }),
        },
    );

    await assert.rejects(client.embedDocuments(['Document']), /invalid vector value/);
});

test('allows operator-configured private and plain HTTP providers while rejecting redirects', async () => {
    let requestedUrl = '';
    let redirect: RequestRedirect | undefined;
    const client = createOpenAiCompatibleEmbeddingClient(
        {
            baseUrl: 'http://192.168.1.20:1234/v1',
            model: 'qwen-embedding',
        },
        {
            fetch: async (input, init) => {
                requestedUrl = String(input);
                redirect = init?.redirect;
                return Response.json({ data: [{ index: 0, embedding: [1, 0] }] });
            },
        },
    );

    await client.embedDocuments(['Document']);
    assert.equal(requestedUrl, 'http://192.168.1.20:1234/v1/embeddings');
    assert.equal(redirect, 'error');
});

test('rejects credentials embedded in operator-configured provider URLs', () => {
    assert.throws(
        () =>
            createOpenAiCompatibleEmbeddingClient({
                baseUrl: 'https://user:secret@embedding.example.com/v1',
                model: 'qwen-embedding',
            }),
        /must not contain credentials/,
    );
});

test('redacts a provider API key from upstream error messages', async () => {
    const client = createOpenAiCompatibleEmbeddingClient(
        {
            baseUrl: 'http://127.0.0.1:1234/v1',
            model: 'qwen-embedding',
            apiKey: 'provider-secret',
        },
        {
            fetch: async () =>
                Response.json({ error: { message: 'Rejected credential provider-secret' } }, { status: 401 }),
        },
    );

    await assert.rejects(
        client.embedDocuments(['Document']),
        (error: Error) => error.message.includes('[redacted]') && !error.message.includes('provider-secret'),
    );
});
