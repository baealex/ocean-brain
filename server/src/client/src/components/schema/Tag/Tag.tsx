import styles from './Tag.module.scss';
import classNames from 'classnames/bind';
const cx = classNames.bind(styles);

import { createReactInlineContentSpec } from '@blocknote/react';

import { getTagURL } from '~/modules/url';
import { useNavigate } from 'react-router';

export const Tag = createReactInlineContentSpec(
    {
        type: 'tag',
        propSchema: {
            id: { default: '' },
            tag: { default: '@Unknown' }
        },
        content: 'none'
    },
    {
        render: (props) => {
            const navigate = useNavigate();

            return (
                <button onClick={() => navigate(getTagURL(props.inlineContent.props.id))}>
                    <span className={cx('Tag', 'bg-zinc-200 text-black dark:bg-zinc-700 dark:text-zinc-200 text-xs rounded-full px-2 py-1')}>
                        {props.inlineContent.props.tag}
                    </span>
                </button>
            )
        }
    }
);

export default Tag;
