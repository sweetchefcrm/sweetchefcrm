import { Role } from "@prisma/client";

export const PERMISSIONS = {
  DASHBOARD_GLOBAL: [Role.ADMIN, Role.COMMERCIAL_PRINCIPAL],
  DASHBOARD_PARTIAL: [Role.CHEF_TERRAIN, Role.CHEF_TELEVENTE],
  ALL_COMMERCIAUX: [Role.ADMIN, Role.COMMERCIAL_PRINCIPAL],
  TEAM_TERRAIN: [Role.ADMIN, Role.COMMERCIAL_PRINCIPAL, Role.CHEF_TERRAIN],
  TEAM_TELEVENTE: [Role.ADMIN, Role.COMMERCIAL_PRINCIPAL, Role.CHEF_TELEVENTE],
  OWN_CLIENTS: [
    Role.ADMIN,
    Role.COMMERCIAL_PRINCIPAL,
    Role.CHEF_TERRAIN,
    Role.CHEF_TELEVENTE,
    Role.COMMERCIAL_TERRAIN,
    Role.COMMERCIAL_TELEVENTE,
    Role.COMMERCIAL_GRAND_COMPTE,
    Role.MERCHANDISEUR,
    Role.AUTRES,
  ],
  EDIT_DATA: [Role.ADMIN, Role.CHEF_TERRAIN, Role.CHEF_TELEVENTE],
  IMPORTS: [Role.ADMIN],
  ADMIN_PANEL: [Role.ADMIN],
};

export function canAccess(userRole: Role, permission: Role[]): boolean {
  return permission.includes(userRole);
}

export function getDataScope(
  userRole: Role,
  userId: string,
  requestedUserId?: string
): { commercialId?: string; teamType?: string } {
  switch (userRole) {
    case Role.ADMIN:
    case Role.COMMERCIAL_PRINCIPAL:
      return {}; // Tout voir
    case Role.CHEF_TERRAIN:
      return { teamType: "TERRAIN" };
    case Role.CHEF_TELEVENTE:
      return { teamType: "TELEVENTE" };
    case Role.COMMERCIAL_TERRAIN:
    case Role.COMMERCIAL_TELEVENTE:
      return { commercialId: userId };
    default:
      return { commercialId: userId };
  }
}
