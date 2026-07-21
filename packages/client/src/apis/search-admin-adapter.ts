import axios from 'axios';
import type {
    SearchAdminStatus,
    SemanticSearchConfig,
    SemanticSearchConnectionResult,
    SemanticSearchReindexResult,
} from './search-admin.types';

export const fetchSearchAdminStatus = async () => {
    const { data } = await axios.get<SearchAdminStatus>('/api/search-admin/status');
    return data;
};

export const saveSemanticSearchConfig = async (config: SemanticSearchConfig) => {
    const { data } = await axios.post<SearchAdminStatus>('/api/search-admin/config', config);
    return data;
};

export const testSemanticSearchConnection = async (config: SemanticSearchConfig) => {
    const { data } = await axios.post<SemanticSearchConnectionResult>('/api/search-admin/test', config);
    return data;
};

export const startSemanticSearchReindex = async () => {
    const { data } = await axios.post<SemanticSearchReindexResult>('/api/search-admin/reindex');
    return data;
};
