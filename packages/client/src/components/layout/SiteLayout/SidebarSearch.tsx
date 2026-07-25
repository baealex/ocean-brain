import type { SearchMode } from '~/apis/search.api';
import useSemanticSearchCapability from '~/hooks/useSemanticSearchCapability';

import LegacySidebarQuickSearch from './LegacySidebarQuickSearch';

const SidebarSearch = () => {
    const { isLoading, isSemanticSearchAvailable } = useSemanticSearchCapability();
    const fullSearchMode: SearchMode = !isLoading && isSemanticSearchAvailable ? 'hybrid' : 'lexical';

    return (
        <div className="p-3">
            <LegacySidebarQuickSearch
                fullSearchMode={fullSearchMode}
                meaningSearchEnabled={!isLoading && isSemanticSearchAvailable}
            />
        </div>
    );
};

export default SidebarSearch;
