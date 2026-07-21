import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useState } from 'react';
import {
    fetchSearchAdminStatus,
    type SemanticSearchConfig,
    type SemanticSearchPhase,
    saveSemanticSearchConfig,
    startSemanticSearchReindex,
    testSemanticSearchConnection,
} from '~/apis/search-admin.api';
import * as Icon from '~/components/icon';
import { Button, PageLayout, Progress } from '~/components/shared';
import { Input, Label, Switch, Text, Textarea, useToast } from '~/components/ui';
import { queryKeys } from '~/modules/query-key-factory';

const DEFAULT_QUERY_INSTRUCTION = 'Given a vague Korean memory query, retrieve relevant passages from personal notes.';

const EMPTY_CONFIG: SemanticSearchConfig = {
    enabled: false,
    baseUrl: '',
    model: '',
    queryInstruction: DEFAULT_QUERY_INSTRUCTION,
};

const phaseLabels: Record<SemanticSearchPhase, string> = {
    disabled: 'Meaning search off',
    'needs-index': 'Index needed',
    indexing: 'Building index',
    ready: 'Meaning search ready',
    error: 'Index error',
};

const configsMatch = (left: SemanticSearchConfig, right: SemanticSearchConfig) =>
    left.enabled === right.enabled &&
    left.baseUrl === right.baseUrl &&
    left.model === right.model &&
    left.queryInstruction === right.queryInstruction;

const getRequestErrorMessage = (error: unknown, fallback: string) => {
    if (axios.isAxiosError<{ message?: string }>(error)) {
        return error.response?.data?.message ?? error.message ?? fallback;
    }

    return error instanceof Error ? error.message : fallback;
};

const formatIndexedAt = (indexedAt: string | null) => {
    if (!indexedAt) {
        return 'Not built yet';
    }

    const date = new Date(indexedAt);
    return Number.isNaN(date.getTime()) ? indexedAt : date.toLocaleString();
};

const SearchSetting = () => {
    const toast = useToast();
    const queryClient = useQueryClient();
    const statusQueryKey = queryKeys.search.adminStatus();
    const [form, setForm] = useState<SemanticSearchConfig>(EMPTY_CONFIG);
    const [hasInitialized, setHasInitialized] = useState(false);

    const {
        data: status,
        error: statusQueryError,
        isLoading,
    } = useQuery({
        queryKey: statusQueryKey,
        queryFn: fetchSearchAdminStatus,
        refetchInterval: (query) => (query.state.data?.phase === 'indexing' ? 1_000 : false),
    });

    useEffect(() => {
        if (status && !hasInitialized) {
            setForm(status.config);
            setHasInitialized(true);
        }
    }, [hasInitialized, status]);

    const saveMutation = useMutation({
        mutationFn: saveSemanticSearchConfig,
        onSuccess: (nextStatus) => {
            queryClient.setQueryData(statusQueryKey, nextStatus);
            setForm(nextStatus.config);
            toast('Search settings saved.');
        },
        onError: (error) => {
            toast(getRequestErrorMessage(error, 'Failed to save search settings.'));
        },
    });

    const connectionMutation = useMutation({
        mutationFn: testSemanticSearchConnection,
        onSuccess: ({ dimensions, model }) => {
            toast(`Connected to ${model} (${dimensions} dimensions).`);
        },
        onError: (error) => {
            toast(getRequestErrorMessage(error, 'Could not connect to the embedding API.'));
        },
    });

    const reindexMutation = useMutation({
        mutationFn: startSemanticSearchReindex,
        onSuccess: ({ started, status: nextStatus }) => {
            queryClient.setQueryData(statusQueryKey, nextStatus);
            toast(started ? 'Search index build started.' : 'Search index is already building.');
        },
        onError: (error) => {
            toast(getRequestErrorMessage(error, 'Could not start the search index build.'));
        },
    });

    const isDirty = Boolean(status && !configsMatch(form, status.config));
    const isIndexing = status?.phase === 'indexing';
    const hasConnectionFields = Boolean(form.baseUrl.trim() && form.model.trim());
    const canBuildIndex = Boolean(status?.config.enabled && !isDirty && !isIndexing);
    const progress = status?.progress;
    const phaseLabel = status ? phaseLabels[status.phase] : isLoading ? 'Loading' : 'Unavailable';

    const updateForm = <Key extends keyof SemanticSearchConfig>(key: Key, value: SemanticSearchConfig[Key]) => {
        setForm((current) => ({ ...current, [key]: value }));
    };

    return (
        <PageLayout
            title="Search"
            variant="default"
            description="Keep keyword search built in and optionally add meaning-based recall."
            headerRight={
                <Text
                    as="span"
                    variant="meta"
                    weight="medium"
                    tone={status?.phase === 'error' ? 'error' : 'secondary'}
                    className="rounded-full border border-border-subtle bg-muted px-3 py-1.5"
                >
                    {phaseLabel}
                </Text>
            }
        >
            <div className="flex flex-col gap-5">
                <section className="surface-base flex flex-col gap-4 p-4" aria-labelledby="search-mode-heading">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1 basis-[28rem] space-y-1">
                            <Text id="search-mode-heading" as="h2" variant="label" weight="medium">
                                Meaning search
                            </Text>
                            <Text as="p" variant="meta" tone="secondary" className="max-w-[42rem] leading-relaxed">
                                Keyword search always stays inside Ocean Brain. Enable this when you also want to find
                                notes from a vague memory or paraphrased idea.
                            </Text>
                        </div>
                        <div className="flex items-center gap-3">
                            <Text as="span" variant="meta" weight="medium" tone="secondary">
                                {form.enabled ? 'Enabled' : 'Disabled'}
                            </Text>
                            <Switch
                                aria-label="Meaning search"
                                checked={form.enabled}
                                disabled={!hasInitialized || isIndexing}
                                onCheckedChange={(enabled) => updateForm('enabled', enabled)}
                            />
                        </div>
                    </div>

                    <div className="rounded-[14px] border border-border-subtle bg-muted px-3.5 py-3">
                        <div className="flex items-start gap-2.5">
                            <Icon.Info className="mt-0.5 h-4 w-4 shrink-0 text-fg-tertiary" />
                            <Text as="p" variant="meta" tone="secondary" className="leading-relaxed">
                                Ocean Brain sends note text to the embedding API you configure below. A local LM Studio
                                URL keeps that traffic on this machine; a remote URL sends it to that remote service.
                                Only the resulting vectors are stored in Ocean Brain&apos;s separate search database.
                            </Text>
                        </div>
                    </div>
                </section>

                <section className="surface-base flex flex-col gap-4 p-4" aria-labelledby="embedding-api-heading">
                    <div className="space-y-1">
                        <Text id="embedding-api-heading" as="h2" variant="label" weight="medium">
                            Embedding API
                        </Text>
                        <Text as="p" variant="meta" tone="secondary">
                            Use an OpenAI-compatible embeddings endpoint. Save changes before rebuilding the index.
                        </Text>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="semantic-search-base-url" className="font-medium text-fg-tertiary">
                                API base URL
                            </Label>
                            <Input
                                id="semantic-search-base-url"
                                inputMode="url"
                                placeholder="http://127.0.0.1:1234/v1"
                                value={form.baseUrl}
                                disabled={!hasInitialized || isIndexing}
                                onChange={(event) => updateForm('baseUrl', event.target.value)}
                            />
                            <Text as="p" variant="meta" tone="tertiary">
                                From Docker, a host LM Studio server is usually at
                                {' http://host.docker.internal:1234/v1'}.
                            </Text>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="semantic-search-model" className="font-medium text-fg-tertiary">
                                Model
                            </Label>
                            <Input
                                id="semantic-search-model"
                                placeholder="text-embedding-qwen3-embedding-0.6b"
                                value={form.model}
                                disabled={!hasInitialized || isIndexing}
                                onChange={(event) => updateForm('model', event.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="semantic-search-instruction" className="font-medium text-fg-tertiary">
                            Query instruction
                        </Label>
                        <Textarea
                            id="semantic-search-instruction"
                            rows={3}
                            value={form.queryInstruction}
                            disabled={!hasInitialized || isIndexing}
                            onChange={(event) => updateForm('queryInstruction', event.target.value)}
                        />
                        <Text as="p" variant="meta" tone="tertiary">
                            This instruction is added only to search queries, not to stored note chunks.
                        </Text>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2 border-t border-border-subtle pt-4">
                        <Button
                            type="button"
                            variant="subtle"
                            onClick={() => connectionMutation.mutate(form)}
                            isLoading={connectionMutation.isPending}
                            disabled={!hasConnectionFields || isIndexing}
                        >
                            Test connection
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            onClick={() => saveMutation.mutate(form)}
                            isLoading={saveMutation.isPending}
                            disabled={!hasInitialized || !isDirty || isIndexing}
                        >
                            Save settings
                        </Button>
                    </div>
                </section>

                <section className="surface-base flex flex-col gap-4 p-4" aria-labelledby="search-index-heading">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1 basis-[28rem] space-y-1">
                            <Text id="search-index-heading" as="h2" variant="label" weight="medium">
                                Local search index
                            </Text>
                            <Text as="p" variant="meta" tone="secondary">
                                {status?.available
                                    ? `${status.noteCount} notes · ${status.chunkCount} chunks · ${status.dimensions ?? 0} dimensions`
                                    : 'Keyword search works without this index.'}
                            </Text>
                            <Text as="p" variant="meta" tone="tertiary">
                                Last built: {formatIndexedAt(status?.indexedAt ?? null)}
                            </Text>
                        </div>
                        <Button
                            type="button"
                            variant="primary"
                            onClick={() => reindexMutation.mutate()}
                            isLoading={reindexMutation.isPending}
                            disabled={!canBuildIndex}
                        >
                            <Icon.Refresh className="h-4 w-4" />
                            Build search index
                        </Button>
                    </div>

                    {isDirty && (
                        <Text as="p" variant="meta" tone="tertiary">
                            Save these settings before building the index.
                        </Text>
                    )}

                    {isIndexing && (
                        <div className="space-y-2" aria-live="polite">
                            <div className="flex items-center justify-between gap-3">
                                <Text as="span" variant="meta" weight="medium" tone="secondary">
                                    Building embeddings
                                </Text>
                                <Text as="span" variant="meta" tone="tertiary">
                                    {progress && progress.totalChunks > 0
                                        ? `${progress.processedChunks} / ${progress.totalChunks} chunks`
                                        : 'Preparing notes…'}
                                </Text>
                            </div>
                            <Progress
                                value={progress?.processedChunks ?? 0}
                                max={Math.max(progress?.totalChunks ?? 0, 1)}
                            />
                        </div>
                    )}

                    {status?.needsReindex && !isIndexing && status.phase !== 'error' && (
                        <Text as="p" variant="meta" tone="tertiary">
                            Build the index once to activate meaning search for this model and instruction.
                        </Text>
                    )}

                    {status?.error && (
                        <div className="rounded-[14px] border border-border-error bg-accent-soft-danger/40 px-3.5 py-3">
                            <Text as="p" variant="meta" tone="error" className="leading-relaxed">
                                {status.error}
                            </Text>
                        </div>
                    )}

                    {statusQueryError && (
                        <Text as="p" variant="meta" tone="error">
                            {getRequestErrorMessage(statusQueryError, 'Could not load search settings.')}
                        </Text>
                    )}
                </section>
            </div>
        </PageLayout>
    );
};

export default SearchSetting;
