import dayjs from 'dayjs';
import type { Placeholder } from '~/models/placeholder.model';

const getWeek = () => {
    const date = new Date();
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    const firstDayOfMonth = new Date(year, month, 1);
    const firstDayOfWeek = firstDayOfMonth.getDay();
    const week = Math.ceil((day + firstDayOfWeek) / 7);
    return week;
};

export const getFixedPlaceholders = (): Pick<Placeholder, 'name' | 'template' | 'replacement'>[] => [
    {
        name: 'Year',
        template: 'year',
        replacement: dayjs().format('YYYY')
    },
    {
        name: 'Month',
        template: 'month',
        replacement: dayjs().format('MM')
    },
    {
        name: 'Short Month',
        template: 'mon',
        replacement: dayjs().format('M')
    },
    {
        name: 'Day',
        template: 'day',
        replacement: dayjs().format('DD')
    },
    {
        name: 'Short Day',
        template: 'd',
        replacement: dayjs().format('D')
    },
    {
        name: 'Week of Month',
        template: 'week_of_month',
        replacement: getWeek().toString()
    },
    {
        name: 'Hour 24',
        template: 'hour',
        replacement: dayjs().format('HH')
    },
    {
        name: 'Hour 12',
        template: 'hour_12',
        replacement: dayjs().format('hh')
    },
    {
        name: 'Short Hour 24',
        template: 'h',
        replacement: dayjs().format('H')
    },
    {
        name: 'Short Hour 12',
        template: 'h_12',
        replacement: dayjs().format('h')
    },
    {
        name: 'AM/PM',
        template: 'ampm',
        replacement: dayjs().format('A')
    },
    {
        name: 'Minute',
        template: 'minute',
        replacement: dayjs().format('mm')
    },
    {
        name: 'Short Minute',
        template: 'm',
        replacement: dayjs().format('m')
    },
    {
        name: 'Second',
        template: 'second',
        replacement: dayjs().format('ss')
    },
    {
        name: 'Short Second',
        template: 's',
        replacement: dayjs().format('s')
    }
];

export const PLACEHOLDER_PREFIX = '{%';
export const PLACEHOLDER_SUFFIX = '%}';

export const replaceFixedPlaceholder = (content: string) => {
    return content.replace(new RegExp(`${PLACEHOLDER_PREFIX}([^}]+)${PLACEHOLDER_SUFFIX}`, 'g'), (match, placeholder) => {
        const fixedPlaceholder = getFixedPlaceholders().find(p => p.template === placeholder);
        return fixedPlaceholder?.replacement || match;
    });
};
