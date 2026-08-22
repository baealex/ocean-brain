import fs from 'fs';
import os from 'os';

export interface McpAuthOptionsInput {
    token?: string;
    tokenFile?: string;
}

export const expandMcpTokenFilePath = (
    tokenFilePath: string,
    homeDirectory = os.homedir()
) => {
    return tokenFilePath.replace(
        /^(?:~|\$HOME|\$\{HOME\}|%USERPROFILE%|%HOME%)(?=$|[\\/])/i,
        homeDirectory
    );
};

export const resolveMcpBearerToken = (
    options: McpAuthOptionsInput,
    homeDirectory = os.homedir()
) => {
    if (options.tokenFile) {
        const tokenFilePath = expandMcpTokenFilePath(options.tokenFile, homeDirectory);
        const token = fs.readFileSync(tokenFilePath, 'utf-8').trim();
        return token || undefined;
    }

    return options.token?.trim() || undefined;
};
