export interface ServeAuthOptionsInput {
    authMode?: string;
    allowInsecureNoAuth?: boolean;
}

export interface ServeAuthEnvironment {
    [key: string]: string | undefined;
    OCEAN_BRAIN_AUTH_MODE?: string;
    OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH?: string;
    OCEAN_BRAIN_PASSWORD?: string;
    OCEAN_BRAIN_SESSION_SECRET?: string;
}

const AUTH_MODE_VALUES = ['password', 'disabled'] as const;

const isTruthy = (value?: string) => {
    if (!value) {
        return false;
    }

    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const ensurePasswordModeRequirements = (env: ServeAuthEnvironment) => {
    if (!env.OCEAN_BRAIN_PASSWORD) {
        throw new Error(
            'Missing OCEAN_BRAIN_PASSWORD. Set OCEAN_BRAIN_PASSWORD before running password auth mode.'
        );
    }

    if (!env.OCEAN_BRAIN_SESSION_SECRET) {
        throw new Error(
            'Missing OCEAN_BRAIN_SESSION_SECRET. Set OCEAN_BRAIN_SESSION_SECRET before running password auth mode.'
        );
    }
};

const parseExplicitMode = (authMode?: string) => {
    if (!authMode) {
        return undefined;
    }

    if (!AUTH_MODE_VALUES.includes(authMode as typeof AUTH_MODE_VALUES[number])) {
        throw new Error(`Invalid auth mode "${authMode}". Expected one of: password, disabled.`);
    }

    return authMode as typeof AUTH_MODE_VALUES[number];
};

export const resolveServeAuthEnvironment = (
    options: ServeAuthOptionsInput,
    env: ServeAuthEnvironment
) => {
    const explicitMode = parseExplicitMode(options.authMode ?? env.OCEAN_BRAIN_AUTH_MODE);
    const allowInsecureNoAuth = options.allowInsecureNoAuth || isTruthy(env.OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH);

    if (explicitMode === 'password' && allowInsecureNoAuth) {
        throw new Error(
            'Conflicting auth config: --auth-mode password cannot be combined with --allow-insecure-no-auth or OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH=true.'
        );
    }

    const effectiveMode = explicitMode
        ?? (allowInsecureNoAuth ? 'disabled' : (env.OCEAN_BRAIN_PASSWORD ? 'password' : undefined));

    if (effectiveMode === 'password') {
        ensurePasswordModeRequirements(env);
    }

    return {
        OCEAN_BRAIN_AUTH_MODE: explicitMode,
        OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH: options.allowInsecureNoAuth ? 'true' : undefined
    };
};
