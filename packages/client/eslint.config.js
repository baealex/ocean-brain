import baseConfig from '@baejino/eslint-config';
import reactConfig from '@baejino/eslint-config-react';

export default [
    { ignores: ['dist/**'] },
    ...baseConfig,
    ...reactConfig,
    {
        languageOptions: {
            globals: {
                document: 'readonly',
                window: 'readonly',
                navigator: 'readonly',
                MutationObserver: 'readonly'
            }
        }
    }
];
