const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { parseEnv } = require('node:util');

const backend = resolve(__dirname, '..');

function parseNeonConnection(value, name) {
    try {
        const url = new URL(value);
        const username = decodeURIComponent(url.username);
        const password = decodeURIComponent(url.password);
        if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname.endsWith('.neon.tech')
            || url.pathname.length < 2 || !username || !password) {
            throw new Error();
        }

        const options = new URLSearchParams({
            sslmode: 'verify-full',
            sslfactory: 'org.postgresql.ssl.DefaultJavaSSLFactory',
        });
        const channelBinding = url.searchParams.get('channel_binding');
        if (channelBinding) options.set('channelBinding', channelBinding);
        return {
            url: `jdbc:postgresql://${url.host}${url.pathname}?${options}`,
            username,
            password,
        };
    } catch {
        throw new Error(`${name} is missing or is not a Neon PostgreSQL connection string.`);
    }
}

function escapeProperty(value) {
    return value.replace(/[\\\u0000-\u0020\u007f-\uffff]/g, character =>
        `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

function configureNeon() {
    const env = {};
    for (const name of ['.env', '.env.local']) {
        const file = resolve(backend, '..', name);
        if (existsSync(file)) Object.assign(env, parseEnv(readFileSync(file, 'utf8')));
    }
    const pooled = parseNeonConnection(env.DATABASE_URL, 'DATABASE_URL');
    parseNeonConnection(env.DATABASE_URL_UNPOOLED, 'DATABASE_URL_UNPOOLED');

    const directory = resolve(backend, 'config');
    const destination = resolve(directory, 'supaclothes-neon.properties');
    const lines = Object.entries(pooled).map(([key, value]) => `spring.datasource.${key}=${escapeProperty(value)}`);
    mkdirSync(directory, { recursive: true });
    writeFileSync(destination, `${lines.join('\n')}\n`, { mode: 0o600 });
}

try {
    configureNeon();
    console.log('Spring Boot is configured to use the pooled Neon connection.');
} catch (error) {
    console.error(error.code ? `Unable to prepare the local Neon settings (${error.code}).` : error.message);
    process.exitCode = 1;
}
