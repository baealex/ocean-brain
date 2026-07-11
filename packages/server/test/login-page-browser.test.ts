import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { renderLoginPage } from '~/features/auth/http/login-page.js';

const waitForBrowserTasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

test('login page submits the form on the first submit event', async (t) => {
    let nativeSubmitCount = 0;
    const html = renderLoginPage({
        nextPath: '/notes',
        csrfToken: 'csrf-token',
        sessionGeneration: 'generation-1',
    });
    const dom = new JSDOM(html, {
        url: 'http://localhost/login',
        runScripts: 'dangerously',
        beforeParse: (window) => {
            Object.defineProperty(window, 'fetch', {
                configurable: true,
                value: async () =>
                    new Response(null, {
                        headers: {
                            'X-Ocean-Brain-Session-Generation': 'generation-1',
                        },
                    }),
            });
            Object.defineProperty(window.HTMLFormElement.prototype, 'submit', {
                configurable: true,
                value: () => {
                    nativeSubmitCount += 1;
                },
            });
        },
    });
    t.after(() => dom.window.close());
    await waitForBrowserTasks();

    const form = dom.window.document.querySelector('form');
    const submitButton = dom.window.document.querySelector('button[type="submit"]');

    assert.ok(form);
    assert.ok(submitButton);

    const submitEvent = new dom.window.SubmitEvent('submit', {
        bubbles: true,
        cancelable: true,
        submitter: submitButton,
    });

    form.dispatchEvent(submitEvent);
    await waitForBrowserTasks();

    assert.equal(submitEvent.defaultPrevented, true);
    assert.equal(nativeSubmitCount, 1);
});
