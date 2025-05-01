import { render } from '@testing-library/react';

import __NAME__ from './__NAME__';

describe('<__NAME__ />', () => {
    it('renders <__NAME__ /> component', () => {
        const { container } = render(<__NAME__ />);
        expect(container).toBeInTheDocument();
    });
});
