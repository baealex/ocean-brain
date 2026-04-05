import axios from 'axios';

export interface McpAdminStatus {
    enabled: boolean;
    hasActiveToken: boolean;
    token: null | {
        id: string;
        createdAt: string;
        lastUsedAt: string | null;
    };
}

export const fetchMcpAdminStatus = async () => {
    const { data } = await axios.get<McpAdminStatus>('/api/mcp-admin/status');
    return data;
};

export const setMcpEnabled = async (enabled: boolean) => {
    const { data } = await axios.post<McpAdminStatus>('/api/mcp-admin/enabled', { enabled });
    return data;
};

export const rotateMcpToken = async () => {
    const { data } = await axios.post<{ token: string; message?: string }>(
        '/api/mcp-admin/token/rotate'
    );
    return data;
};

export const revokeMcpToken = async () => {
    const { data } = await axios.post<McpAdminStatus>('/api/mcp-admin/token/revoke');
    return data;
};
