import { useEffect, useState } from 'react';
import { ModalActionRow } from '~/components/shared';
import {
    Button,
    Input,
    Label,
    Modal,
    Select,
    SelectItem,
    Text,
    Textarea,
    ToggleGroup,
    ToggleGroupItem,
} from '~/components/ui';
import type { Tag } from '~/models/tag.model';
import type { ViewSection, ViewTagMatchMode } from '~/models/view.model';
import { getViewTagMatchLabel, normalizeViewTagNames } from '~/modules/view-dashboard';

interface ViewSectionDialogProps {
    open: boolean;
    mode: 'create' | 'edit';
    initialSection?: ViewSection | null;
    availableTags: Pick<Tag, 'id' | 'name'>[];
    isTagsLoading?: boolean;
    onClose: () => void;
    onSubmit: (draft: { title: string; tagNames: string[]; mode: ViewTagMatchMode; limit: number }) => void;
}

const getInitialLimitValue = (section?: ViewSection | null) => String(section?.limit ?? 5);
const getInitialModeValue = (section?: ViewSection | null): ViewTagMatchMode => section?.mode ?? 'and';
const getInitialTagsValue = (section?: ViewSection | null) => (section ? section.tagNames.join(', ') : '');
const getInitialTitleValue = (section?: ViewSection | null) => section?.title ?? '';

export default function ViewSectionDialog({
    open,
    mode,
    initialSection = null,
    availableTags,
    isTagsLoading = false,
    onClose,
    onSubmit,
}: ViewSectionDialogProps) {
    const [title, setTitle] = useState(getInitialTitleValue(initialSection));
    const [tagInput, setTagInput] = useState(getInitialTagsValue(initialSection));
    const [matchMode, setMatchMode] = useState<ViewTagMatchMode>(getInitialModeValue(initialSection));
    const [limit, setLimit] = useState(getInitialLimitValue(initialSection));
    const [tagError, setTagError] = useState('');

    useEffect(() => {
        if (!open) {
            return;
        }

        setTitle(getInitialTitleValue(initialSection));
        setTagInput(getInitialTagsValue(initialSection));
        setMatchMode(getInitialModeValue(initialSection));
        setLimit(getInitialLimitValue(initialSection));
        setTagError('');
    }, [initialSection, open]);

    const selectedTagNames = normalizeViewTagNames([tagInput]);

    const toggleTagName = (tagName: string) => {
        const nextTagNames = selectedTagNames.includes(tagName)
            ? selectedTagNames.filter((value) => value !== tagName)
            : [...selectedTagNames, tagName];

        setTagInput(nextTagNames.join(', '));
        setTagError('');
    };

    return (
        <Modal isOpen={open} onClose={onClose} variant="form" className="sm:max-w-[640px]">
            <Modal.Header title={mode === 'create' ? 'Create section' : 'Edit section'} onClose={onClose} />
            <Modal.Body>
                <form
                    id="view-section-form"
                    className="flex flex-col gap-5"
                    onSubmit={(event) => {
                        event.preventDefault();

                        const tagNames = normalizeViewTagNames([tagInput]);

                        if (tagNames.length === 0) {
                            setTagError('Add at least one tag for this section.');
                            return;
                        }

                        onSubmit({
                            title,
                            tagNames,
                            mode: matchMode,
                            limit: Number(limit),
                        });
                    }}
                >
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="view-section-title" size="md">
                                Section title
                            </Label>
                            <Input
                                id="view-section-title"
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                placeholder="Agent work"
                                autoFocus
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="view-section-limit" size="md">
                                Max notes
                            </Label>
                            <Select value={limit} onValueChange={setLimit}>
                                <SelectItem value="3">3 notes</SelectItem>
                                <SelectItem value="5">5 notes</SelectItem>
                                <SelectItem value="8">8 notes</SelectItem>
                                <SelectItem value="10">10 notes</SelectItem>
                                <SelectItem value="12">12 notes</SelectItem>
                            </Select>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="view-section-tags" size="md">
                            Tags
                        </Label>
                        <Textarea
                            id="view-section-tags"
                            value={tagInput}
                            onChange={(event) => {
                                setTagInput(event.target.value);
                                setTagError('');
                            }}
                            placeholder="@OceanBrain, @todo"
                            size="sm"
                        />
                        <Text
                            as="p"
                            variant="meta"
                            tone={tagError ? 'default' : 'tertiary'}
                            className={tagError ? 'text-fg-error' : undefined}
                        >
                            {tagError || 'Separate tags with commas. Plain words become @tags automatically.'}
                        </Text>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label size="md">Tag match</Label>
                        <ToggleGroup
                            type="single"
                            value={matchMode}
                            onValueChange={(value) => {
                                if (value === 'and' || value === 'or') {
                                    setMatchMode(value);
                                }
                            }}
                            variant="quiet"
                            size="sm"
                            className="self-start"
                        >
                            <ToggleGroupItem value="and" aria-label={getViewTagMatchLabel('and')}>
                                Match all
                            </ToggleGroupItem>
                            <ToggleGroupItem value="or" aria-label={getViewTagMatchLabel('or')}>
                                Match any
                            </ToggleGroupItem>
                        </ToggleGroup>
                    </div>

                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-3">
                            <Label size="md">Existing tags</Label>
                            <Text as="span" variant="meta" tone="tertiary">
                                {isTagsLoading ? 'Loading tag catalog...' : `${availableTags.length} tags available`}
                            </Text>
                        </div>
                        {availableTags.length > 0 ? (
                            <div className="max-h-44 overflow-y-auto rounded-[18px] border border-border-subtle bg-hover-subtle/60 p-3">
                                <div className="flex flex-wrap gap-2">
                                    {availableTags.map((tag) => {
                                        const isSelected = selectedTagNames.includes(tag.name);

                                        return (
                                            <button
                                                key={tag.id}
                                                type="button"
                                                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                                                    isSelected
                                                        ? 'border-border-secondary bg-elevated text-fg-default'
                                                        : 'border-border-subtle bg-transparent text-fg-secondary hover:border-border-secondary hover:bg-elevated hover:text-fg-default'
                                                }`}
                                                onClick={() => toggleTagName(tag.name)}
                                            >
                                                {tag.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <Text as="p" variant="meta" tone="tertiary">
                                No tags yet. You can still type tag names manually.
                            </Text>
                        )}
                    </div>
                </form>
            </Modal.Body>
            <Modal.Footer>
                <ModalActionRow>
                    <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" size="sm" form="view-section-form">
                        {mode === 'create' ? 'Create section' : 'Save section'}
                    </Button>
                </ModalActionRow>
            </Modal.Footer>
        </Modal>
    );
}
