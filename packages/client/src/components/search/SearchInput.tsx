import type { FormEvent } from 'react';

import * as Icon from '~/components/icon';
import { Button } from '~/components/ui';

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    onClear?: () => void;
    onCompositionChange?: (isComposing: boolean) => void;
    autoFocus?: boolean;
    placeholder?: string;
}

const SearchInput = ({
    value,
    onChange,
    onSubmit,
    onClear,
    onCompositionChange,
    autoFocus = false,
    placeholder = 'Describe what you remember',
}: SearchInputProps) => {
    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSubmit();
    };

    return (
        <form role="search" className="flex items-stretch gap-2" onSubmit={handleSubmit}>
            <div className="grid-search-bar grid min-h-12 min-w-0 flex-1 items-center rounded-[15px] border border-border-subtle bg-elevated px-2.5 transition-colors focus-within:border-border-focus focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent-soft-primary)_90%,transparent)]">
                <span className="flex h-10 items-center justify-center text-fg-tertiary" aria-hidden="true">
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
                    className="h-11 min-w-0 bg-transparent px-1 text-base text-fg-default outline-none placeholder:text-fg-placeholder"
                />
                {value && (
                    <button
                        type="button"
                        aria-label="Clear search"
                        className="focus-ring-soft flex h-10 items-center justify-center rounded-[10px] text-fg-tertiary transition-colors hover:text-fg-default"
                        onClick={() => {
                            onChange('');
                            onClear?.();
                        }}
                    >
                        <Icon.Close className="h-4 w-4" weight="bold" />
                    </button>
                )}
            </div>
            <Button
                type="submit"
                size="lg"
                disabled={!value.trim()}
                className="h-12 shrink-0 rounded-[15px] px-4 sm:px-5"
            >
                Search
            </Button>
        </form>
    );
};

export default SearchInput;
