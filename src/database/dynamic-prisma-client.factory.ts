import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { databaseConfig } from '../config/database.config';
import { execSync } from 'child_process';
import * as path from 'path';

@Injectable()
export class DynamicPrismaClientFactory {
    private clients: Map<string, PrismaClient> = new Map();
    private masterClient: PrismaClient | undefined;

    async getClientForTenant(tenant: any): Promise<PrismaClient> {
        const existingClient = this.clients.get(tenant.dbName);

        if (existingClient) {
            return existingClient;
        }

        const client = new PrismaClient({
            datasources: {
                db: {
                    url: `postgresql://${tenant.dbUser}:${tenant.dbPassword}@${databaseConfig.tenant.host}:${databaseConfig.tenant.port}/${tenant.dbName}?schema=public`,
                },
            },
        });

        this.clients.set(tenant.dbName, client);
        return client;
    }

    getMasterClient(): PrismaClient {
        if (!this.masterClient) {
            this.masterClient = new PrismaClient({
                datasources: {
                    db: {
                        url: databaseConfig.master.url,
                    },
                },
            });
        }
        return this.masterClient;
    }

    async createTenantDatabase(tenantInfo: {
        dbName: string;
        dbUser: string;
        dbPassword: string;
    }): Promise<void> {
        const masterClient = this.getMasterClient();

        // Create the database
        await masterClient.$executeRawUnsafe(
            `CREATE DATABASE "${tenantInfo.dbName}"`,
        );

        // Create the user and grant privileges
        await masterClient.$executeRawUnsafe(
            `CREATE USER "${tenantInfo.dbUser}" WITH PASSWORD '${tenantInfo.dbPassword}'`,
        );
        await masterClient.$executeRawUnsafe(
            `GRANT ALL PRIVILEGES ON DATABASE "${tenantInfo.dbName}" TO "${tenantInfo.dbUser}"`,
        );

        // Apply migrations to the new database
        await this.applyMigrationsToTenant(tenantInfo);
    }

    async applyMigrationsToTenant(tenantInfo: {
        dbName: string;
        dbUser: string;
        dbPassword: string;
    }): Promise<void> {
        const tenantDatabaseUrl = `postgresql://${tenantInfo.dbUser}:${tenantInfo.dbPassword}@${databaseConfig.tenant.host}:${databaseConfig.tenant.port}/${tenantInfo.dbName}?schema=public`;

        // Set the DATABASE_URL environment variable for Prisma CLI
        process.env.DATABASE_URL = tenantDatabaseUrl;

        // Run Prisma migrations
        const prismaPath = path.join(
            __dirname,
            '..',
            '..',
            'node_modules',
            '.bin',
            'prisma',
        );
        execSync(`${prismaPath} migrate deploy`, { stdio: 'inherit' });

        // Optionally, run seeds if you have any
        // execSync(`${prismaPath} db seed`, { stdio: 'inherit' });

        // Reset the DATABASE_URL
        process.env.DATABASE_URL = databaseConfig.master.url;
    }
}
