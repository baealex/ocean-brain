import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
    fetchImportContext,
    type ImportContext,
    type ImportMapping,
    trashImportedNotes,
} from '~/apis/markdown-import.api';
import * as Icon from '~/components/icon';
import { Badge, Callout, PageLayout, Progress } from '~/components/shared';
import { Button, Checkbox, Label, Select, SelectItem, Text, useConfirm } from '~/components/ui';
import { IS_LOCAL_ONLY_DEMO_MODE } from '~/modules/demo-mode';
import {
    analyzeImport,
    type ImportFile,
    type ImportIssue,
    type ImportOptions,
    type PropertyType,
} from '~/modules/markdown-import';
import { readImportFiles } from '~/modules/markdown-import/files';
import { type ImportResult, runMarkdownImport } from '~/modules/markdown-import/run';
import { queryKeys } from '~/modules/query-key-factory';
import { NOTE_ROUTE } from '~/modules/url';
import { useWorkspace } from '~/store/workspace';
import { describeImportIssue } from './import-issues';

const RECOVERY_KEY = 'ocean-brain:markdown-import-result';
let inMemoryResult: ImportResult | undefined;
let compactRecovery = false;
const readRecovery = (): ImportResult | undefined => {
    try {
        const raw = sessionStorage.getItem(RECOVERY_KEY);
        if (!raw) {
            inMemoryResult = undefined;
            compactRecovery = false;
            return undefined;
        }
        const value = JSON.parse(raw);
        if (value?.token === inMemoryResult?.token) return inMemoryResult;
        return value &&
            typeof value.token === 'string' &&
            value.ids &&
            typeof value.ids === 'object' &&
            Array.isArray(value.issues) &&
            typeof value.saved === 'number' &&
            typeof value.workspaceId === 'string'
            ? value
            : undefined;
    } catch {
        return inMemoryResult;
    }
};
const downloadReport = (value: unknown) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'markdown-import-report.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
};

const plural = (count: number, noun: string) => `${count} ${count === 1 ? noun : `${noun}s`}`;

const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
    text: 'Text',
    url: 'URL',
    number: 'Number',
    date: 'Date',
    boolean: 'Boolean',
    select: 'Select',
};
const propertyTypeLabel = (type: string) => PROPERTY_TYPE_LABELS[type as PropertyType] ?? type;

const disclosureClassName = 'group rounded-[12px] border border-border-subtle bg-muted';
const summaryClassName =
    'flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 marker:hidden [&::-webkit-details-marker]:hidden';
const disclosureIconClassName = 'h-4 w-4 shrink-0 text-fg-tertiary transition-transform group-open:rotate-180';
const fieldLabelClassName = 'font-medium text-fg-tertiary';

function StepSection({
    step,
    id,
    title,
    description,
    children,
}: {
    step: number;
    id: string;
    title: string;
    description?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="surface-base flex flex-col gap-4 p-4" aria-labelledby={id}>
            <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-fg-secondary">
                    {step}
                </div>
                <div className="min-w-0 space-y-1">
                    <Text id={id} as="h2" variant="subheading" weight="semibold">
                        {title}
                    </Text>
                    {description && (
                        <Text as="p" variant="meta" tone="secondary" className="leading-relaxed">
                            {description}
                        </Text>
                    )}
                </div>
            </div>
            <div className="ml-0 flex flex-col gap-4 sm:ml-10">{children}</div>
        </section>
    );
}

/** A transparent native input covers the card so clicks, keyboard focus and folder drops reach the picker. */
function SourceCard({
    id,
    icon,
    title,
    description,
    disabled,
    folder,
    onSelect,
}: {
    id: string;
    icon: ReactNode;
    title: string;
    description: ReactNode;
    disabled: boolean;
    folder?: boolean;
    onSelect: (files: File[]) => void;
}) {
    return (
        <div className="relative">
            <input
                aria-label={title}
                aria-describedby={`${id}-description`}
                type="file"
                multiple={folder}
                accept={folder ? undefined : '.zip'}
                {...(folder ? { webkitdirectory: '', directory: '' } : {})}
                disabled={disabled}
                className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                onChange={(event) => {
                    if (event.target.files?.length) onSelect(Array.from(event.target.files));
                    event.target.value = '';
                }}
            />
            <div
                aria-hidden="true"
                className="surface-base flex h-full items-start gap-3 px-4 py-3.5 transition-colors peer-hover:bg-hover-subtle peer-focus-visible:border-border-focus peer-focus-visible:ring-2 peer-focus-visible:ring-border-focus peer-disabled:opacity-50"
            >
                <span className="mt-0.5 shrink-0 text-fg-secondary">{icon}</span>
                <div className="min-w-0 space-y-1">
                    <Text as="span" weight="medium" className="block">
                        {title}
                    </Text>
                    <Text
                        id={`${id}-description`}
                        as="span"
                        variant="meta"
                        tone="secondary"
                        className="block leading-relaxed"
                    >
                        {description}
                    </Text>
                </div>
            </div>
        </div>
    );
}

function Issues({ issues }: { issues: ImportIssue[] }) {
    const groups = new Map<string, ImportIssue[]>();
    for (const issue of issues) {
        const group = groups.get(issue.kind) ?? [];
        group.push(issue);
        groups.set(issue.kind, group);
    }
    const [expanded, setExpanded] = useState<Record<string, number>>({});
    return (
        <div role="group" aria-label="Import details" className="flex flex-col gap-2">
            <Text as="h3" weight="medium">
                Dropped and unimported items ({issues.length})
            </Text>
            {issues.length === 0 ? (
                <Text as="p" variant="meta" tone="secondary">
                    Nothing was dropped or left unimported.
                </Text>
            ) : (
                <Text as="p" variant="meta" tone="tertiary">
                    Open a group to see each item. The downloaded report keeps the full list.
                </Text>
            )}
            {[...groups].map(([kind, entries]) => {
                const description = describeImportIssue(kind);
                const limit = expanded[kind] ?? 50;
                return (
                    <details key={kind} className={disclosureClassName}>
                        <summary className={summaryClassName}>
                            <Text as="span" variant="meta" weight="medium" tone="secondary">
                                {description.label} ({entries.length})
                            </Text>
                            <Icon.ChevronDown className={disclosureIconClassName} aria-hidden="true" />
                        </summary>
                        <div className="flex flex-col gap-2 border-t border-border-subtle px-3 py-3">
                            <Text as="p" variant="meta" tone="tertiary">
                                {description.description}
                            </Text>
                            <ul className="flex flex-col gap-1.5 break-words">
                                {entries.slice(0, limit).map((issue, index) => (
                                    <li key={`${index}-${issue.path}`}>
                                        <Text as="span" variant="meta" weight="medium">
                                            {issue.path}
                                        </Text>
                                        <Text as="span" variant="meta" tone="secondary">
                                            {issue.value && issue.value !== issue.path ? ` ${issue.value}` : ''} —{' '}
                                            {issue.reason}
                                        </Text>
                                    </li>
                                ))}
                            </ul>
                            {entries.length > limit && (
                                <Button
                                    variant="subtle"
                                    size="sm"
                                    className="self-start"
                                    onClick={() => setExpanded({ ...expanded, [kind]: limit + 100 })}
                                >
                                    Show more {description.label.toLowerCase()}
                                </Button>
                            )}
                        </div>
                    </details>
                );
            })}
        </div>
    );
}

interface PropertyChoice {
    destination: string;
    valueType: PropertyType;
    listAsTags: boolean;
}

const pageHeading = (
    <div className="flex flex-wrap items-center gap-2">
        <Text as="span" variant="heading" weight="bold" tracking="tighter">
            Import Markdown
        </Text>
        <Badge name="Beta" />
    </div>
);
const pageDescription = 'Upload notes from an Obsidian vault, a Markdown folder or a Notion export on your computer.';

function ImportPage() {
    const workspace = useWorkspace();
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const [target, setTarget] = useState(workspace.workspaceId);
    const [files, setFiles] = useState<ImportFile[]>([]);
    const [sourceName, setSourceName] = useState('Markdown');
    const [options, setOptions] = useState<ImportOptions>({});
    const [choices, setChoices] = useState<Record<string, PropertyChoice>>({});
    const [stage, setStage] = useState<'select' | 'preview' | 'progress' | 'result'>(() =>
        readRecovery() ? 'result' : 'select',
    );
    const [result, setResult] = useState<ImportResult | undefined>(readRecovery);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState({ label: 'Preparing import', done: 0, total: 1 });
    const cancelled = useRef(false);
    const context = useQuery({
        queryKey: queryKeys.markdownImport.context(target),
        queryFn: () => fetchImportContext(target),
        enabled: stage === 'select' || stage === 'preview',
    });
    const plan = useMemo(() => analyzeImport(files, options), [files, options]);
    const selectedChoices = (data: ImportContext) =>
        Object.fromEntries(
            plan.properties.map((property) => [
                property.name,
                choices[property.name] ?? {
                    destination: property.defaultOff
                        ? 'discard'
                        : (data.definitions.find((definition) => definition.name === property.name)?.key ?? 'new'),
                    valueType: property.valueType,
                    listAsTags: false,
                },
            ]),
        );
    const currentChoices = context.data ? selectedChoices(context.data) : {};
    const extraDuplicates =
        context.data?.titles.filter((existing) => plan.notes.some((note) => note.title === existing.title)) ?? [];
    const newTags = plan.tags.filter((tag) => !context.data?.tags.includes(`@${tag}`));
    const activeWorkspaces = (
        workspace.workspaces.length ? workspace.workspaces : [{ id: target, name: 'Default', archivedAt: null }]
    ).filter((item) => !item.archivedAt);
    const changeChoice = (name: string, change: Partial<PropertyChoice>) => {
        const next = { ...currentChoices[name], ...change };
        setChoices({ ...choices, [name]: next });
        const nextChoices = { ...currentChoices, [name]: next };
        setOptions((old) => ({
            ...old,
            discardedProperties: Object.entries(nextChoices)
                .filter(([, choice]) => choice.destination === 'discard' && !choice.listAsTags)
                .map(([key]) => key),
            enabledToolProperties: Object.entries(nextChoices)
                .filter(([, choice]) => choice.destination !== 'discard')
                .map(([key]) => key),
            listPropertiesAsTags: Object.entries(nextChoices)
                .filter(([, choice]) => choice.listAsTags)
                .map(([key]) => key),
        }));
    };
    useEffect(() => {
        if (stage !== 'progress') return;
        const beforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
        };
        window.addEventListener('beforeunload', beforeUnload);
        return () => window.removeEventListener('beforeunload', beforeUnload);
    }, [stage]);
    const checkpoint = (value: ImportResult) => {
        inMemoryResult = value;
        setResult(value);
        if (!compactRecovery) {
            try {
                sessionStorage.setItem(RECOVERY_KEY, JSON.stringify(value));
                return;
            } catch {
                compactRecovery = true;
            }
        }
        const issueCounts: Record<string, number> = {};
        for (const issue of value.issues) issueCounts[issue.kind] = (issueCounts[issue.kind] ?? 0) + 1;
        try {
            sessionStorage.setItem(
                RECOVERY_KEY,
                JSON.stringify({
                    ...value,
                    ids: {},
                    createdCount:
                        value.createdCount ??
                        Object.keys(value.ids).filter((path) => path !== '__ocean_brain_import_index__').length,
                    issues: [],
                    issueCounts,
                    recoverySummary: true,
                }),
            );
        } catch {
            /* The complete result remains available during navigation in this tab. */
        }
    };
    const read = async (selected: File[]) => {
        setLoading(true);
        setError('');
        try {
            const entries = await readImportFiles(selected);
            setSourceName(selected[0]?.webkitRelativePath?.split('/')[0] || selected[0]?.name || 'Markdown');
            setFiles(entries);
            setOptions({});
            setChoices({});
            setStage('preview');
        } catch (error) {
            setError(error instanceof Error ? error.message : String(error));
        } finally {
            setLoading(false);
        }
    };
    const run = async () => {
        if (!context.data) return;
        setError('');
        cancelled.current = false;
        setStage('progress');
        const mappings: ImportMapping[] = plan.properties.flatMap((property) => {
            const choice = currentChoices[property.name];
            if (!choice || choice.destination === 'discard' || choice.listAsTags) return [];
            return [
                {
                    source: property.name,
                    mode: choice.destination === 'new' ? 'new' : 'existing',
                    ...(choice.destination === 'new'
                        ? {
                              name: property.name,
                              valueType: choice.valueType,
                              options: choice.valueType === 'select' ? property.values : undefined,
                          }
                        : { key: choice.destination }),
                },
            ];
        });
        try {
            const imported = await runMarkdownImport({
                plan,
                sourceName,
                workspaceId: target,
                mappings,
                cancelled: () => cancelled.current,
                onCheckpoint: checkpoint,
                onProgress: (label, done, total) => setProgress({ label, done, total }),
            });
            checkpoint(imported);
            setStage('result');
            await queryClient.invalidateQueries();
        } catch (error) {
            setError(error instanceof Error ? error.message : String(error));
            setStage(result ? 'result' : 'preview');
        }
    };
    const createdCount = result
        ? (result.createdCount ??
          Object.keys(result.ids).filter((path) => path !== '__ocean_brain_import_index__').length)
        : 0;
    const trash = async () => {
        if (!result) return;
        if (
            !(await confirm(
                `Move ${plural(createdCount, 'imported note')} to trash? You can restore them from Trash until it is emptied.`,
            ))
        )
            return;
        setLoading(true);
        setError('');
        try {
            const response = await trashImportedNotes(result.token);
            checkpoint({
                ...result,
                trashed: response.errors.length ? undefined : (result.trashed ?? 0) + response.trashed,
                issues: [
                    ...result.issues,
                    ...response.errors.map((issue) => ({
                        kind: 'trash-failed',
                        path: issue.path,
                        value: issue.path,
                        reason: issue.message,
                    })),
                ],
            });
            await queryClient.invalidateQueries();
        } catch (error) {
            setError(error instanceof Error ? error.message : String(error));
        } finally {
            setLoading(false);
        }
    };
    const startOver = () => {
        try {
            sessionStorage.removeItem(RECOVERY_KEY);
        } catch {
            /* Browser storage can be unavailable. */
        }
        inMemoryResult = undefined;
        compactRecovery = false;
        setResult(undefined);
        setFiles([]);
        setStage('select');
    };
    const duplicatesInImport = plan.duplicateTitles.reduce((sum, item) => sum + item.count - 1, 0);
    const duplicatesInWorkspace = extraDuplicates.reduce((sum, item) => sum + item.count, 0);
    const lineBreaks = options.lineBreaks ?? (plan.obsidian ? 'preserve' : 'paragraph');

    return (
        <PageLayout title="Import Markdown" heading={pageHeading} description={pageDescription}>
            <div className="flex flex-col gap-5">
                {error && (
                    <div role="alert">
                        <Callout tone="danger">{error}</Callout>
                    </div>
                )}
                {(stage === 'select' || stage === 'preview') && (
                    <StepSection
                        step={1}
                        id="import-source-heading"
                        title="Upload from your computer"
                        description="Files are read in this browser and sent to your Ocean Brain server. Each import creates new notes and never changes existing ones."
                    >
                        {activeWorkspaces.length > 1 && (
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="import-target-workspace" className={fieldLabelClassName}>
                                    Workspace
                                </Label>
                                <Select
                                    id="import-target-workspace"
                                    ariaLabel="Target workspace"
                                    value={target}
                                    onValueChange={(value) => {
                                        setTarget(value);
                                        setChoices({});
                                        setOptions((previous) => ({
                                            ...previous,
                                            discardedProperties: [],
                                            enabledToolProperties: [],
                                            listPropertiesAsTags: [],
                                        }));
                                    }}
                                    className="w-full sm:max-w-[480px]"
                                >
                                    {activeWorkspaces.map((item) => (
                                        <SelectItem key={item.id} value={item.id}>
                                            {item.name}
                                        </SelectItem>
                                    ))}
                                </Select>
                            </div>
                        )}
                        <div className="grid gap-3 md:grid-cols-2">
                            <SourceCard
                                id="import-folder"
                                folder
                                icon={<Icon.FolderOpen className="h-6 w-6" />}
                                title="Upload folder"
                                description="An Obsidian vault or a Markdown folder on this computer. Pick its top folder: for Obsidian, the one that contains .obsidian."
                                disabled={loading}
                                onSelect={(selected) => void read(selected)}
                            />
                            <SourceCard
                                id="import-zip"
                                icon={<Icon.File className="h-6 w-6" />}
                                title="Upload zip"
                                description="A Notion export (Markdown & CSV) or a zipped folder on this computer. Pick the downloaded zip as it is."
                                disabled={loading}
                                onSelect={(selected) => void read(selected)}
                            />
                        </div>
                        {loading && (
                            <Text as="p" role="status" variant="meta" tone="secondary">
                                Reading files…
                            </Text>
                        )}
                        {stage === 'preview' && !loading && (
                            <div className="flex items-center gap-2">
                                <Icon.CheckCircle className="h-4 w-4 shrink-0 text-accent-success" aria-hidden="true" />
                                <Text as="p" variant="meta" weight="medium" tone="secondary" className="min-w-0">
                                    {sourceName} · {plural(files.length, 'file')} read
                                </Text>
                            </div>
                        )}
                        {context.isError && (
                            <div role="alert" className="surface-base flex flex-wrap items-center gap-3 p-4">
                                <Text>Could not load workspace properties.</Text>
                                <Button variant="subtle" onClick={() => context.refetch()}>
                                    Retry
                                </Button>
                            </div>
                        )}
                    </StepSection>
                )}
                {stage === 'preview' && (
                    <>
                        <StepSection
                            step={2}
                            id="import-preview-heading"
                            title="Review what comes over"
                            description="Nothing is saved until you import."
                        >
                            <Text as="p" weight="medium">
                                {`${plural(plan.notes.length, 'note')} · ${plural(plan.assets.length, 'image')} · ${plural(files.length, 'selected file')}`}
                            </Text>
                            {duplicatesInImport + duplicatesInWorkspace > 0 && (
                                <details className={disclosureClassName}>
                                    <summary className={summaryClassName}>
                                        <Text as="span" variant="meta" weight="medium" tone="secondary">
                                            Repeated titles: {duplicatesInImport} in this import ·{' '}
                                            {duplicatesInWorkspace} already in the workspace
                                        </Text>
                                        <Icon.ChevronDown className={disclosureIconClassName} aria-hidden="true" />
                                    </summary>
                                    <div className="flex flex-col gap-2 border-t border-border-subtle px-3 py-3">
                                        <Text as="p" variant="meta" tone="tertiary">
                                            Each one becomes a separate note with the same title.
                                        </Text>
                                        <ul className="flex flex-col gap-1 break-words">
                                            {[...plan.duplicateTitles, ...extraDuplicates].map((item, index) => (
                                                <li key={`${item.title}-${index}`}>
                                                    <Text as="span" variant="meta">
                                                        {item.title} ({item.count})
                                                    </Text>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </details>
                            )}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="import-line-breaks" className={fieldLabelClassName}>
                                    Line breaks
                                </Label>
                                <Select
                                    id="import-line-breaks"
                                    ariaLabel="Line breaks"
                                    value={lineBreaks}
                                    onValueChange={(value) =>
                                        setOptions({
                                            ...options,
                                            lineBreaks: value as ImportOptions['lineBreaks'],
                                        })
                                    }
                                    className="w-full sm:max-w-[480px]"
                                >
                                    <SelectItem value="preserve">Keep single line breaks</SelectItem>
                                    <SelectItem value="paragraph">Join single line breaks into paragraphs</SelectItem>
                                </Select>
                                <Text as="p" variant="meta" tone="tertiary">
                                    Obsidian shows a single line break as a new line. Most other Markdown apps join it
                                    into the paragraph.
                                </Text>
                            </div>
                            {plan.tags.length > 0 && (
                                <div role="group" aria-label="New tags" className="flex flex-col gap-2">
                                    <Text as="h3" weight="medium">
                                        Tags
                                    </Text>
                                    <Text as="p" variant="meta" tone="tertiary">
                                        Clear a tag to leave it out. {plural(newTags.length, 'tag')} will be new in this
                                        workspace.
                                    </Text>
                                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                                        {plan.tags.map((tag) => (
                                            <div key={tag} className="inline-flex items-center gap-2">
                                                <Checkbox
                                                    id={`import-tag-${tag}`}
                                                    size="sm"
                                                    aria-label={`${tag}${newTags.includes(tag) ? ' (new)' : ''}`}
                                                    checked={!options.disabledTags?.includes(tag)}
                                                    onChange={(event) =>
                                                        setOptions({
                                                            ...options,
                                                            disabledTags: event.target.checked
                                                                ? options.disabledTags?.filter((item) => item !== tag)
                                                                : [...(options.disabledTags ?? []), tag],
                                                        })
                                                    }
                                                />
                                                <label htmlFor={`import-tag-${tag}`} className="min-w-0 cursor-pointer">
                                                    <Text as="span" variant="meta" weight="medium" tone="secondary">
                                                        {tag}
                                                    </Text>
                                                    {newTags.includes(tag) && (
                                                        <Text as="span" variant="meta" tone="tertiary">
                                                            {' '}
                                                            (new)
                                                        </Text>
                                                    )}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {plan.properties.length > 0 && (
                                <div role="group" aria-label="Property mapping" className="flex flex-col gap-2">
                                    <Text as="h3" weight="medium">
                                        Properties
                                    </Text>
                                    <Text as="p" variant="meta" tone="tertiary">
                                        Choose where each metadata field goes.
                                    </Text>
                                    {plan.properties.map((property, index) => {
                                        const choice = currentChoices[property.name];
                                        return (
                                            <div
                                                key={property.name}
                                                className="flex flex-col gap-3 rounded-[12px] border border-border-subtle p-3 sm:flex-row sm:items-start sm:justify-between"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <Text as="p" weight="medium" className="break-words">
                                                        {property.name}
                                                    </Text>
                                                    <Text as="p" variant="meta" tone="tertiary" className="break-words">
                                                        {property.values.slice(0, 5).join(', ')}
                                                    </Text>
                                                    {property.list && (
                                                        <div className="mt-2 flex items-center gap-2">
                                                            <Checkbox
                                                                id={`import-list-${index}`}
                                                                size="sm"
                                                                aria-label={`Import ${property.name} list as tags`}
                                                                checked={choice?.listAsTags ?? false}
                                                                onChange={(event) =>
                                                                    changeChoice(property.name, {
                                                                        listAsTags: event.target.checked,
                                                                    })
                                                                }
                                                            />
                                                            <label
                                                                htmlFor={`import-list-${index}`}
                                                                className="min-w-0 cursor-pointer"
                                                            >
                                                                <Text as="span" variant="meta" tone="secondary">
                                                                    Import the list as tags instead of comma-separated
                                                                    text
                                                                </Text>
                                                            </label>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex w-full flex-col gap-3 sm:w-[300px] sm:shrink-0">
                                                    <div className="flex flex-col gap-1.5">
                                                        <Label
                                                            htmlFor={`import-property-${index}`}
                                                            className={fieldLabelClassName}
                                                        >
                                                            Bring in as
                                                        </Label>
                                                        <Select
                                                            id={`import-property-${index}`}
                                                            ariaLabel={`Map ${property.name}`}
                                                            value={choice?.destination ?? 'new'}
                                                            onValueChange={(value) =>
                                                                changeChoice(property.name, { destination: value })
                                                            }
                                                            className="w-full"
                                                        >
                                                            <SelectItem value="new">Create property</SelectItem>
                                                            <SelectItem value="discard">Discard</SelectItem>
                                                            {context.data?.definitions.map((definition) => (
                                                                <SelectItem key={definition.key} value={definition.key}>
                                                                    {definition.name} (
                                                                    {propertyTypeLabel(definition.valueType)})
                                                                </SelectItem>
                                                            ))}
                                                        </Select>
                                                    </div>
                                                    {choice?.destination === 'new' && (
                                                        <div className="flex flex-col gap-1.5">
                                                            <Label
                                                                htmlFor={`import-property-type-${index}`}
                                                                className={fieldLabelClassName}
                                                            >
                                                                Type
                                                            </Label>
                                                            <Select
                                                                id={`import-property-type-${index}`}
                                                                ariaLabel={`Type of ${property.name}`}
                                                                value={choice.valueType ?? property.valueType}
                                                                onValueChange={(value) =>
                                                                    changeChoice(property.name, {
                                                                        valueType: value as PropertyType,
                                                                    })
                                                                }
                                                                className="w-full"
                                                            >
                                                                {Object.entries(PROPERTY_TYPE_LABELS).map(
                                                                    ([type, label]) => (
                                                                        <SelectItem key={type} value={type}>
                                                                            {label}
                                                                        </SelectItem>
                                                                    ),
                                                                )}
                                                            </Select>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <Issues issues={plan.issues} />
                        </StepSection>
                        <StepSection
                            step={3}
                            id="import-run-heading"
                            title="Import"
                            description="Keep this page open while importing. You can move everything from this import to trash afterwards."
                        >
                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                <Button
                                    variant="primary"
                                    disabled={!plan.notes.length || !context.data || context.isFetching || loading}
                                    onClick={run}
                                >
                                    <Icon.Upload className="h-4 w-4" />
                                    Import {plural(plan.notes.length, 'note')}
                                </Button>
                                <Button
                                    variant="subtle"
                                    onClick={() => downloadReport({ issues: plan.issues, syntax: plan.syntax })}
                                >
                                    <Icon.Download className="h-4 w-4" />
                                    Download preview report
                                </Button>
                            </div>
                        </StepSection>
                    </>
                )}
                {stage === 'progress' && (
                    <section
                        aria-live="polite"
                        aria-labelledby="import-progress-heading"
                        className="surface-base flex flex-col gap-3 p-4"
                    >
                        <Text id="import-progress-heading" as="h2" variant="subheading" weight="semibold">
                            {progress.label}
                        </Text>
                        <Progress
                            aria-label="Import progress"
                            value={progress.done}
                            max={Math.max(1, progress.total)}
                        />
                        <Text as="p" variant="meta" tone="secondary">
                            {progress.done} / {progress.total} · Keep this page open until the import finishes.
                        </Text>
                        <Button
                            variant="subtle"
                            className="self-start"
                            onClick={() => {
                                cancelled.current = true;
                            }}
                        >
                            Cancel import
                        </Button>
                    </section>
                )}
                {stage === 'result' && result && (
                    <>
                        <section aria-label="Import result" className="surface-base flex flex-col gap-4 p-4">
                            <div className="flex items-start gap-3">
                                {result.trashed === undefined ? (
                                    <Icon.CheckCircle
                                        className="mt-0.5 h-6 w-6 shrink-0 text-accent-success"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <Icon.TrashCan
                                        className="mt-0.5 h-6 w-6 shrink-0 text-fg-secondary"
                                        aria-hidden="true"
                                    />
                                )}
                                <div className="min-w-0 space-y-1">
                                    <Text as="h2" variant="subheading" weight="semibold">
                                        {result.trashed === undefined
                                            ? 'Import finished'
                                            : 'Imported notes moved to trash'}
                                    </Text>
                                    <Text as="p" variant="meta" tone="secondary">
                                        {result.saved >= createdCount
                                            ? `${plural(createdCount, 'note')} imported`
                                            : `${plural(createdCount, 'note')} created · ${result.saved} saved with content`}
                                    </Text>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 sm:ml-9 sm:flex-row sm:flex-wrap">
                                {result.trashed === undefined && result.indexId && (
                                    <Button asChild variant="primary">
                                        <Link
                                            to={NOTE_ROUTE}
                                            params={{ id: result.indexId }}
                                            search={{ workspace: result.workspaceId }}
                                        >
                                            <Icon.FileNote className="h-4 w-4" />
                                            Open contents note
                                        </Link>
                                    </Button>
                                )}
                                <Button
                                    variant="subtle"
                                    onClick={() => downloadReport({ ...result, syntax: result.syntax ?? plan.syntax })}
                                >
                                    <Icon.Download className="h-4 w-4" />
                                    Download import report
                                </Button>
                                <Button variant="subtle" onClick={startOver}>
                                    Start another import
                                </Button>
                            </div>
                            <div className="sm:ml-9">
                                {result.recoverySummary ? (
                                    <div
                                        role="group"
                                        aria-label="Recovered import summary"
                                        className="flex flex-col gap-2"
                                    >
                                        <Text as="p" role="status" variant="meta" tone="secondary">
                                            Detailed item lists could not be restored. Counts and trash-all are still
                                            available. Use the downloaded report for the full list.
                                        </Text>
                                        <ul className="flex flex-col gap-2">
                                            {Object.entries(result.issueCounts ?? {}).map(([kind, count]) => (
                                                <li key={kind}>
                                                    <Text as="p" variant="meta" weight="medium">
                                                        {describeImportIssue(kind).label} ({count})
                                                    </Text>
                                                    <Text as="p" variant="meta" tone="tertiary">
                                                        {describeImportIssue(kind).description}
                                                    </Text>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : (
                                    <Issues issues={result.issues} />
                                )}
                                {compactRecovery && !result.recoverySummary && (
                                    <Text as="p" variant="meta" tone="tertiary" className="mt-2">
                                        Download the report to keep the full item lists through a page refresh.
                                    </Text>
                                )}
                            </div>
                        </section>
                        {result.trashed === undefined && (
                            <section
                                aria-labelledby="import-undo-heading"
                                className="surface-base flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="min-w-0 space-y-1">
                                    <Text id="import-undo-heading" as="h2" weight="medium">
                                        Undo this import
                                    </Text>
                                    <Text as="p" variant="meta" tone="secondary" className="leading-relaxed">
                                        Available for 24 hours while this server keeps running. Uploaded images and new
                                        properties stay in Settings.
                                    </Text>
                                </div>
                                <Button variant="subtle" disabled={loading} onClick={trash} className="shrink-0">
                                    <Icon.TrashCan className="h-4 w-4" />
                                    Move all imported notes to trash
                                </Button>
                            </section>
                        )}
                    </>
                )}
            </div>
        </PageLayout>
    );
}

export default function MarkdownImportPage() {
    if (IS_LOCAL_ONLY_DEMO_MODE)
        return (
            <PageLayout title="Import Markdown" heading={pageHeading} description={pageDescription}>
                <Callout>Import is available in your own Ocean Brain workspace.</Callout>
            </PageLayout>
        );
    return <ImportPage />;
}
