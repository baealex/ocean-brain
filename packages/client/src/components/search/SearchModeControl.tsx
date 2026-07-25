import classNames from 'classnames';

import type { SearchMode } from '~/apis/search.api';
import { Text } from '~/components/ui';

const SEARCH_MODE_OPTIONS: Array<{ value: SearchMode; label: string; description: string }> = [
    {
        value: 'hybrid',
        label: 'All',
        description: 'Combines keyword matches with notes that have a similar meaning.',
    },
    {
        value: 'lexical',
        label: 'Keywords',
        description: 'Looks only for the words you typed. No embedding request is made.',
    },
    {
        value: 'semantic',
        label: 'Meaning',
        description: 'Finds related ideas even when your note uses different words.',
    },
];

interface SearchModeControlProps {
    value: SearchMode;
    onChange: (mode: SearchMode) => void;
    showDescription?: boolean;
    className?: string;
}

const SearchModeControl = ({ value, onChange, showDescription = true, className }: SearchModeControlProps) => {
    const selectedOption = SEARCH_MODE_OPTIONS.find((option) => option.value === value) ?? SEARCH_MODE_OPTIONS[0];

    return (
        <div className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 ${className ?? ''}`}>
            <div
                role="radiogroup"
                aria-label="Search method"
                className="inline-flex max-w-full self-start gap-1 rounded-[12px] bg-muted p-1"
            >
                {SEARCH_MODE_OPTIONS.map((option) => {
                    const isSelected = option.value === value;

                    return (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            className={classNames(
                                'focus-ring-soft min-h-8 rounded-[9px] border px-3 text-sm font-semibold outline-none transition-colors',
                                isSelected
                                    ? 'border-border-subtle bg-elevated text-fg-default'
                                    : 'border-transparent text-fg-secondary hover:bg-hover-subtle hover:text-fg-default',
                            )}
                            onClick={() => onChange(option.value)}
                        >
                            {option.label}
                        </button>
                    );
                })}
            </div>
            {showDescription && (
                <Text as="p" variant="micro" tone="tertiary" className="min-w-0 leading-relaxed">
                    {selectedOption.description}
                </Text>
            )}
        </div>
    );
};

export default SearchModeControl;
