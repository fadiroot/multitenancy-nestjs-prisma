import { Injectable } from '@nestjs/common';
import { DynamicPrismaClientFactory } from './database/dynamic-prisma-client.factory';

@Injectable()
export class AppService {
    constructor(private readonly dynamicPrismaClientFactory: DynamicPrismaClientFactory) {}

    getHello(): string {
        return 'Hello World!';
    }

    async getUsersForTenant(tenant: any): Promise<any[]> {
        return this.dynamicPrismaClientFactory.getUsersForTenant(tenant);
    }
}
