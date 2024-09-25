import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTenantDto } from './dto/create-user.dto';
import { Tenant } from 'src/generated/master-client';
import Docker = require('dockerode');
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

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
                await execAsync(
                    `pg_isready -h host.docker.internal -p ${port}`,
                );
                console.log(`Postgres on port ${port} is ready (pg_isready)`);
                console.log('the container of postgres db created');
                break;
            } catch (err) {
                retries -= 1;
                console.log(
                    `${new Date().toISOString()} Waiting for Postgres on port ${port} to be ready... (${retries} retries left)`,
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
        console.log(
            `${new Date().toISOString()} Container created successfully:`,
            containerInfo,
        );

        // Set up the tenant's database schema
        await this.setupTenantSchema(
            containerInfo.dbName,
            containerInfo.dbUser,
            containerInfo.dbPassword,
            containerInfo.port,
        );

        // Ensure the tenant's database is ready before returning
        await this.waitForPostgresToBeReady(
            containerInfo.port,
            containerInfo.containerId,
        );

        // Create initial data (roles, permissions, etc.)

        // Create a tenant record in the primary database
        const tenant = await this.prisma.tenant.create({
            data: {
                name,
                domain,
                dbName: containerInfo.dbName,
                dbUser: containerInfo.dbUser,
                dbPassword: containerInfo.dbPassword,
                isUsed: true,
                createdBy: 'admin',
                dbPort: containerInfo.port,
                containerId: containerInfo.containerId,
                databaseUrl: `postgresql://${containerInfo.dbUser}:${containerInfo.dbPassword}@host.docker.internal:${containerInfo.port}/${containerInfo.dbName}`,
            }, // Type assertion to bypass the type error
        });

        // Return the created tenant
        return tenant;
    }

    async createTenantDatabase(tenantId: string): Promise<void> {
        const tenantDbUrl = `postgresql://user:password@localhost:5432/${tenantId}`;

        // Create the tenant database
        await this.prisma.$executeRawUnsafe(`CREATE DATABASE ${tenantId}`);

        // Update the .env file or environment variables
        this.updateEnvFile(tenantDbUrl);

        // Generate Prisma client for the tenant
        await this.generatePrismaClient();
    }

    private async updateEnvFile(tenantDbUrl: string): Promise<void> {
        const envFilePath = path.resolve(__dirname, '../../.env');
        const envFileContent = await fs.readFile(envFilePath, 'utf-8');
        const updatedEnvFileContent = envFileContent.replace(
            /DATABASE_URL=.*/,
            `DATABASE_URL=${tenantDbUrl}`,
        );
        await fs.writeFile(envFilePath, updatedEnvFileContent);
    }

    private generatePrismaClient(): Promise<void> {
        return new Promise((resolve, reject) => {
            exec('npm run generate-tenant-prisma', (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    private async setupTenantSchema(
        dbName: string,
        dbUser: string,
        dbPassword: string,
        port: number,
    ): Promise<void> {
        const connectionString = `postgresql://${dbUser}:${dbPassword}@host.docker.internal:${port}/${dbName}`;

        // Update the DATABASE_URL in the environment
        process.env.DATABASE_URL = connectionString;

        try {
            const schemaPath = path.resolve(
                __dirname,
                '../../prisma/tenant-schema.prisma',
            );

            // Use prisma db push instead of migrate deploy
            const pushCommand = `npx prisma db push --schema="${schemaPath}"`;
            const { stdout, stderr } = await execAsync(pushCommand);
            console.log('Database push output:', stdout);
            if (stderr) console.error('Database push error:', stderr);

            console.log('Tenant schema setup completed successfully');
        } catch (error) {
            console.error(
                `${new Date().toISOString()} Error setting up tenant schema:`,
                error,
            );
            throw error;
        }
    }

    private generateSecurePassword(): string {
        // Implement secure password generation
        return 'securePassword123!'; // Placeholder - replace with actual secure generation
    }

    async generateTenantMigration(name: string): Promise<string> {
        try {
            const timestamp = new Date()
                .toISOString()
                .replace(/[-:]/g, '')
                .split('.')[0];
            const migrationName = `${timestamp}_${name}`;
            const migrationDir = path.join(
                process.cwd(),
                'prisma',
                'migrations',
                'tenant',
            );
            const sqlFilePath = path.join(migrationDir, `${migrationName}.sql`);

            // Ensure the migration directory exists
            await fs.mkdir(migrationDir, { recursive: true });

            // Generate the migration SQL
            const { stdout, stderr } = await execAsync(
                'npm run tenant:migrate:diff',
            );

            if (stderr) {
                console.error('Migration generation error:', stderr);
                throw new Error('Failed to generate migration SQL');
            }

            // Write the SQL to a file
            await fs.writeFile(sqlFilePath, stdout);

            console.log(`Migration SQL generated successfully: ${sqlFilePath}`);
            return sqlFilePath;
        } catch (error) {
            console.error('Error generating tenant migration:', error);
            throw error;
        }
    }

    async applyMigrationToAllTenants(): Promise<void> {
        const tenants = await this.prisma.tenant.findMany();
        for (const tenant of tenants) {
            await this.applyTenantMigration(tenant);
        }
    }

    async applyTenantMigration(tenant: Tenant): Promise<void> {
        const migrationDir = path.join(
            process.cwd(),
            'prisma',
            'migrations',
            'tenant',
        );

        try {
            // Create SchemaVersion table if it doesn't exist
            const createSchemaVersionTableSQL = `
                CREATE TABLE IF NOT EXISTS "SchemaVersion" (
                    "id" SERIAL PRIMARY KEY,
                    "version" VARCHAR(255) NOT NULL UNIQUE,
                    "appliedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            `;
            await this.executeSQLOnTenant(tenant, createSchemaVersionTableSQL);

            // Get all migration files
            const migrationFiles = await fs.readdir(migrationDir);
            const sqlFiles = migrationFiles
                .filter((file) => file.endsWith('.sql'))
                .sort();

            for (const sqlFile of sqlFiles) {
                const version = sqlFile.split('_')[0];

                // Check if migration has been applied
                const checkVersionSQL = `SELECT * FROM "SchemaVersion" WHERE version = '${version}'`;
                const versionResult = await this.executeSQLOnTenant(
                    tenant,
                    checkVersionSQL,
                );

                if (versionResult.rowCount === 0) {
                    // Apply the migration
                    const migrationPath = path.join(migrationDir, sqlFile);
                    const migrationContent = await fs.readFile(
                        migrationPath,
                        'utf-8',
                    );
                    await this.executeSQLOnTenant(tenant, migrationContent);

                    // Record the applied migration
                    const recordVersionSQL = `INSERT INTO "SchemaVersion" (version) VALUES ('${version}')`;
                    await this.executeSQLOnTenant(tenant, recordVersionSQL);

                    console.log(
                        `Applied migration ${sqlFile} to tenant ${tenant.name}`,
                    );
                } else {
                    console.log(
                        `Migration ${sqlFile} already applied to tenant ${tenant.name}`,
                    );
                }
            }

            console.log(
                `All migrations applied successfully to tenant ${tenant.name}`,
            );
        } catch (error) {
            console.error(
                `Error applying migrations to tenant ${tenant.name}:`,
                error,
            );
            throw error;
        }
    }

    private async executeSQLOnTenant(
        tenant: Tenant,
        sql: string,
    ): Promise<any> {
        const connectionString = `postgresql://${tenant.dbUser}:${tenant.dbPassword}@host.docker.internal:${tenant.dbPort}/${tenant.dbName}`;
        const psqlCommand = `docker run --rm --network host postgres:latest psql "${connectionString}" -c "${sql.replace(
            /"/g,
            '\\"',
        )}"`;
        const { stdout, stderr } = await execAsync(psqlCommand);
        if (stderr) console.error('SQL execution error:', stderr);
        return { stdout, stderr };
    }

    async applyMasterMigration(): Promise<void> {
        try {
            console.log('Applying master migration');
            const masterCommand =
                'npx prisma migrate deploy --schema=./prisma/schema.prisma';
            const masterOutput = await execAsync(masterCommand);
            console.log(
                'Master migration output:',
                masterOutput.stdout,
                masterOutput.stderr,
            );
        } catch (error) {
            console.error('Error applying master migration:', error);
            throw error;
        }
    }

    async generateMigrationForAllTenants(name: string): Promise<void> {
        const tenants = await this.prisma.tenant.findMany();

        for (const tenant of tenants) {
            console.log(`Generating migration for tenant: ${tenant.name}`);
            await this.generateTenantMigration(name);
        }
    }

    async getTenantById(id: string): Promise<Tenant | null> {
        return this.prisma.tenant.findUnique({
            where: { id: parseInt(id) },
        });
    }

    async generateMigrations(): Promise<void> {
        try {
            // Fetch all tenants from the master database
            const tenants = await this.prisma.tenant.findMany();

            for (const tenant of tenants) {
                console.log(`Generating migration for tenant: ${tenant.name}`);

                // Update .env file with tenant's database URL
                await this.updateEnvFile(tenant.databaseUrl);

                // Construct the migration command
                const command = `npx prisma migrate dev --schema=./prisma/tenant-schema.prisma --name init --create-only`;

                try {
                    // Execute the migration command
                    const { stdout, stderr } = await execAsync(command);
                    console.log(`Migration output for ${tenant.name}:`, stdout);
                    if (stderr) {
                        console.error(
                            `Migration error for ${tenant.name}:`,
                            stderr,
                        );
                    }
                } catch (error) {
                    console.error(
                        `Failed to generate migration for ${tenant.name}:`,
                        error,
                    );
                }
            }
        } catch (error) {
            console.error('Error fetching tenants:', error);
        } finally {
            await this.prisma.$disconnect();
        }
    }
}
