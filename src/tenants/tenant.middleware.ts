import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from './tenants.service';
import { PrismaService } from 'src/prisma/prisma.service';

interface CustomRequest extends Request {
    tenant?: any; // Adjust type if needed
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
    constructor(
        private tenantService: TenantService,
        private prismaService: PrismaService,
    ) {}

    async use(req: CustomRequest, res: Response, next: NextFunction) {
        const domain = req.get('host');
        if (!domain) {
            return res
                .status(400)
                .json({ message: 'Domain header is missing' });
        }

        const tenant = await this.tenantService.getTenantByDomain(domain);

        if (!tenant) {
            return res.status(404).json({ message: 'Tenant not found' });
        }
        // Set tenant configuration for PrismaService
        this.prismaService.setTenantConfig(
            tenant.dbName,
            tenant.dbUser,
            tenant.dbPassword,
        );
        req.tenant = tenant;
        next();
    }
}
