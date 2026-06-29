import axios from 'axios';

export async function uploadImage({ base64 }: { base64?: string }): Promise<string> {
    if (base64) {
        const { data } = await axios.post('/api/image', { image: base64 });
        return data.url;
    }

    throw new Error('No file provided');
}
