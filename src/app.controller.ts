import { Controller, Get, Req } from '@nestjs/common';
import { AppService } from './app.service';
import { Request } from 'express';

@Controller()
export class AppController {
    constructor(private readonly appService: AppService) {}

    @Get()
    getHello(): string {
        return this.appService.getHello();
    }

    @Get('tenant')
    getTenantInfo(@Req() req: Request): any {
        const tenant = (req as any).tenant;
        return {
            message: 'Tenant Info Retrieved Successfully',
            tenant,
        };
    }

    @Get('tenant/users')
    async getTenantUsers(@Req() req: Request): Promise<any[]> {
        const tenant = (req as any).tenant;
        return this.appService.getUsersForTenant(tenant);
    }
}
