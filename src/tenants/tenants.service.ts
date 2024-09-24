import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTenantDto } from './dto/create-user.dto';
import { PrismaClient, Tenant } from '@prisma/client';
import Docker = require('dockerode');
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

    async createPostgresContainer(tenantName: string): Promise<{
        containerId: string;
        port: number;
        dbName: string;
        dbUser: string;
        dbPassword: string;
        host: string;
    }> {
        const containerName = `postgres-${tenantName}`;
        const port = this.getAvailablePort();
        const dbName = `db_${tenantName}`;
        const dbUser = `user_${tenantName}`;
        const dbPassword = this.generateSecurePassword();
        const host = tenantName;
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

        // Wait for Postgres to initialize
        await this.waitForPostgresToBeReady(port, container.id);

        return {
            containerId: container.id,
            port,
            dbName,
            dbUser,
            dbPassword,
            host,
        };
    }

    // Function to wait for Postgres to be ready before applying migrations
    private async waitForPostgresToBeReady(port: number, containerId: string) {
        console.log(`Waiting for Postgres on port ${port} to be ready...`);
        const delay = (ms: number) =>
            new Promise((resolve) => setTimeout(resolve, ms));

        // Wait for the container to start and be ready
        let retries = 60; // Increase retries
        while (retries) {
            try {
                // Check container logs for initialization completion
                const container = await this.docker.getContainer(containerId);
                const logs = await container.logs({
                    stdout: true,
                    stderr: true,
                    tail: 50,
                });
                const logsString = logs.toString();
                if (
                    logsString.includes(
                        'PostgreSQL init process complete; ready for start up.',
                    )
                ) {
                    console.log(`Postgres on port ${port} is ready`);
                    console.log('the container of postgres db created');
                    break;
                }

                // Use pg_isready as a secondary check
                await execAsync(`pg_isready -h localhost -p ${port}`);
                console.log(`Postgres on port ${port} is ready (pg_isready)`);
                console.log('the container of postgres db created');
                break;
            } catch (err) {
                retries -= 1;
                console.log(
                    `Waiting for Postgres on port ${port} to be ready... (${retries} retries left)`,
                );
                await delay(5000); // Increase delay to 5 seconds
            }
        }
        if (retries === 0) {
            console.error(
                `Postgres on port ${port} did not become ready after multiple attempts`,
            );
            try {
                const container = await this.docker.getContainer(containerId);
                const logs = await container.logs({
                    stdout: true,
                    stderr: true,
                });
                console.error('Container logs:', logs.toString());
            } catch (logError) {
                console.error('Failed to retrieve container logs:', logError);
            }
            throw new Error(
                `Postgres on port ${port} did not become ready in time`,
            );
        }
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

        // Create a tenant record in the primary database
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

        // Set up the tenant's database schema using Prisma migrations
        await this.runPrismaMigrations(
            containerInfo.dbName,
            containerInfo.dbUser,
            containerInfo.dbPassword,
            containerInfo.port,
        );
        // Ensure the tenant's database is ready before returning
        await this.waitForPostgresToBeReady(tenant.dbPort, tenant.containerId);

        // Return the created tenant
        return tenant;
    }

    private async runPrismaMigrations(
        dbName: string,
        dbUser: string,
        dbPassword: string,
        port: number,
    ): Promise<void> {
        const connectionString = `postgresql://${dbUser}:${dbPassword}@localhost:${port}/${dbName}`;
        console.log(`Connection string: ${connectionString}`);

        // Set up a new Prisma client for the tenant's database
        const prisma = new PrismaClient({
            datasources: {
                db: {
                    url: `postgresql://${dbUser}:${dbPassword}@host.docker.internal:${port}/${dbName}`,
                },
            },
        });

        try {
            // Run migrations
            await prisma.$executeRawUnsafe('SELECT 1'); // Test the connection
            console.log('Database connection successful');

            // Run the actual migrations
            await execAsync(
                `DATABASE_URL="${connectionString}" npx prisma migrate deploy`,
            );
            console.log('Migrations applied successfully');
        } catch (error) {
            console.error('Error running migrations:', error);
            throw error;
        } finally {
            // Close the Prisma connection
            await prisma.$disconnect();
        }
    }

    private generateSecurePassword(): string {
        // Implement secure password generation
        return 'securePassword123!'; // Placeholder - replace with actual secure generation
    }
}
