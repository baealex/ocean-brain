import classNames from 'classnames/bind';
import styles from './Pagination.module.scss';
const cx = classNames.bind(styles);

import * as Icon from '@/shared/ui/icon';

export interface Props {
    page: number;
    last: number;
    onChange: (page: number) => void;
}

function Pagination(props: Props) {
    const page = Number(props.page);
    const last = Number(props.last);

    const pageRange = [];
    for (let num = 1; num < last + 1; num++) {
        if (page == num) {
            pageRange.push(num);
        }
        else if (page == 1 && num < page + 5) {
            pageRange.push(num);
        }
        else if (page == 2 && num < page + 4) {
            pageRange.push(num);
        }
        else if (num > page - 3 && num < page + 3) {
            pageRange.push(num);
        }
        else if (page == last - 1 && num > page - 4) {
            pageRange.push(num);
        }
        else if (page == last && num > page - 5) {
            pageRange.push(num);
        }
    }

    return (
        <>
            <nav className={cx('nav')}>
                <div className={cx('action', 'prev')}>
                    {page != 1 ? (
                        <>
                            <div className={cx('item')}>
                                <button className={cx('link')} onClick={() => props.onChange(page - 1)}>
                                    <Icon.ChevronLeft width={20}/>
                                </button>
                            </div>
                            <div className={cx('item')}>
                                <button className={cx('link', 'left-skip')} onClick={() => props.onChange(1)}>
                                    <Icon.ChevronLeft width={16}/>
                                    <Icon.ChevronLeft width={16}/>
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className={cx('item', 'disabled')}>
                                <button className={cx('link')}>
                                    <Icon.ChevronLeft width={20}/>
                                </button>
                            </div>
                            <div className={cx('item', 'disabled')}>
                                <button className={cx('link', 'left-skip')}>
                                    <Icon.ChevronLeft width={16}/>
                                    <Icon.ChevronLeft width={16}/>
                                </button>
                            </div>
                        </>
                    )}
                </div>
                <div className={cx('pages')}>
                    {pageRange.map((item, idx) => (
                        <div
                            key={idx}
                            className={cx('item', { active: page == item })}>
                            <button className={cx('link')} onClick={() => props.onChange(item)}>
                                {item}
                            </button>
                        </div>
                    ))}
                </div>
                <div className={cx('action', 'next')}>
                    {page != last ? (
                        <>
                            <div className={cx('item')}>
                                <button className={cx('link', 'right-skip')} onClick={() => props.onChange(last)}>
                                    <Icon.ChevronRight width={16}/>
                                    <Icon.ChevronRight width={16}/>
                                </button>
                            </div>
                            <div className={cx('item')}>
                                <button className={cx('link')} onClick={() => props.onChange(page + 1)}>
                                    <Icon.ChevronRight width={20}/>
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className={cx('item', 'disabled')}>
                                <button className={cx('link', 'right-skip')}>
                                    <Icon.ChevronRight width={16}/>
                                    <Icon.ChevronRight width={16} />
                                </button>
                            </div>
                            <div className={cx('item', 'disabled')}>
                                <button className={cx('link')}>
                                    <Icon.ChevronRight width={20}/>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </nav>
        </>
    );
}

export default Pagination;
