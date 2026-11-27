import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { Permission, Roles } from '../common/roles.decorator';
import { CreateStaffDto, RoleDto, StaffPasswordDto, UpdateRoleDto, UpdateStaffDto } from './dto/staff.dto';
import { StaffService } from './staff.service';

@Controller('admin')
export class StaffController {
  constructor(private staff: StaffService) {}

  /** Every administrator can see the list of permissions and roles (needed to build screens). */
  @Roles('ADMIN') @Get('permissions') permissions() { return this.staff.registry(); }
  @Roles('ADMIN') @Get('roles') roles() { return this.staff.listRoles(); }

  @Permission('roles.manage') @Post('roles')
  createRole(@CurrentUser() u: AuthUser, @Body() dto: RoleDto) { return this.staff.createRole(u, dto); }

  @Permission('roles.manage') @Patch('roles/:id')
  updateRole(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto) { return this.staff.updateRole(u, id, dto); }

  @Permission('roles.manage') @Delete('roles/:id') @HttpCode(204)
  deleteRole(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.staff.deleteRole(u, id); }

  @Permission('staff.manage') @Get('staff') listStaff() { return this.staff.listStaff(); }

  @Permission('staff.manage') @Post('staff')
  createStaff(@CurrentUser() u: AuthUser, @Body() dto: CreateStaffDto) { return this.staff.createStaff(u, dto); }

  @Permission('staff.manage') @Patch('staff/:id')
  updateStaff(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStaffDto) { return this.staff.updateStaff(u, id, dto); }

  @Permission('staff.manage') @Post('staff/:id/password') @HttpCode(204)
  setPassword(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StaffPasswordDto) { return this.staff.setPassword(u, id, dto.password); }
}
