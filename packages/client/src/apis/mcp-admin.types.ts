export interface McpAdminStatus {
    enabled: boolean;
    hasActiveToken: boolean;
    token: null | {
        id: string;
        createdAt: string;
        lastUsedAt: string | null;
    };
    server: {
        version: string;
        releaseUrl: string;
        mcpVersionRequirement: string;
        mcp?: {
            compatibilityVersion: string;
            compatibilityRequirement: string;
            compatibilityVersionHeader: string;
            clientVersionHeader: string;
        };
    };
}
