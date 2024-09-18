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

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }

    setTenantConfig(database: string, user: string, password: string) {
        this.$disconnect(); // Disconnect current connection
        this.$connect(); // Reconnect with new configuration

        this.$use(async (params, next) => {
            // Apply tenant-specific configuration
            if (this.tenantConfig) {
                this
                    .$executeRaw`SET search_path TO ${this.tenantConfig.database}`;
            }
            return next(params);
        });

        this.tenantConfig = { database, user, password };
    }
}
