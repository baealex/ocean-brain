type DevAuthSessionResponse = {
    authRequired?: boolean;
    authenticated?: boolean;
};

type DevGateRequest = {
    headers: {
        accept?: string;
        cookie?: string;
        host?: string;
        'x-forwarded-proto'?: string;
    };
    method?: string;
    originalUrl?: string;
    url?: string;
};

type DevGateResponse = {
    end: (body?: string) => void;
    setHeader: (name: string, value: string) => void;
    statusCode?: number;
};

type DevGateNext = () => void;

export const isPasswordModeEnabled = (env: Record<string, string | undefined>) => {
    const explicitMode = env.OCEAN_BRAIN_AUTH_MODE?.trim();

    if (explicitMode === 'disabled') {
        return false;
    }

    if (explicitMode === 'password') {
        return true;
    }

    return Boolean(env.OCEAN_BRAIN_PASSWORD);
};

export const shouldBypassDevAuthGate = (pathname: string) => {
    return (
        pathname.startsWith('/@')
        || pathname.startsWith('/src/')
        || pathname.startsWith('/node_modules/')
        || pathname.startsWith('/api')
        || pathname.startsWith('/graphql')
        || pathname.startsWith('/assets')
        || pathname.startsWith('/auth')
        || pathname === '/favicon.ico'
    );
};

export const buildDevAuthLoginRedirect = (requestUrl: string) => {
    return `/auth/login?next=${encodeURIComponent(requestUrl)}`;
};

export const createDevAuthGateMiddleware = (options: {
    backendOrigin: string;
    enabled: boolean;
    fetchImpl?: typeof fetch;
}) => {
    const fetchImpl = options.fetchImpl ?? fetch;

    return async (req: DevGateRequest, res: DevGateResponse, next: DevGateNext) => {
        if (!options.enabled || req.method !== 'GET') {
            next();
            return;
        }

        if (!req.headers.accept?.includes('text/html')) {
            next();
            return;
        }

        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const host = req.headers.host || 'localhost:5173';
        const requestUrl = new URL(req.originalUrl || req.url || '/', `${protocol}://${host}`);

        if (shouldBypassDevAuthGate(requestUrl.pathname)) {
            next();
            return;
        }

        const authHeaders: Record<string, string> = req.headers.cookie
            ? { Cookie: req.headers.cookie }
            : {};

        const authResponse = await fetchImpl(`${options.backendOrigin}/api/auth/session`, { headers: authHeaders });

        if (!authResponse.ok) {
            res.statusCode = 502;
            res.end('Unable to verify password mode session.');
            return;
        }

        const authState = await authResponse.json() as DevAuthSessionResponse;

        if (authState.authRequired && !authState.authenticated) {
            res.statusCode = 303;
            res.setHeader('Location', buildDevAuthLoginRedirect(requestUrl.toString()));
            res.end();
            return;
        }

        next();
    };
};
