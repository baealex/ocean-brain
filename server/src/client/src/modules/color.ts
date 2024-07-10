import { getHash } from './hash';

const bgColors = [
    'bg-yellow-100 dark:bg-zinc-900',
    'bg-green-50 dark:bg-zinc-900',
    'bg-pink-100 dark:bg-zinc-900',
    'bg-orange-100 dark:bg-zinc-900',
    'bg-indigo-100 dark:bg-zinc-900',
    'bg-purple-100 dark:bg-zinc-900'
];

export const getRandomBackground = (text: string) => {
    const color = bgColors[getHash(text) % bgColors.length];
    return color;
};
