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
}
