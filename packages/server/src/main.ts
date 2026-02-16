import app from './app.js';

const PORT = Number(process.env.PORT || 6683);
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => console.log(`http server listen on ${HOST}:${PORT}`));
