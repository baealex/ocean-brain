import { cva } from 'class-variance-authority';

export const progressBarVariants = cva(
    ['h-full', 'transition-all', 'duration-300', 'ease-out'],
    {
        variants: {
            color: {
                primary: 'bg-pastel-blue-200',
                success: 'bg-pastel-green-200',
                danger: 'bg-pastel-pink-200',
                warning: 'bg-pastel-orange-200'
            }
        },
        defaultVariants: { color: 'primary' }
    }
);
