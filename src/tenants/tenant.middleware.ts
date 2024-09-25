import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from './tenants.service';
import { DynamicPrismaClientFactory } from '../database/dynamic-prisma-client.factory';

// Analysis:
// 1. Purpose: This middleware is designed to handle multi-tenancy in a NestJS application.
// 2. Functionality:
//    - Extracts the domain from the request
//    - Retrieves tenant information based on the domain
//    - Sets up database configuration for the specific tenant
//    - Attaches tenant information to the request object

interface CustomRequest extends Request {
    tenant?: any; // This could be improved by defining a specific Tenant interface
    prismaClient?: any;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
    constructor(
        private tenantService: TenantService,
        private dynamicPrismaClientFactory: DynamicPrismaClientFactory,
    ) {}

    async use(req: CustomRequest, res: Response, next: NextFunction) {
        // Extract domain from request
        const domain = req.get('host');
        if (!domain) {
            return res
                .status(400)
                .json({ message: 'Domain header is missing' });
        }

        // Retrieve tenant information
        const tenant = await this.tenantService.getTenantByDomain(domain);

        if (!tenant) {
            return res.status(404).json({ message: 'Tenant not found' });
        }

        // Attach tenant information to the request
        req.tenant = tenant;

        try {
            req.prismaClient = await this.dynamicPrismaClientFactory.getClientForTenant(tenant);
            next();
        } catch (error) {
            console.error('Error getting Prisma client:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }
}

// Key points:
// - The middleware is crucial for implementing multi-tenancy
// - It ensures each request is associated with the correct tenant and database
// - Error handling is implemented for missing domain and non-existent tenants
// - The middleware modifies the request object, which could have implications for type safety
// - The PrismaService is used to dynamically set database configurations
