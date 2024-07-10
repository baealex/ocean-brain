import type { Config } from 'jest';
import { name as appName } from './package.json';

const config: Config = {
    preset: 'ts-jest',
    displayName: appName,
    testEnvironment: 'jest-environment-jsdom',
    setupFilesAfterEnv: ['./jest.setup.ts'],
    moduleNameMapper: { '^~/(.*)$': '<rootDir>/src/$1' }
};

export default config;
