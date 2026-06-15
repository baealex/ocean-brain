export interface McpAdminStatus {
    enabled: boolean;
    hasActiveToken: boolean;
    token: null | {
        id: string;
        createdAt: string;
        lastUsedAt: string | null;
    };
}
