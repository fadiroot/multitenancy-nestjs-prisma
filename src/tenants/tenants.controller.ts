import { Controller, Post, Body } from '@nestjs/common';
import { TenantService } from './tenants.service';
import { CreateTenantDto } from './dto/create-user.dto';

@Controller('tenants')
export class TenantController {
    constructor(private readonly tenantService: TenantService) {}

    @Post()
    async create(@Body() createTenantDto: CreateTenantDto) {
        return this.tenantService.createTenant(createTenantDto);
    }

    @Post('generate-migration')
    async generateMigration(@Body('name') name: string) {
        const migrationName = await this.tenantService.generateTenantMigration(name);
        return { message: `Migration ${migrationName} generated successfully` };
    }

    @Post('apply-migrations')
    async applyMigrationsToAllTenants() {
        await this.tenantService.applyMigrationToAllTenants();
        return { message: 'Migrations applied successfully to all tenants' };
    }

    @Post('generate-tenant-migration')
    async generateTenantMigration(@Body('name') name: string) {
        return this.tenantService.generateTenantMigration(name);
    }

}
