import fs from 'fs';

export interface McpAuthOptionsInput {
    token?: string;
    tokenFile?: string;
}

export const resolveMcpBearerToken = (
    options: McpAuthOptionsInput
) => {
    if (options.tokenFile) {
        const token = fs.readFileSync(options.tokenFile, 'utf-8').trim();
        return token || undefined;
    }

    return options.token?.trim() || undefined;
};
