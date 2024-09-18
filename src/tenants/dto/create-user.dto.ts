import { IsString, IsNotEmpty } from 'class-validator';

export class CreateTenantDto {
    @IsString()
    @IsNotEmpty()
    name: any;

    @IsString()
    @IsNotEmpty()
    domain: any;
}
