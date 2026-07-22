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
    const models = await listOpenAiCompatibleEmbeddingModels('http://127.0.0.1:1234/v1', {
        fetch: async (input) => {
            requestUrl = String(input);
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
    assert.deepEqual(models, [
        { id: 'nomic-embed-text', likelyEmbedding: true },
        { id: 'text-embedding-qwen3', likelyEmbedding: true },
        { id: 'chat-model', likelyEmbedding: false },
    ]);
});

test('sends document text unchanged and preserves response index order', async () => {
    let requestUrl = '';
    let requestBody: unknown;
    const client = createOpenAiCompatibleEmbeddingClient(
        {
            baseUrl: 'http://127.0.0.1:1234/v1',
            model: 'qwen-embedding',
        },
        {
            fetch: async (input, init) => {
                requestUrl = String(input);
                requestBody = JSON.parse(String(init?.body));
                return Response.json({
                    data: [
                        { index: 1, embedding: [0, 1] },
                        { index: 0, embedding: [1, 0] },
                    ],
                });
            },
        },
    );

    const embeddings = await client.embedDocuments(['첫 문서', '둘째 문서']);

    assert.equal(requestUrl, 'http://127.0.0.1:1234/v1/embeddings');
    assert.deepEqual(requestBody, {
        model: 'qwen-embedding',
        input: ['첫 문서', '둘째 문서'],
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
            queryInstruction: 'Retrieve relevant Korean personal notes.',
        },
        {
            fetch: async (_input, init) => {
                const body = JSON.parse(String(init?.body)) as { input: string[] };
                inputs.push(body.input);
                return Response.json({ data: body.input.map((_value, index) => ({ index, embedding: [1, 0] })) });
            },
        },
    );

    await client.embedDocuments(['문서']);
    await client.embedQuery('점쟁이 죽는');

    assert.deepEqual(inputs, [['문서'], ['Instruct: Retrieve relevant Korean personal notes.\nQuery: 점쟁이 죽는']]);
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

    await assert.rejects(client.embedDocuments(['문서']), /invalid vector value/);
});
