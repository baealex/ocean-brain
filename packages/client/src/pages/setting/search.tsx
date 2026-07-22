import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import {
    type EmbeddingModelDescriptor,
    fetchSearchAdminStatus,
    fetchSemanticSearchModels,
    type SemanticSearchConfig,
    type SemanticSearchPhase,
    saveSemanticSearchConfig,
    startSemanticSearchReindex,
    testSemanticSearchConnection,
} from '~/apis/search-admin.api';
import * as Icon from '~/components/icon';
import { Button, PageLayout, Progress } from '~/components/shared';
import { Input, Label, Select, SelectItem, Switch, Text, Textarea, useToast } from '~/components/ui';
import { queryKeys } from '~/modules/query-key-factory';

const EMPTY_CONFIG: SemanticSearchConfig = {
    enabled: false,
    baseUrl: '',
    model: '',
    queryInstruction: '',
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

const normalizeBaseUrl = (baseUrl: string) => baseUrl.trim().replace(/\/+$/, '');

const looksLikeEmbeddingModel = (modelId: string) => /(^|[-_/])(embed|embedding|bge|e5|gte)([-_/.]|$)/i.test(modelId);

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
    const [availableModels, setAvailableModels] = useState<EmbeddingModelDescriptor[]>([]);
    const [discoveredBaseUrl, setDiscoveredBaseUrl] = useState('');
    const [testedConnectionKey, setTestedConnectionKey] = useState('');

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

    const modelsMutation = useMutation({
        mutationFn: fetchSemanticSearchModels,
        onSuccess: ({ models }, requestedBaseUrl) => {
            const normalizedRequestedUrl = normalizeBaseUrl(requestedBaseUrl);
            setAvailableModels(models);
            setDiscoveredBaseUrl(normalizedRequestedUrl);
            setForm((current) => {
                if (normalizeBaseUrl(current.baseUrl) !== normalizedRequestedUrl) {
                    return current;
                }

                if (models.some((model) => model.id === current.model)) {
                    return current;
                }

                const likelyModels = models.filter((model) => model.likelyEmbedding);
                const automaticModel =
                    likelyModels.length === 1 ? likelyModels[0] : models.length === 1 ? models[0] : null;
                return automaticModel ? { ...current, model: automaticModel.id } : current;
            });
        },
    });

    const connectionMutation = useMutation({
        mutationFn: testSemanticSearchConnection,
        onSuccess: ({ dimensions, model }, testedConfig) => {
            setTestedConnectionKey(`${normalizeBaseUrl(testedConfig.baseUrl)}::${testedConfig.model.trim()}`);
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

    const normalizedFormBaseUrl = normalizeBaseUrl(form.baseUrl);
    const currentConnectionKey = `${normalizedFormBaseUrl}::${form.model.trim()}`;
    const isDirty = Boolean(status && !configsMatch(form, status.config));
    const isIndexing = status?.phase === 'indexing';
    const isCheckingProvider = modelsMutation.isPending || connectionMutation.isPending;
    const hasConnectionFields = Boolean(normalizedFormBaseUrl && form.model.trim());
    const hasDiscoveredCurrentUrl = Boolean(availableModels.length) && discoveredBaseUrl === normalizedFormBaseUrl;
    const isCurrentConnectionTested = hasConnectionFields && testedConnectionKey === currentConnectionKey;
    const isSavedEnabledConnection = Boolean(
        status?.config.enabled &&
            normalizeBaseUrl(status.config.baseUrl) === normalizedFormBaseUrl &&
            status.config.model.trim() === form.model.trim(),
    );
    const canEnableMeaningSearch = hasConnectionFields && (isCurrentConnectionTested || isSavedEnabledConnection);
    const canSave = Boolean(
        hasInitialized && isDirty && !isIndexing && !isCheckingProvider && (!form.enabled || canEnableMeaningSearch),
    );
    const canBuildIndex = Boolean(status?.config.enabled && !isDirty && !isIndexing);
    const progress = status?.progress;
    const phaseLabel = status ? phaseLabels[status.phase] : isLoading ? 'Loading' : 'Unavailable';
    const queryInstructionLabel = form.queryInstruction.trim() ? 'Customized' : 'Optional';

    const modelOptions = useMemo(() => {
        const models = [...availableModels];
        const currentModel = form.model.trim();
        if (currentModel && !models.some((model) => model.id === currentModel)) {
            models.unshift({ id: currentModel, likelyEmbedding: looksLikeEmbeddingModel(currentModel) });
        }
        return models;
    }, [availableModels, form.model]);

    const updateForm = <Key extends keyof SemanticSearchConfig>(key: Key, value: SemanticSearchConfig[Key]) => {
        setForm((current) => ({ ...current, [key]: value }));
    };

    const handleBaseUrlChange = (baseUrl: string) => {
        const connectionChanged = normalizedFormBaseUrl !== normalizeBaseUrl(baseUrl);
        setForm((current) => ({ ...current, baseUrl, model: connectionChanged ? '' : current.model }));
        if (!connectionChanged) {
            return;
        }

        setAvailableModels([]);
        setDiscoveredBaseUrl('');
        setTestedConnectionKey('');
        modelsMutation.reset();
        connectionMutation.reset();
    };

    const handleFindModels = () => {
        const baseUrl = normalizeBaseUrl(form.baseUrl);
        setForm((current) => ({ ...current, baseUrl }));
        setTestedConnectionKey('');
        connectionMutation.reset();
        modelsMutation.mutate(baseUrl);
    };

    const handleModelChange = (model: string) => {
        updateForm('model', model);
        setTestedConnectionKey('');
        connectionMutation.reset();
    };

    const handleMeaningSearchChange = (enabled: boolean) => {
        if (!enabled || canEnableMeaningSearch) {
            updateForm('enabled', enabled);
        }
    };

    return (
        <PageLayout
            title="Search"
            variant="default"
            description="Keyword search is always available. Add an embedding API only when you want meaning-based recall."
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
                <section className="surface-base flex flex-col gap-4 p-4" aria-labelledby="embedding-api-heading">
                    <div className="flex items-start gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-fg-secondary">
                            1
                        </div>
                        <div className="min-w-0 space-y-1">
                            <Text id="embedding-api-heading" as="h2" variant="label" weight="medium">
                                Connect an embedding API
                            </Text>
                            <Text as="p" variant="meta" tone="secondary" className="leading-relaxed">
                                Enter an OpenAI-compatible base URL. Ocean Brain checks the API and asks it which models
                                are available before you choose one.
                            </Text>
                        </div>
                    </div>

                    <div className="ml-0 space-y-2 sm:ml-10">
                        <Label htmlFor="semantic-search-base-url" className="font-medium text-fg-tertiary">
                            API base URL
                        </Label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                                id="semantic-search-base-url"
                                inputMode="url"
                                placeholder="http://127.0.0.1:1234/v1"
                                value={form.baseUrl}
                                disabled={!hasInitialized || isIndexing || isCheckingProvider}
                                onChange={(event) => handleBaseUrlChange(event.target.value)}
                                className="min-w-0 flex-1"
                            />
                            <Button
                                type="button"
                                variant="subtle"
                                onClick={handleFindModels}
                                isLoading={modelsMutation.isPending}
                                disabled={!normalizedFormBaseUrl || isIndexing || connectionMutation.isPending}
                                className="w-full sm:w-auto"
                            >
                                <Icon.Search className="h-4 w-4" />
                                Find models
                            </Button>
                        </div>
                        <Text as="p" variant="meta" tone="tertiary" className="leading-relaxed">
                            If Ocean Brain runs in Docker and LM Studio runs on the host, try
                            {' http://host.docker.internal:1234/v1'}.
                        </Text>

                        {hasDiscoveredCurrentUrl && (
                            <div
                                className="flex items-start gap-2 rounded-[12px] border border-border-subtle bg-accent-soft-success px-3 py-2.5"
                                role="status"
                            >
                                <Icon.CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent-success" />
                                <Text as="p" variant="meta" className="leading-relaxed text-accent-success">
                                    API connected. Found {availableModels.length}{' '}
                                    {availableModels.length === 1 ? 'model' : 'models'}.
                                </Text>
                            </div>
                        )}

                        {modelsMutation.isError && (
                            <div className="rounded-[12px] border border-border-error bg-accent-soft-danger/40 px-3 py-2.5">
                                <Text as="p" variant="meta" tone="error" className="leading-relaxed">
                                    {getRequestErrorMessage(
                                        modelsMutation.error,
                                        'Could not list models from this API.',
                                    )}
                                </Text>
                            </div>
                        )}
                    </div>
                </section>

                <section className="surface-base flex flex-col gap-4 p-4" aria-labelledby="embedding-model-heading">
                    <div className="flex items-start gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-fg-secondary">
                            2
                        </div>
                        <div className="min-w-0 space-y-1">
                            <Text id="embedding-model-heading" as="h2" variant="label" weight="medium">
                                Choose and test a model
                            </Text>
                            <Text as="p" variant="meta" tone="secondary" className="leading-relaxed">
                                Models that look suitable for embeddings appear first. The final test sends a short
                                sample and verifies that the API returns a vector.
                            </Text>
                        </div>
                    </div>

                    <div className="ml-0 space-y-3 sm:ml-10">
                        <div className="space-y-2">
                            <Label htmlFor="semantic-search-model" className="font-medium text-fg-tertiary">
                                Embedding model
                            </Label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Select
                                    id="semantic-search-model"
                                    ariaLabel="Embedding model"
                                    value={form.model}
                                    placeholder={modelsMutation.isPending ? 'Loading models…' : 'Find models first'}
                                    disabled={
                                        !modelOptions.length || !hasInitialized || isIndexing || isCheckingProvider
                                    }
                                    onValueChange={handleModelChange}
                                    className="min-w-0 flex-1"
                                >
                                    {modelOptions.map((model) => (
                                        <SelectItem key={model.id} value={model.id}>
                                            {model.id}
                                            {model.likelyEmbedding ? ' · Embedding' : ''}
                                        </SelectItem>
                                    ))}
                                </Select>
                                <Button
                                    type="button"
                                    variant="subtle"
                                    onClick={() => connectionMutation.mutate(form)}
                                    isLoading={connectionMutation.isPending}
                                    disabled={!hasConnectionFields || isIndexing || modelsMutation.isPending}
                                    className="w-full sm:w-auto"
                                >
                                    <Icon.CheckCircle className="h-4 w-4" />
                                    Test selected model
                                </Button>
                            </div>
                            {hasDiscoveredCurrentUrl && availableModels.every((model) => !model.likelyEmbedding) && (
                                <Text as="p" variant="meta" tone="tertiary" className="leading-relaxed">
                                    None of these model names clearly identifies an embedding model. Choose one only if
                                    your provider documents it as an embedding model, then run the test.
                                </Text>
                            )}
                        </div>

                        {isCurrentConnectionTested && connectionMutation.data && (
                            <div
                                className="flex items-start gap-2 rounded-[12px] border border-border-subtle bg-accent-soft-success px-3 py-2.5"
                                role="status"
                            >
                                <Icon.CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent-success" />
                                <Text as="p" variant="meta" className="leading-relaxed text-accent-success">
                                    This model works · {connectionMutation.data.dimensions} dimensions
                                </Text>
                            </div>
                        )}

                        {connectionMutation.isError && (
                            <div className="rounded-[12px] border border-border-error bg-accent-soft-danger/40 px-3 py-2.5">
                                <Text as="p" variant="meta" tone="error" className="leading-relaxed">
                                    {getRequestErrorMessage(
                                        connectionMutation.error,
                                        'Could not connect to the embedding API.',
                                    )}
                                </Text>
                            </div>
                        )}

                        <details className="group rounded-[12px] border border-border-subtle bg-muted">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 marker:hidden">
                                <Text as="span" variant="meta" weight="medium" tone="secondary">
                                    Can&apos;t find the model? Enter its ID manually
                                </Text>
                                <Icon.ChevronDown
                                    className="h-4 w-4 shrink-0 text-fg-tertiary transition-transform group-open:rotate-180"
                                    aria-hidden="true"
                                />
                            </summary>
                            <div className="space-y-2 border-t border-border-subtle px-3 py-3">
                                <Label htmlFor="semantic-search-manual-model" className="font-medium text-fg-tertiary">
                                    Model ID
                                </Label>
                                <Input
                                    id="semantic-search-manual-model"
                                    placeholder="text-embedding-qwen3-embedding-0.6b"
                                    value={form.model}
                                    disabled={!hasInitialized || isIndexing || isCheckingProvider}
                                    onChange={(event) => handleModelChange(event.target.value)}
                                />
                                <Text as="p" variant="meta" tone="tertiary">
                                    Use this fallback when a compatible API does not support model listing.
                                </Text>
                            </div>
                        </details>

                        <details className="group rounded-[12px] border border-border-subtle bg-muted">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 marker:hidden">
                                <div className="min-w-0">
                                    <Text as="span" variant="meta" weight="medium" tone="secondary">
                                        Advanced query instruction
                                    </Text>
                                    <Text as="span" variant="meta" tone="tertiary">
                                        {' · '}
                                        {queryInstructionLabel}
                                    </Text>
                                </div>
                                <Icon.ChevronDown
                                    className="h-4 w-4 shrink-0 text-fg-tertiary transition-transform group-open:rotate-180"
                                    aria-hidden="true"
                                />
                            </summary>
                            <div className="space-y-3 border-t border-border-subtle px-3 py-3">
                                <Text as="p" variant="meta" tone="secondary" className="leading-relaxed">
                                    Leave this blank unless your embedding model documentation explicitly recommends a
                                    query instruction. Ocean Brain does not assume a language or retrieval prompt.
                                </Text>
                                <div className="space-y-2">
                                    <Label
                                        htmlFor="semantic-search-instruction"
                                        className="font-medium text-fg-tertiary"
                                    >
                                        Query instruction
                                    </Label>
                                    <Textarea
                                        id="semantic-search-instruction"
                                        rows={3}
                                        placeholder="Leave blank unless your model recommends an instruction."
                                        value={form.queryInstruction}
                                        disabled={!hasInitialized || isIndexing || isCheckingProvider}
                                        onChange={(event) => updateForm('queryInstruction', event.target.value)}
                                    />
                                </div>
                                {form.queryInstruction && (
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            disabled={isIndexing || isCheckingProvider}
                                            onClick={() => updateForm('queryInstruction', '')}
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                )}
                                <Text as="p" variant="meta" tone="tertiary" className="leading-relaxed">
                                    This is added only to the search query, never to note chunks. Changing it does not
                                    require rebuilding the index.
                                </Text>
                            </div>
                        </details>
                    </div>
                </section>

                <section className="surface-base flex flex-col gap-4 p-4" aria-labelledby="meaning-search-heading">
                    <div className="flex items-start gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-fg-secondary">
                            3
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                            <Text id="meaning-search-heading" as="h2" variant="label" weight="medium">
                                Turn on meaning search
                            </Text>
                            <Text as="p" variant="meta" tone="secondary" className="max-w-[44rem] leading-relaxed">
                                This adds Meaning and All modes to the full search page. Keyword search remains the
                                default fallback and keeps working even when this feature is off.
                            </Text>
                        </div>
                    </div>

                    <div className="ml-0 rounded-[14px] border border-border-subtle bg-muted px-3.5 py-3 sm:ml-10">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="min-w-0 space-y-1">
                                <Text as="p" variant="meta" weight="medium">
                                    Meaning search
                                </Text>
                                <Text as="p" variant="meta" tone="tertiary">
                                    {!hasConnectionFields
                                        ? 'Connect an API and choose a model first.'
                                        : !canEnableMeaningSearch && !form.enabled
                                          ? 'Test the selected model first.'
                                          : 'Ready to save and build the local index.'}
                                </Text>
                            </div>
                            <div className="flex items-center gap-3">
                                <Text as="span" variant="meta" weight="medium" tone="secondary">
                                    {form.enabled ? 'Enabled' : 'Disabled'}
                                </Text>
                                <Switch
                                    aria-label="Meaning search"
                                    checked={form.enabled}
                                    disabled={
                                        !hasInitialized ||
                                        isIndexing ||
                                        isCheckingProvider ||
                                        (!form.enabled && !canEnableMeaningSearch)
                                    }
                                    onCheckedChange={handleMeaningSearchChange}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2 border-t border-border-subtle pt-4">
                        <Button
                            type="button"
                            variant="primary"
                            onClick={() => saveMutation.mutate(form)}
                            isLoading={saveMutation.isPending}
                            disabled={!canSave}
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
                            Build the index once to activate meaning search for this model.
                        </Text>
                    )}

                    {status?.error && (
                        <div className="rounded-[14px] border border-border-error bg-accent-soft-danger/40 px-3.5 py-3">
                            <Text as="p" variant="meta" tone="error" className="leading-relaxed">
                                {status.error}
                            </Text>
                        </div>
                    )}

                    <div className="flex items-start gap-2.5 rounded-[14px] border border-border-subtle bg-muted px-3.5 py-3">
                        <Icon.Info className="mt-0.5 h-4 w-4 shrink-0 text-fg-tertiary" />
                        <Text as="p" variant="meta" tone="secondary" className="leading-relaxed">
                            Ocean Brain sends note text to the embedding API during indexing. A local LM Studio URL
                            keeps that traffic on your machine; a remote URL sends it to that service. Only the
                            resulting vectors are stored in Ocean Brain&apos;s separate search database.
                        </Text>
                    </div>

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
