import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTenantDto } from './dto/create-user.dto';
import { Tenant } from '@prisma/client';
import Docker = require('dockerode');

@Injectable()
export class TenantService {
    private readonly docker: Docker;
    private usedPorts: Set<number> = new Set();
    private readonly MIN_PORT = 5433; // Start from 5433 to avoid conflict with the main Postgres instance
    private readonly MAX_PORT = 5533; // Arbitrary upper limit, adjust as needed

    constructor(private prisma: PrismaService) {
        this.docker = new Docker();
    }

    async getTenantByDomain(domain: string): Promise<Tenant | null> {
        return this.prisma.tenant.findUnique({
            where: { domain },
        });
    }

    private getAvailablePort(): number {
        for (let port = this.MIN_PORT; port <= this.MAX_PORT; port++) {
            if (!this.usedPorts.has(port)) {
                this.usedPorts.add(port);
                return port;
            }
        }
        throw new Error('No available ports');
    }

    async createPostgresContainer(
        tenantName: string,
    ): Promise<{
        containerId: string;
        port: number;
        dbName: string;
        dbUser: string;
        dbPassword: string;
    }> {
        const containerName = `postgres-${tenantName}`;
        const port = this.getAvailablePort();
        const dbName = `db_${tenantName}`;
        const dbUser = `user_${tenantName}`;
        const dbPassword = this.generateSecurePassword();

        await this.docker.pull('postgres:latest', {});

        const container = await this.docker.createContainer({
            Image: 'postgres:latest',
            name: containerName,
            Env: [
                `POSTGRES_USER=${dbUser}`,
                `POSTGRES_PASSWORD=${dbPassword}`,
                `POSTGRES_DB=${dbName}`,
            ],
            HostConfig: {
                PortBindings: {
                    '5432/tcp': [{ HostPort: port.toString() }],
                },
                NetworkMode: 'tenant-network',
            },
        });

        await container.start();

        return {
            containerId: container.id,
            port,
            dbName,
            dbUser,
            dbPassword,
        };
    }

    async createTenant(createTenantDto: CreateTenantDto): Promise<Tenant> {
        const { name, domain } = createTenantDto;

        const existingTenant = await this.prisma.tenant.findUnique({
            where: { domain },
        });

        if (existingTenant) {
            throw new Error('A tenant with this domain already exists');
        }

        const containerInfo = await this.createPostgresContainer(
            name.toLowerCase().replace(/\s/g, '_'),
        );
        console.log('Container created successfully:', containerInfo);

        const tenant = await this.prisma.tenant.create({
            data: {
                name,
                domain,
                dbName: containerInfo.dbName,
                dbUser: containerInfo.dbUser,
                dbPassword: containerInfo.dbPassword,
                isUsed: true,
                dbPort: containerInfo.port,
                containerId: containerInfo.containerId,
            },
        });

        return tenant;
    }

    private generateSecurePassword(): string {
        // Implement secure password generation
        return 'securePassword123!'; // Placeholder - replace with actual secure generation
    }
}
