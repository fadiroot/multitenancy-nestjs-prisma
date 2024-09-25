import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { databaseConfig } from '../config/database.config';
import { execSync } from 'child_process';
import * as path from 'path';

@Injectable()
export class DynamicPrismaClientFactory implements OnModuleDestroy {
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
                    url: `postgresql://${tenant.dbUser}:${tenant.dbPassword}@host.docker.internal:${tenant.dbPort}/${tenant.dbName}?schema=public`,
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

        await masterClient.$executeRawUnsafe(
            `CREATE DATABASE "${tenantInfo.dbName}"`,
        );

        await masterClient.$executeRawUnsafe(
            `CREATE USER "${tenantInfo.dbUser}" WITH PASSWORD '${tenantInfo.dbPassword}'`,
        );
        await masterClient.$executeRawUnsafe(
            `GRANT ALL PRIVILEGES ON DATABASE "${tenantInfo.dbName}" TO "${tenantInfo.dbUser}"`,
        );

        await this.applyMigrationsToTenant(tenantInfo);
    }

    async applyMigrationsToTenant(tenantInfo: {
        dbName: string;
        dbUser: string;
        dbPassword: string;
    }): Promise<void> {
        const tenantDatabaseUrl = `postgresql://${tenantInfo.dbUser}:${tenantInfo.dbPassword}@${databaseConfig.tenant.host}:${databaseConfig.tenant.port}/${tenantInfo.dbName}?schema=public`;

        process.env.DATABASE_URL = tenantDatabaseUrl;

        const prismaPath = path.join(
            __dirname,
            '..',
            '..',
            'node_modules',
            '.bin',
            'prisma',
        );
        execSync(`${prismaPath} migrate deploy`, { stdio: 'inherit' });

        process.env.DATABASE_URL = databaseConfig.master.url;
    }

    async getUsersForTenant(tenant: any): Promise<any[]> {
        const client = await this.getClientForTenant(tenant);
        const users = await client.$queryRaw`SELECT * FROM "User"`;
        return users as any[];
    }

    async onModuleDestroy() {
        for (const client of this.clients.values()) {
            await client.$disconnect();
        }
        if (this.masterClient) {
            await this.masterClient.$disconnect();
        }
    }

    async disconnectClient(tenantDbName: string) {
        const client = this.clients.get(tenantDbName);
        if (client) {
            await client.$disconnect();
            this.clients.delete(tenantDbName);
        }
    }
}
