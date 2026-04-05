export interface ServeAuthOptionsInput {
    allowInsecureNoAuth?: boolean;
}

export interface ServeAuthEnvironment {
    [key: string]: string | undefined;
    OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH?: string;
    OCEAN_BRAIN_PASSWORD?: string;
    OCEAN_BRAIN_SESSION_SECRET?: string;
}

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

export const resolveServeAuthEnvironment = (
    options: ServeAuthOptionsInput,
    env: ServeAuthEnvironment
) => {
    const allowInsecureNoAuth = options.allowInsecureNoAuth || isTruthy(env.OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH);

    if (!allowInsecureNoAuth && env.OCEAN_BRAIN_PASSWORD) {
        ensurePasswordModeRequirements(env);
    }

    return {
        OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH: allowInsecureNoAuth ? 'true' : undefined
    };
};
