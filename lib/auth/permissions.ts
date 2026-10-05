export type AdminPermissions = {
  canManageComplementar: boolean;
  canManageExtensao: boolean;
  canManageEstagio: boolean;
  canManageUsers: boolean;
};

export const EMPTY_ADMIN_PERMISSIONS: AdminPermissions = {
  canManageComplementar: false,
  canManageExtensao: false,
  canManageEstagio: false,
  canManageUsers: false,
};

export function hasAnyAdminPermission(permissions: AdminPermissions) {
  return (
    permissions.canManageComplementar ||
    permissions.canManageExtensao ||
    permissions.canManageEstagio ||
    permissions.canManageUsers
  );
}

export function toAdminPermissions(input: {
  canManageComplementar?: unknown;
  canManageExtensao?: unknown;
  canManageEstagio?: unknown;
  canManageUsers?: unknown;
}): AdminPermissions {
  return {
    canManageComplementar: Boolean(input.canManageComplementar),
    canManageExtensao: Boolean(input.canManageExtensao),
    canManageEstagio: Boolean(input.canManageEstagio),
    canManageUsers: Boolean(input.canManageUsers),
  };
}
