import type { Page } from '@playwright/test';

const isKnownReactHelmetWarning = (message: string) =>
    message.includes('Using UNSAFE_componentWillMount in strict mode') && message.includes('SideEffect');

export const collectRuntimeErrors = (page: Page) => {
    const errors: string[] = [];

    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
        if (message.type() !== 'error' || isKnownReactHelmetWarning(message.text())) {
            return;
        }

        errors.push(message.text());
    });

    return errors;
};
