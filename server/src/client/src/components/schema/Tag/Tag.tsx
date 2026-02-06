import styles from './Tag.module.scss';
import classNames from 'classnames/bind';
const cx = classNames.bind(styles);

import { createReactInlineContentSpec } from '@blocknote/react';
import { Link } from 'react-router-dom';

import { getTagURL } from '~/modules/url';

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
        render: (props) => (
            <span className={cx('Tag', 'bg-pastel-blue-200 text-xs rounded-[6px_2px_7px_2px/2px_5px_2px_6px] px-2 py-1 border border-zinc-600 font-bold')}>
                <Link to={getTagURL(props.inlineContent.props.id)}>
                    <span className="text-zinc-800">
                        {props.inlineContent.props.tag}
                    </span>
                </Link>
            </span>
        )
    }
);

export default Tag;
