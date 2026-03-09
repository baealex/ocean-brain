import { render } from '@testing-library/react';

import Providers from './Providers';

describe('<Providers />', () => {
    it('renders <Providers /> component', () => {
        const { container, getByText } = render(
            <Providers>
                <div>Provider Child</div>
            </Providers>
        );

        expect(container).toBeInTheDocument();
        expect(getByText('Provider Child')).toBeInTheDocument();
    });
});
