import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getServerCache, setServerCache } from '~/apis/server-cache.api';
import { Text, useConfirm } from '~/components/ui';
import { queryKeys } from '~/modules/query-key-factory';

const SidebarHeroBanner = () => {
    const confirm = useConfirm();
    const queryClient = useQueryClient();

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
            <button
                type="button"
                aria-label="Remove hero banner"
                className="surface-base focus-ring-soft group relative block w-full overflow-hidden text-left outline-none"
                onClick={async () => {
                    if (await confirm('Remove this hero banner from the sidebar?')) {
                        await setServerCache('heroBanner', '');
                        await queryClient.invalidateQueries({
                            queryKey: queryKeys.ui.heroBanner(),
                            exact: true
                        });
                    }
                }}>
                <img
                    alt="Studio atmosphere banner"
                    className="w-full object-cover transition duration-500 group-hover:scale-[1.01] group-hover:opacity-90 dark:brightness-[0.85] dark:saturate-[0.9]"
                    src={heroBanner}
                />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(18,24,34,0.1),rgba(18,24,34,0.38))] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3">
                    <Text
                        as="span"
                        variant="micro"
                        weight="semibold"
                        tracking="wider"
                        transform="uppercase"
                        className="rounded-[12px] border border-white/14 bg-black/16 px-2.5 py-2 text-white/80 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
                        Remove
                    </Text>
                </div>
            </button>
        </div>
    );
};

export default SidebarHeroBanner;
