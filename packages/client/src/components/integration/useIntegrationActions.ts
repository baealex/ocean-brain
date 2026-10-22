import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '~/modules/query-key-factory';

export default function useIntegrationActions() {
    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: (operation: () => Promise<unknown>) => operation(),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all(), exact: false }),
                queryClient.invalidateQueries({ queryKey: queryKeys.mcp.status(), exact: true }),
            ]);
        },
    });
    return {
        pending: mutation.isPending,
        error: mutation.error,
        run: (operation: () => Promise<unknown>, onSuccess?: () => void) => mutation.mutate(operation, { onSuccess }),
    };
}
