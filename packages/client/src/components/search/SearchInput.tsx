import type { FormEvent } from 'react';

import type { SearchMode } from '~/apis/search.api';
import * as Icon from '~/components/icon';
import { Button } from '~/components/ui';

import SearchModeControl from './SearchModeControl';

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    onClear?: () => void;
    onCompositionChange?: (isComposing: boolean) => void;
    mode?: SearchMode;
    onModeChange?: (mode: SearchMode) => void;
    autoFocus?: boolean;
    placeholder?: string;
}

const SearchInput = ({
    value,
    onChange,
    onSubmit,
    onClear,
    onCompositionChange,
    mode,
    onModeChange,
    autoFocus = false,
    placeholder = 'Describe what you remember',
}: SearchInputProps) => {
    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSubmit();
    };

    return (
        <form role="search" className="flex w-full" onSubmit={handleSubmit}>
            <div className="flex min-h-14 min-w-0 flex-1 flex-wrap items-center overflow-hidden rounded-[16px] border border-border-subtle bg-elevated px-2 py-1 transition-colors focus-within:border-border-focus focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent-soft-primary)_90%,transparent)]">
                {mode && onModeChange && (
                    <div className="flex w-full items-center border-b border-border-subtle/70 pb-1 md:w-auto md:border-b-0 md:pb-0">
                        <SearchModeControl value={mode} onChange={onModeChange} className="max-w-full" />
                        <span className="mx-1 hidden h-6 w-px shrink-0 bg-divider md:block" aria-hidden="true" />
                    </div>
                )}
                <div className="flex min-w-0 flex-1 basis-full items-center md:basis-auto">
                    <span
                        className="flex h-11 w-10 shrink-0 items-center justify-center text-fg-tertiary"
                        aria-hidden="true"
                    >
                        <Icon.Search className="h-[18px] w-[18px]" weight="bold" />
                    </span>
                    <input
                        type="text"
                        role="searchbox"
                        aria-label="Search notes"
                        autoFocus={autoFocus}
                        autoComplete="off"
                        placeholder={placeholder}
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                        onCompositionStart={() => onCompositionChange?.(true)}
                        onCompositionEnd={(event) => {
                            onChange(event.currentTarget.value);
                            onCompositionChange?.(false);
                        }}
                        className="h-11 min-w-0 flex-1 bg-transparent px-1 text-base text-fg-default outline-none placeholder:text-fg-placeholder"
                    />
                    {value && (
                        <button
                            type="button"
                            aria-label="Clear search"
                            className="focus-ring-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-fg-tertiary transition-colors hover:bg-hover-subtle hover:text-fg-default"
                            onClick={() => {
                                onChange('');
                                onClear?.();
                            }}
                        >
                            <Icon.Close className="h-4 w-4" weight="bold" />
                        </button>
                    )}
                    <Button type="submit" size="lg" disabled={!value.trim()} className="my-1 px-4 sm:px-5">
                        Search
                    </Button>
                </div>
            </div>
        </form>
    );
};

export default SearchInput;
