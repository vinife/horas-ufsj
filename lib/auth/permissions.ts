export type AdminPermissions = {
  canManageComplementar: boolean;
  canManageExtensao: boolean;
  canManageUsers: boolean;
};

export const EMPTY_ADMIN_PERMISSIONS: AdminPermissions = {
  canManageComplementar: false,
  canManageExtensao: false,
  canManageUsers: false,
};

export function hasAnyAdminPermission(permissions: AdminPermissions) {
  return (
    permissions.canManageComplementar ||
    permissions.canManageExtensao ||
    permissions.canManageUsers
  );
}

export function toAdminPermissions(input: {
  canManageComplementar?: unknown;
  canManageExtensao?: unknown;
  canManageUsers?: unknown;
}): AdminPermissions {
  return {
    canManageComplementar: Boolean(input.canManageComplementar),
    canManageExtensao: Boolean(input.canManageExtensao),
    canManageUsers: Boolean(input.canManageUsers),
  };
}
