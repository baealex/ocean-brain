import styles from './Reference.module.scss';
import classNames from 'classnames/bind';
const cx = classNames.bind(styles);

import { createReactInlineContentSpec } from '@blocknote/react';
import { Link } from 'react-router-dom';

import { getNoteURL } from '~/modules/url';

const Reference = createReactInlineContentSpec(
    {
        type: 'reference',
        propSchema: {
            id: { default: '' },
            title: { default: 'Unknown' }
        },
        content: 'none'
    },
    {
        render: (props) => (
            <Link to={getNoteURL(props.inlineContent.props.id)}>
                <span className={cx('Reference', 'bg-zinc-200 text-black dark:bg-zinc-700 dark:text-zinc-200 text-xs px-2 py-1')}>
                    [{props.inlineContent.props.title}]
                </span>
            </Link>
        )
    }
);

export default Reference;
