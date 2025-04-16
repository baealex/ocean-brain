import { fetchPlaceholders } from '~/apis/placeholder.api';
import { useQuery } from '@tanstack/react-query';
import { Callout } from '~/components/shared';

const Placeholder = () => {
    const { data: placeholders } = useQuery({
        queryKey: ['placeholders'],
        queryFn: () => fetchPlaceholders()
    });

    return (
        <div>
            <Callout>
                When you clone a note, this will be replaced.
            </Callout>
            <pre>{JSON.stringify(placeholders, null, 2)}</pre>
        </div>
    );
};

export default Placeholder;
