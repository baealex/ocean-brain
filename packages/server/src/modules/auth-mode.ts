import { type AuthConfig, type AuthEnvironment, resolvePasswordAuthConfig } from '@baejino/auth';

export type { AuthConfig, AuthMode } from '@baejino/auth';

export const AUTH_SESSION_COOKIE_NAME = 'ocean-brain.sid';

export interface AuthModeEnvironment extends AuthEnvironment {
    [key: string]: string | undefined;
    OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH?: string;
    OCEAN_BRAIN_PASSWORD?: string;
    OCEAN_BRAIN_SESSION_SECRET?: string;
}

export const resolveAuthConfig = (env: AuthModeEnvironment): AuthConfig =>
    resolvePasswordAuthConfig({
        env,
        passwordEnv: 'OCEAN_BRAIN_PASSWORD',
        sessionSecretEnv: 'OCEAN_BRAIN_SESSION_SECRET',
        allowOpenEnv: 'OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH',
        requireExplicitOpen: true,
        allowPasswordAsSessionSecret: false,
        cookieName: AUTH_SESSION_COOKIE_NAME,
    });

export const logAuthConfig = (authConfig: AuthConfig) => {
    if (authConfig.mode === 'open') {
        process.stderr.write(
            '[auth] Running in explicit open mode. Authentication is not required for write access.\n',
        );
        return;
    }

    process.stdout.write('[auth] Running in password mode. Write access requires an authenticated session.\n');
};
