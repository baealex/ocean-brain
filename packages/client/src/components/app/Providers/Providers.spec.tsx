import { render } from '@testing-library/react';

import Providers from './Providers';

describe('<Providers />', () => {
    it('renders <Providers /> component', () => {
        const { container } = render(<Providers />);
        expect(container).toBeInTheDocument();
    });
});
