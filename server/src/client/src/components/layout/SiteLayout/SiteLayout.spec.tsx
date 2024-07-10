import { render } from '@testing-library/react';

import SiteLayout from './SiteLayout';

describe('<SiteLayout />', () => {
    it('renders <SiteLayout /> component', () => {
        const { container } = render(<SiteLayout />);
        expect(container).toBeInTheDocument();
    });
});
