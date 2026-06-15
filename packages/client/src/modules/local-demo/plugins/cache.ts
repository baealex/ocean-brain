import { success } from '../response';
import type { LocalDemoPlugin } from '../types';

export const cacheLocalPlugin: LocalDemoPlugin = {
    name: 'cache',
    graphHandlers: {
        GetServerCache: ({ state, variables }) => {
            return success({ cache: { value: decodeURIComponent(state.cache[String(variables.key)] ?? '') } });
        },
        SetServerCache: ({ state, variables, save }) => {
            state.cache[String(variables.key)] = String(variables.value ?? '');
            save();
            return success({ setCache: { value: String(variables.value ?? '') } });
        },
        DeleteServerCache: ({ state, variables, save }) => {
            delete state.cache[String(variables.key)];
            save();
            return success({ deleteCache: true });
        },
    },
};
