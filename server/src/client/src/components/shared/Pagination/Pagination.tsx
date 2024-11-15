import classNames from 'classnames/bind';
import styles from './Pagination.module.scss';
const cx = classNames.bind(styles);

import * as Icon from '~/components/icon';

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
                                    <i role="button" aria-label="prev-page" className="fas fa-arrow-left" />
                                </button>
                            </div>
                            <div className={cx('item')}>
                                <button style={{ position: 'relative' }} className={cx('link')} onClick={() => props.onChange(1)}>
                                    <Icon.ChevronLeft width={18}/>
                                    <Icon.ChevronLeft
                                        style={{
                                            position: 'absolute',
                                            left: '13px'
                                        }}
                                        width={18}
                                    />
                                    <i role="button" aria-label="first-page" className="fa fa-angle-double-left" />
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className={cx('item', 'disabled')}>
                                <button className={cx('link')}>
                                    <Icon.ChevronLeft width={20}/>
                                    <i role="button" aria-label="prev-page" className="fas fa-arrow-left" />
                                </button>
                            </div>
                            <div className={cx('item', 'disabled')}>
                                <button style={{ position: 'relative' }} className={cx('link')}>
                                    <Icon.ChevronLeft width={18}/>
                                    <Icon.ChevronLeft
                                        style={{
                                            position: 'absolute',
                                            left: '13px'
                                        }}
                                        width={18}
                                    />
                                    <i role="button" aria-label="first-page" className="fa fa-angle-double-left" />
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
                                <button style={{ position: 'relative' }} className={cx('link')} onClick={() => props.onChange(last)}>
                                    <Icon.ChevronRight width={18}/>
                                    <Icon.ChevronRight
                                        width={18}
                                        style={{
                                            position: 'absolute',
                                            left: '13px'
                                        }}
                                    />
                                    <i role="button" aria-label="last-page" className="fa fa-angle-double-right" />
                                </button>
                            </div>
                            <div className={cx('item')}>
                                <button className={cx('link')} onClick={() => props.onChange(page + 1)}>
                                    <Icon.ChevronRight width={20}/>
                                    <i role="button" aria-label="next-page" className="fas fa-arrow-right" />
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className={cx('item', 'disabled')}>
                                <button style={{ position: 'relative' }} className={cx('link')}>
                                    <Icon.ChevronRight width={18}/>
                                    <Icon.ChevronRight
                                        width={18}
                                        style={{
                                            position: 'absolute',
                                            left: '13px'
                                        }}
                                    />
                                    <i role="button" aria-label="last-page" className="fa fa-angle-double-right" />
                                </button>
                            </div>
                            <div className={cx('item', 'disabled')}>
                                <button className={cx('link')}>
                                    <Icon.ChevronRight width={20}/>
                                    <i role="button" aria-label="next-page" className="fas fa-arrow-right" />
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
