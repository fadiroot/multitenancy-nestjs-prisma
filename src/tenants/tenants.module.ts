import { Module } from '@nestjs/common';
import { TenantService } from './tenants.service';
import { TenantController } from './tenants.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [TenantController],
    providers: [TenantService],
    exports: [TenantService],
})
export class TenantsModule {}
