export const databaseConfig = {
    master: {
        url: process.env.MASTER_DATABASE_URL,
    },
    tenant: {
        host: process.env.TENANT_DB_HOST || 'db',
        port: 5432,
    },
};
