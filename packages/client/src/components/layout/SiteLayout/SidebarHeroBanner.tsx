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
                className="surface-floating group relative overflow-hidden rounded-[30px] border border-border-subtle cursor-pointer"
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
                    alt="Studio atmosphere banner"
                    className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    style={{ filter: theme === 'dark' ? 'brightness(0.85) saturate(0.9)' : undefined }}
                    src={heroBanner}
                />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.06),rgba(15,23,42,0.42))]" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
                    <div className="rounded-[22px] border border-white/20 bg-black/20 px-3 py-2 backdrop-blur-sm transition-colors duration-300 group-hover:bg-black/35">
                        <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.24em] text-white/70">
                            Studio view
                        </div>
                        <div className="mt-1 text-sm font-medium text-white">
                            Quiet atmosphere for the next note.
                        </div>
                    </div>
                    <span className="rounded-[18px] border border-white/20 bg-black/20 px-3 py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-white/80 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
                        Remove
                    </span>
                </div>
            </div>
        </div>
    );
};

export default SidebarHeroBanner;
