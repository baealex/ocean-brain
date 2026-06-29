import type { McpAdminStatus } from '~/apis/mcp-admin.api';
import { OCEAN_BRAIN_RELEASES_URL } from '~/modules/app-version';
import type { GraphQueryRequest, GraphQueryResponse } from '../graph-query-types';
import { cacheLocalPlugin } from './plugins/cache';
import { imagesLocalPlugin } from './plugins/images';
import { notesLocalPlugin } from './plugins/notes';
import { placeholdersLocalPlugin } from './plugins/placeholders';
import { remindersLocalPlugin } from './plugins/reminders';
import { tagsLocalPlugin } from './plugins/tags';
import { viewsLocalPlugin } from './plugins/views';
import { localError } from './response';
import { localDemoStore } from './store';
import type { LocalGraphHandler } from './types';
import { createLocalId, now } from './utils';

const localDemoPlugins = [
    notesLocalPlugin,
    tagsLocalPlugin,
    remindersLocalPlugin,
    viewsLocalPlugin,
    placeholdersLocalPlugin,
    imagesLocalPlugin,
    cacheLocalPlugin,
];

const graphHandlers = localDemoPlugins.reduce<Record<string, LocalGraphHandler>>((handlers, plugin) => {
    return { ...handlers, ...(plugin.graphHandlers ?? {}) };
}, {});

const withLocalDemoMcpServerInfo = (mcp: Omit<McpAdminStatus, 'server'>): McpAdminStatus => ({
    ...mcp,
    server: {
        version: 'local-demo',
        releaseUrl: OCEAN_BRAIN_RELEASES_URL,
        mcpVersionRequirement: 'unknown',
        mcp: {
            compatibilityVersion: 'unknown',
            compatibilityRequirement: 'unknown',
            compatibilityVersionHeader: 'X-Ocean-Brain-MCP-Compatibility-Version',
            clientVersionHeader: 'X-Ocean-Brain-MCP-Client-Version',
        },
    },
});

const resolveOperationName = (request: GraphQueryRequest<object>) => {
    return request.operationName ?? request.query.match(/\b(?:query|mutation)\s+(\w+)/)?.[1] ?? '';
};

export const executeLocalDemoGraphQuery = async <TData extends object>(
    request: GraphQueryRequest<object>,
): Promise<GraphQueryResponse<TData>> => {
    const operationName = resolveOperationName(request);
    const handler = graphHandlers[operationName];

    if (!operationName) {
        return localError('Local-only demo mode requires named GraphQL operations.') as GraphQueryResponse<TData>;
    }

    if (!handler) {
        return localError(`Unsupported local-only demo operation: ${operationName}`) as GraphQueryResponse<TData>;
    }

    const state = localDemoStore.read();
    return handler({
        state,
        variables: (request.variables ?? {}) as Record<string, unknown>,
        save: () => localDemoStore.save(),
    }) as GraphQueryResponse<TData>;
};

export const uploadLocalDemoImage = async ({ base64 }: { base64?: string }) => {
    if (base64) {
        localDemoStore.update((state) => {
            state.images.unshift({ id: createLocalId('image'), url: base64 });
        });
        return base64;
    }

    throw new Error('No file provided');
};

export const fetchLocalDemoMcpAdminStatus = async (): Promise<McpAdminStatus> => {
    return withLocalDemoMcpServerInfo(localDemoStore.read().mcp);
};

export const setLocalDemoMcpEnabled = async (enabled: boolean): Promise<McpAdminStatus> => {
    const mcp = localDemoStore.update((state) => {
        state.mcp.enabled = enabled;
        return state.mcp;
    });

    return withLocalDemoMcpServerInfo(mcp);
};

export const rotateLocalDemoMcpToken = async () => {
    const token = `local-demo-token-${createLocalId('mcp')}`;
    localDemoStore.update((state) => {
        state.mcp.hasActiveToken = true;
        state.mcp.token = {
            id: createLocalId('mcp-token'),
            createdAt: now(),
            lastUsedAt: null,
        };
    });
    return {
        token,
        message: 'This token is local to this browser demo and cannot access a server.',
    };
};

export const revokeLocalDemoMcpToken = async (): Promise<McpAdminStatus> => {
    const mcp = localDemoStore.update((state) => {
        state.mcp.hasActiveToken = false;
        state.mcp.token = null;
        return state.mcp;
    });

    return withLocalDemoMcpServerInfo(mcp);
};

export const localDemoOperationNames = Object.freeze(Object.keys(graphHandlers).sort());
