import { getHash } from './hash';

const bgColors = [
    'bg-pastel-yellow-200 dark:bg-zinc-900 dark:bg-opacity-75',
    'bg-pastel-green-200 dark:bg-zinc-900 dark:bg-opacity-75',
    'bg-pastel-pink-200 dark:bg-zinc-900 dark:bg-opacity-75',
    'bg-pastel-orange-200 dark:bg-zinc-900 dark:bg-opacity-75',
    'bg-pastel-blue-200 dark:bg-zinc-900 dark:bg-opacity-75',
    'bg-pastel-purple-200 dark:bg-zinc-900 dark:bg-opacity-75',
    'bg-pastel-teal-200 dark:bg-zinc-900 dark:bg-opacity-75',
    'bg-pastel-lavender-200 dark:bg-zinc-900 dark:bg-opacity-75'
];

export const getRandomBackground = (text: string) => {
    const color = bgColors[getHash(text) % bgColors.length];
    return color;
};
