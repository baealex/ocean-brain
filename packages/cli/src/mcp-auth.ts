import fs from 'fs';

export interface McpAuthOptionsInput {
    token?: string;
    tokenEnv?: string;
    tokenFile?: string;
}

export interface McpAuthEnvironment {
    [key: string]: string | undefined;
}

const DEFAULT_TOKEN_ENV_NAME = 'OCEAN_BRAIN_MCP_TOKEN';

export const resolveMcpBearerToken = (
    options: McpAuthOptionsInput,
    env: McpAuthEnvironment
) => {
    if (options.tokenFile) {
        const token = fs.readFileSync(options.tokenFile, 'utf-8').trim();
        return token || undefined;
    }

    const tokenEnvName = options.tokenEnv || DEFAULT_TOKEN_ENV_NAME;
    const envToken = env[tokenEnvName]?.trim();

    if (envToken) {
        return envToken;
    }

    return options.token?.trim() || undefined;
};
