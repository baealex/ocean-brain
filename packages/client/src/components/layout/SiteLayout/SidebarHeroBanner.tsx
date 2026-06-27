import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getServerCache, setServerCache } from '~/apis/server-cache.api';
import * as Icon from '~/components/icon';
import { useConfirm, useToast } from '~/components/ui';
import { queryKeys } from '~/modules/query-key-factory';

const SidebarHeroBanner = () => {
    const confirm = useConfirm();
    const toast = useToast();
    const queryClient = useQueryClient();

    const { data: heroBanner } = useQuery({
        queryKey: queryKeys.ui.heroBanner(),
        async queryFn() {
            return getServerCache('heroBanner');
        },
    });

    if (!heroBanner) {
        return null;
    }

    return (
        <div className="p-3 pb-0">
            <div className="surface-base group relative overflow-hidden">
                <img
                    alt="Studio atmosphere banner"
                    className="w-full object-cover transition duration-500 group-hover:scale-[1.01] group-hover:opacity-90 dark:brightness-[0.85] dark:saturate-[0.9]"
                    src={heroBanner}
                />
                <button
                    type="button"
                    aria-label="Remove sidebar banner"
                    title="Remove banner"
                    className="focus-ring-soft absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/14 bg-black/24 text-white/85 opacity-0 outline-none backdrop-blur-sm transition-opacity hover:bg-black/34 hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
                    onClick={async () => {
                        if (await confirm('Remove this hero banner from the sidebar?')) {
                            const response = await setServerCache('heroBanner', '');
                            if (response.type === 'error') {
                                toast(response.errors[0]?.message ?? 'Failed to remove hero banner');
                                return;
                            }

                            await queryClient.invalidateQueries({
                                queryKey: queryKeys.ui.heroBanner(),
                                exact: true,
                            });
                        }
                    }}
                >
                    <Icon.Close className="h-4 w-4" weight="bold" />
                </button>
            </div>
        </div>
    );
};

export default SidebarHeroBanner;
