import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TenantsModule } from './tenants/tenants.module';
import { PrismaModule } from './prisma/prisma.module';
import { TenantMiddleware } from './tenants/tenant.middleware';
import { DynamicPrismaClientFactory } from './database/dynamic-prisma-client.factory';

@Module({
    imports: [TenantsModule, PrismaModule],
    controllers: [AppController],
    providers: [AppService, DynamicPrismaClientFactory],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(TenantMiddleware).forRoutes('tenant');
    }
}
