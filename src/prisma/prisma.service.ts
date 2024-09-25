import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
    extends PrismaClient
    implements OnModuleInit, OnModuleDestroy
{
    private tenantConfig: {
        database: string;
        user: string;
        password: string;
    } | null = null;

    constructor() {
        super();
        if (!PrismaClient) {
            throw new Error('@prisma/client did not initialize yet. Please run "prisma generate" and try to import it again.');
        }
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }

    async setTenantConfig(database: string, user: string, password: string) {
        // Disconnect current connection
        await this.$disconnect();

        // Reinitialize PrismaClient with new configuration
        this.tenantConfig = { database, user, password };
        await this.$connect(); // Reconnect with new configuration

        this.$use(async (params: any, next: any) => {
            // Apply tenant-specific configuration
            if (this.tenantConfig) {
                await this
                    .$executeRaw`SET search_path TO ${this.tenantConfig.database}`;
            }
            return next(params);
        });
    }
}