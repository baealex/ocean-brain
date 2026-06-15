import { cva } from 'class-variance-authority';
import classNames from 'classnames';

const cardTone = {
    star: [
        'border-amber-200/70',
        'bg-[linear-gradient(135deg,#fffaf0_0%,#eef7ff_58%,#e7f6fb_100%)]',
        'hover:border-amber-300/80',
        'dark:border-amber-200/20',
        'dark:bg-[linear-gradient(135deg,rgba(44,34,18,0.58)_0%,rgba(20,34,48,0.72)_58%,rgba(19,50,62,0.62)_100%)]',
    ],
    feedback: [
        'border-sky-200/75',
        'bg-[linear-gradient(135deg,#f8fbff_0%,#f1efff_54%,#eafaf4_100%)]',
        'hover:border-sky-300/80',
        'dark:border-sky-200/20',
        'dark:bg-[linear-gradient(135deg,rgba(23,35,52,0.72)_0%,rgba(35,31,62,0.62)_54%,rgba(20,50,39,0.58)_100%)]',
    ],
} as const;

export const promoRootClassName = 'flex flex-col gap-2.5 px-3 pb-1 pt-0';

export const promoCardVariants = cva(
    [
        'focus-ring-soft',
        'group',
        'relative',
        'isolate',
        'block',
        'min-h-[112px]',
        'overflow-hidden',
        'rounded-[20px]',
        'border',
        'px-3.5',
        'py-3.5',
        'text-left',
        'outline-none',
        'transition',
        'duration-200',
        'hover:-translate-y-0.5',
        'hover:shadow-[0_18px_42px_-34px_rgba(15,23,42,0.42)]',
    ],
    {
        variants: {
            tone: cardTone,
        },
    },
);

export const promoGlowClassName = classNames(
    'pointer-events-none',
    'absolute',
    '-right-10',
    '-top-10',
    'z-0',
    'h-28',
    'w-28',
    'rounded-full',
    'bg-white/55',
    'blur-2xl',
    'dark:bg-white/8',
);

export const promoContentClassName = classNames(
    'relative',
    'z-10',
    'flex',
    'min-h-[84px]',
    'max-w-[72%]',
    'flex-col',
    'justify-center',
    'gap-1.5',
);

export const promoTitleClassName = 'block text-[15px] font-semibold leading-5 tracking-tight text-fg-default';
export const promoDescriptionClassName = 'block text-[12px] leading-[16px] text-fg-secondary';

export const promoImageClassName = classNames(
    'pointer-events-none',
    'absolute',
    'bottom-[-4px]',
    'right-[-14px]',
    'z-0',
    'h-[98px]',
    'w-[220px]',
    'object-contain',
    'object-right-bottom',
    'opacity-95',
    'transition',
    'duration-300',
    'group-hover:scale-[1.025]',
);
