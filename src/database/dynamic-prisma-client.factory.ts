import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { databaseConfig } from '../config/database.config';

@Injectable()
export class DynamicPrismaClientFactory {
    private clients: Map<string, PrismaClient> = new Map();
    private masterClient: PrismaClient | undefined; // Explicitly set to undefined

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
}
