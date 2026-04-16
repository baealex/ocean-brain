import { readFileSync } from 'node:fs';

declare const __LOGIN_PAGE_TEMPLATE__: string | undefined;

const LOGIN_ERROR_TOKEN = '<!-- OCEAN_BRAIN_LOGIN_ERROR -->';
const NEXT_PATH_TOKEN = 'OCEAN_BRAIN_NEXT_PATH';

const readLoginPageTemplate = () => {
    if (typeof __LOGIN_PAGE_TEMPLATE__ === 'string') {
        return __LOGIN_PAGE_TEMPLATE__;
    }

    return readFileSync(new URL('./login-page.html', import.meta.url), 'utf8');
};

const LOGIN_PAGE_TEMPLATE = readLoginPageTemplate();

const escapeHtml = (value: string) =>
    value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

interface LoginPageParams {
    nextPath: string;
    errorMessage?: string;
}

const renderLoginError = (errorMessage?: string) => {
    if (!errorMessage) {
        return '';
    }

    return `<div class="error" role="alert">${escapeHtml(errorMessage)}</div>`;
};

const renderLoginTemplate = (values: { errorBlock: string; nextPath: string }) => {
    return LOGIN_PAGE_TEMPLATE.replace(LOGIN_ERROR_TOKEN, values.errorBlock).replace(NEXT_PATH_TOKEN, values.nextPath);
};

export const renderLoginPage = ({ nextPath, errorMessage }: LoginPageParams) =>
    renderLoginTemplate({
        errorBlock: renderLoginError(errorMessage),
        nextPath: escapeHtml(nextPath),
    });
