import type { Config } from 'jest';

export default {
    preset: 'ts-jest',
    moduleNameMapper: { '~/(.*)$': '<rootDir>/src/$1' },
    testPathIgnorePatterns: [
        '/cli/',
        '/client/',
        '/dist/'
    ],
    setupFilesAfterEnv: ['./jest.setup.ts']
} as Config;
