export type AuthMode = 'password' | 'disabled';

export interface AuthConfig {
    mode: AuthMode;
    password?: string;
    sessionSecret?: string;
    source: 'auto' | 'override';
}

export interface AuthModeEnvironment {
    [key: string]: string | undefined;
    OCEAN_BRAIN_AUTH_MODE?: string;
    OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH?: string;
    OCEAN_BRAIN_PASSWORD?: string;
    OCEAN_BRAIN_SESSION_SECRET?: string;
}

const AUTH_MODE_VALUES: AuthMode[] = ['password', 'disabled'];

const isTruthy = (value?: string) => {
    if (!value) {
        return false;
    }

    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const ensurePasswordModeRequirements = (env: AuthModeEnvironment) => {
    if (!env.OCEAN_BRAIN_PASSWORD) {
        throw new Error(
            'Missing OCEAN_BRAIN_PASSWORD. Set OCEAN_BRAIN_PASSWORD to enable password auth mode.'
        );
    }

    if (!env.OCEAN_BRAIN_SESSION_SECRET) {
        throw new Error(
            'Missing OCEAN_BRAIN_SESSION_SECRET. Set OCEAN_BRAIN_SESSION_SECRET when password auth mode is enabled.'
        );
    }
};

export const resolveAuthConfig = (env: AuthModeEnvironment): AuthConfig => {
    const explicitMode = env.OCEAN_BRAIN_AUTH_MODE?.trim();
    const allowInsecureNoAuth = isTruthy(env.OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH);

    if (explicitMode && !AUTH_MODE_VALUES.includes(explicitMode as AuthMode)) {
        throw new Error(
            `Invalid OCEAN_BRAIN_AUTH_MODE "${explicitMode}". Expected one of: password, disabled.`
        );
    }

    if (explicitMode === 'password') {
        if (allowInsecureNoAuth) {
            throw new Error(
                'Conflicting auth config: OCEAN_BRAIN_AUTH_MODE=password cannot be combined with OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH=true.'
            );
        }

        ensurePasswordModeRequirements(env);

        return {
            mode: 'password',
            password: env.OCEAN_BRAIN_PASSWORD,
            sessionSecret: env.OCEAN_BRAIN_SESSION_SECRET,
            source: 'override'
        };
    }

    if (explicitMode === 'disabled') {
        return {
            mode: 'disabled',
            source: 'override'
        };
    }

    if (allowInsecureNoAuth) {
        return {
            mode: 'disabled',
            source: 'auto'
        };
    }

    if (env.OCEAN_BRAIN_PASSWORD) {
        ensurePasswordModeRequirements(env);

        return {
            mode: 'password',
            password: env.OCEAN_BRAIN_PASSWORD,
            sessionSecret: env.OCEAN_BRAIN_SESSION_SECRET,
            source: 'auto'
        };
    }

    throw new Error(
        'Unable to resolve auth mode. Set OCEAN_BRAIN_PASSWORD and OCEAN_BRAIN_SESSION_SECRET for password mode, or set OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH=true for disabled mode.'
    );
};

export const logAuthConfig = (authConfig: AuthConfig) => {
    if (authConfig.mode === 'disabled') {
        process.stderr.write('[auth] Running in disabled mode. Authentication is not required for write access.\n');
        return;
    }

    process.stdout.write('[auth] Running in password mode. Write access requires an authenticated session.\n');
};
