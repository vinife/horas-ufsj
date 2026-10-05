export type ManagedRole = "STUDENT" | "ADMIN";
export type ManagedAccessStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ManagedUser = {
  id: string;
  name: string | null;
  email: string;
  role: ManagedRole;
  accessStatus: ManagedAccessStatus;
  createdAt: string;
  permissions: {
    canManageComplementar: boolean;
    canManageExtensao: boolean;
    canManageEstagio: boolean;
    canManageUsers: boolean;
  };
};

export type UsersResponse = {
  users: ManagedUser[];
  meta: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
    pendingItems?: number;
  };
  canManage: boolean;
};
