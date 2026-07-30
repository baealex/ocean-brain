import classNames from 'classnames';

import type { SearchMode } from '~/apis/search.api';
import { Select, SelectItem } from '~/components/ui';

const SEARCH_MODE_OPTIONS: Array<{ value: SearchMode; label: string }> = [
    { value: 'hybrid', label: 'Keyword + Meaning' },
    { value: 'lexical', label: 'Keyword only' },
    { value: 'semantic', label: 'Meaning only' },
];

interface SearchModeControlProps {
    value: SearchMode;
    onChange: (mode: SearchMode) => void;
    className?: string;
}

const SearchModeControl = ({ value, onChange, className }: SearchModeControlProps) => {
    return (
        <Select
            value={value}
            ariaLabel="Search mode"
            variant="ghost"
            size="md"
            className={classNames('max-w-[12rem] shrink-0', className)}
            onValueChange={(nextValue) => {
                if (SEARCH_MODE_OPTIONS.some((option) => option.value === nextValue)) {
                    onChange(nextValue as SearchMode);
                }
            }}
        >
            {SEARCH_MODE_OPTIONS.map((option) => {
                return (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                );
            })}
        </Select>
    );
};

export default SearchModeControl;
