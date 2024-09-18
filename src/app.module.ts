import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TenantsModule } from './tenants/tenants.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
    imports: [TenantsModule, PrismaModule],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
