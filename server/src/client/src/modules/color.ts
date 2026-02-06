import { getHash } from './hash';

export const priorityColors: Record<string, string> = {
    high: 'bg-pastel-pink-200 dark:bg-zinc-700',
    medium: 'bg-pastel-yellow-200 dark:bg-zinc-800',
    low: 'bg-pastel-green-200 dark:bg-zinc-800'
};

export const priorityColorsSubtle: Record<string, string> = {
    high: 'bg-pastel-pink-200/50 dark:bg-zinc-700',
    medium: 'bg-pastel-yellow-200/50 dark:bg-zinc-800',
    low: 'bg-pastel-green-200/50 dark:bg-zinc-800'
};

export const overdueColor = 'bg-red-200 dark:bg-zinc-600';

const bgColors = [
    'bg-pastel-yellow-200 dark:bg-zinc-800',
    'bg-pastel-green-200 dark:bg-zinc-800',
    'bg-pastel-pink-200 dark:bg-zinc-800',
    'bg-pastel-orange-200 dark:bg-zinc-800',
    'bg-pastel-blue-200 dark:bg-zinc-800',
    'bg-pastel-purple-200 dark:bg-zinc-800',
    'bg-pastel-teal-200 dark:bg-zinc-800',
    'bg-pastel-lavender-200 dark:bg-zinc-800'
];

export const getRandomBackground = (text: string) => {
    const color = bgColors[getHash(text) % bgColors.length];
    return color;
};
