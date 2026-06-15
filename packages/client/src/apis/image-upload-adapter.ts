import axios from 'axios';

export async function uploadImage({ base64, externalSrc }: { base64?: string; externalSrc?: string }): Promise<string> {
    if (base64) {
        const { data } = await axios.post('/api/image', { image: base64 });
        return data.url;
    }

    if (externalSrc) {
        const { data } = await axios.post('/api/image-from-src', { src: externalSrc });
        return data.url;
    }

    throw new Error('No file or src provided');
}
