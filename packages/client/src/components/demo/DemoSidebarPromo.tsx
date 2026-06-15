import feedbackIllustration from './assets/send-feedback-illustration.png';
import starIllustration from './assets/star-ocean-brain-illustration.png';
import {
    promoCardVariants,
    promoContentClassName,
    promoDescriptionClassName,
    promoGlowClassName,
    promoImageClassName,
    promoRootClassName,
    promoTitleClassName,
} from './DemoSidebarPromo.variants';

const promoItems = [
    {
        tone: 'star',
        title: 'Star Ocean Brain',
        description: 'Like the demo? Give us a star.',
        href: 'https://github.com/baealex/ocean-brain',
        image: starIllustration,
        imageAlt: 'Star, notebook, and ocean wave illustration',
    },
    {
        tone: 'feedback',
        title: 'Send Feedback',
        description: 'Tell us what to improve.',
        href: 'https://tally.so/r/yP7720',
        image: feedbackIllustration,
        imageAlt: 'Speech bubbles, note, and cursor illustration',
    },
] as const;

const DemoSidebarPromo = () => {
    return (
        <section className={promoRootClassName} aria-label="Demo actions">
            {promoItems.map((item) => (
                <a
                    key={item.title}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className={promoCardVariants({ tone: item.tone })}
                >
                    <span className={promoGlowClassName} />
                    <span className={promoContentClassName}>
                        <span className={promoTitleClassName}>{item.title}</span>
                        <span className={promoDescriptionClassName}>{item.description}</span>
                    </span>
                    <img src={item.image} alt={item.imageAlt} className={promoImageClassName} loading="lazy" />
                </a>
            ))}
        </section>
    );
};

export default DemoSidebarPromo;
