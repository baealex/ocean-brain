import { useQuery } from '@tanstack/react-query';
import { useLocation, useMatches } from '@tanstack/react-router';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { fetchWorkspaces } from '~/apis/workspace.api';
import type { Workspace } from '~/models/workspace.model';
import { queryKeys } from '~/modules/query-key-factory';
import { NOTE_ROUTE } from '~/modules/url';
import { DEFAULT_WORKSPACE_ID, validateWorkspaceId } from '~/modules/workspace-scope';

const STORAGE_KEY = 'ocean-brain:active-workspace';
interface WorkspaceContextValue {
    scopeWorkspace?: string;
    workspaceId: string;
    workspaces: Workspace[];
    activeWorkspace?: Workspace;
    multiple: boolean;
    error: Error | null;
    followNoteWorkspace: (workspaceId: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
    workspaceId: DEFAULT_WORKSPACE_ID,
    workspaces: [],
    multiple: false,
    error: null,
    followNoteWorkspace: () => undefined,
});

const readLastWorkspace = () => {
    try {
        return window.sessionStorage.getItem(STORAGE_KEY) ?? DEFAULT_WORKSPACE_ID;
    } catch {
        return DEFAULT_WORKSPACE_ID;
    }
};

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
    const search = useLocation({ select: (location) => location.search });
    const [rememberedId, setRememberedId] = useState(readLastWorkspace);
    const [noteWorkspaceId, setNoteWorkspaceId] = useState<string>();
    const isNote = useMatches({ select: (matches) => matches.some((match) => match.routeId === NOTE_ROUTE) });
    const explicitId =
        'workspace' in search && search.workspace !== undefined ? validateWorkspaceId(search.workspace) : undefined;
    const scopeWorkspace =
        'scopeWorkspace' in search && search.scopeWorkspace !== undefined
            ? search.scopeWorkspace === 'all'
                ? 'all'
                : validateWorkspaceId(search.scopeWorkspace)
            : undefined;
    const workspaceId =
        (isNote ? noteWorkspaceId : undefined) ?? explicitId ?? (isNote ? rememberedId : DEFAULT_WORKSPACE_ID);
    const query = useQuery({
        queryKey: queryKeys.workspaces.list(),
        queryFn: async () => {
            const response = await fetchWorkspaces();
            if (response.type === 'error') throw new Error(response.errors[0].message);
            return response.workspaces;
        },
    });
    const followNoteWorkspace = useCallback((id: string) => setNoteWorkspaceId(id), []);
    useEffect(() => {
        if (!isNote) setNoteWorkspaceId(undefined);
    }, [isNote]);
    useEffect(() => {
        setRememberedId(workspaceId);
        try {
            window.sessionStorage.setItem(STORAGE_KEY, workspaceId);
        } catch {
            /* Navigation remains usable without browser storage. */
        }
    }, [workspaceId]);
    const workspaces = query.data ?? [];
    return (
        <WorkspaceContext.Provider
            value={{
                workspaceId,
                scopeWorkspace,
                workspaces,
                activeWorkspace: workspaces.find((workspace) => workspace.id === workspaceId),
                multiple: workspaces.length > 1,
                error: query.error,
                followNoteWorkspace,
            }}
        >
            {children}
        </WorkspaceContext.Provider>
    );
};

export const useWorkspace = () => useContext(WorkspaceContext);
