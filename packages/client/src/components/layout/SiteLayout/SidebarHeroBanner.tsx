import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getServerCache, setServerCache } from '~/apis/server-cache.api';
import { useConfirm } from '~/components/ui';
import { queryKeys } from '~/modules/query-key-factory';
import { useTheme } from '~/store/theme';

const SidebarHeroBanner = () => {
    const confirm = useConfirm();
    const queryClient = useQueryClient();
    const { theme } = useTheme((state) => state);

    const { data: heroBanner } = useQuery({
        queryKey: queryKeys.ui.heroBanner(),
        async queryFn() {
            return getServerCache('heroBanner');
        }
    });

    if (!heroBanner) {
        return null;
    }

    return (
        <div className="p-3 pb-0">
            <div
                className="relative rounded-[16px_5px_17px_4px/5px_13px_5px_15px] border-2 border-border shadow-sketchy overflow-hidden cursor-pointer group"
                onClick={async () => {
                    if (await confirm('Do you want to remove this hero banner?')) {
                        await setServerCache('heroBanner', '');
                        await queryClient.invalidateQueries({
                            queryKey: queryKeys.ui.heroBanner(),
                            exact: true
                        });
                    }
                }}>
                <img
                    className="w-full transition-transform duration-300 group-hover:scale-105"
                    style={{ filter: theme === 'dark' ? 'brightness(0.85) saturate(0.9)' : undefined }}
                    src={heroBanner}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                    <span className="text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/50 px-3 py-1.5 rounded-[8px_3px_9px_2px/3px_6px_3px_7px]">
                        Click to remove
                    </span>
                </div>
            </div>
        </div>
    );
};

export default SidebarHeroBanner;
