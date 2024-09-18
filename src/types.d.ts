import { Tenant } from '@prisma/client';

declare global {
    namespace Express {
        interface Request {
            tenant?: Tenant;
        }
    }
}
