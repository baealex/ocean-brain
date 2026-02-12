import { getHash } from './hash';

export const priorityColors: Record<string, string> = {
    high: 'bg-accent-danger',
    medium: 'bg-accent-primary',
    low: 'bg-accent-success'
};

export const priorityColorsSubtle: Record<string, string> = {
    high: 'bg-accent-soft-danger',
    medium: 'bg-accent-soft-primary',
    low: 'bg-accent-soft-success'
};

export const overdueColor = 'bg-red-200 dark:bg-emphasis';

const bgColors = [
    'bg-pastel-yellow-200 dark:bg-muted',
    'bg-pastel-green-200 dark:bg-muted',
    'bg-pastel-pink-200 dark:bg-muted',
    'bg-pastel-orange-200 dark:bg-muted',
    'bg-pastel-blue-200 dark:bg-muted',
    'bg-pastel-purple-200 dark:bg-muted',
    'bg-pastel-teal-200 dark:bg-muted',
    'bg-pastel-lavender-200 dark:bg-muted'
];

export const getRandomBackground = (text: string) => {
    const color = bgColors[getHash(text) % bgColors.length];
    return color;
};
