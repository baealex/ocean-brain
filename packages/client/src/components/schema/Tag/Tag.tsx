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
            <span className={cx('Tag')}>
                <Link to={getTagURL(props.inlineContent.props.id)}>
                    <span className="text-fg-default">
                        {props.inlineContent.props.tag}
                    </span>
                </Link>
            </span>
        )
    }
);

export default Tag;
