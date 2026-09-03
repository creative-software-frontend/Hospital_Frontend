// app/lib/api.ts
// Typed client for the backend REST API. All calls go to the same-origin
// `/api` prefix (Next.js rewrites proxy it to the Express backend on :5000).
// Authentication rides on the backend's HTTP-only cookie, so we always send
// `credentials: "include"` and never read a token from JS.

export const API_BASE = "/api";

/* ---------------------------------------------------------------------------
 * Types (mirror the backend response shapes)
 * ------------------------------------------------------------------------- */

export interface ApiUser {
  id: number;
  email: string;
  username: string | null;
  name: string;
  status: string;
  branchId: number;
}

export interface MeResult {
  user: ApiUser;
  roles: string[];
}

export interface LoginResult {
  user: ApiUser;
  roles: string[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface BranchRef {
  id: number;
  name: string;
  code: string;
}

export type Gender = "MALE" | "FEMALE" | "OTHER";
export type BloodGroup =
  | "A_POS" | "A_NEG" | "B_POS" | "B_NEG"
  | "AB_POS" | "AB_NEG" | "O_POS" | "O_NEG";
export type MaritalStatus = "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED";
export type PatientStatus = "active" | "inactive";

export interface PatientContact {
  id: number;
  name: string;
  relationship: string | null;
  phone: string | null;
  address: string | null;
  isPrimary: boolean;
}

export interface PatientListRecord {
  id: number;
  patientCode: string;
  firstName: string;
  lastName: string | null;
  gender: Gender | null;
  dateOfBirth: string | null;
  bloodGroup: BloodGroup | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  district: string | null;
  maritalStatus: MaritalStatus | null;
  status: PatientStatus;
  branchId: number;
  createdAt: string;
  updatedAt: string;
  branch?: BranchRef;
  contacts: PatientContact[];
}

export interface PatientDetail extends PatientListRecord {
  nationalId: string | null;
  occupation: string | null;
  photo: string | null;
  deletedAt: string | null;
  createdById: number | null;
  updatedById: number | null;
  _count: {
    appointments: number;
    admissions: number;
    medicalRecords: number;
    prescriptions: number;
    labOrders: number;
    invoices: number;
    payments: number;
  };
}

export interface PatientListResult {
  data: PatientListRecord[];
  pagination: PaginationMeta;
}

export interface PatientContactInput {
  name: string;
  relationship?: string | null;
  phone?: string | null;
  address?: string | null;
  isPrimary?: boolean;
}

export interface CreatePatientInput {
  patientCode: string;
  firstName: string;
  lastName?: string | null;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  bloodGroup?: BloodGroup | null;
  maritalStatus?: MaritalStatus | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  district?: string | null;
  nationalId?: string | null;
  occupation?: string | null;
  photo?: string | null;
  contacts?: PatientContactInput[];
}

export type UpdatePatientInput = Partial<
  Omit<CreatePatientInput, "patientCode" | "contacts">
>;

export interface PatientListQuery {
  page?: number;
  limit?: number;
  search?: string;
  name?: string;
  phone?: string;
  email?: string;
  gender?: Gender;
  status?: PatientStatus;
  branchId?: number;
}

/* ---------------------------------------------------------------------------
 * Users / Roles / Permissions (Settings → User & Role Management)
 * ------------------------------------------------------------------------- */

export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "LOCKED";

export interface UserRoleRef {
  id: number;
  seederKey: string;
  name: string;
}

export interface UserRecord {
  id: number;
  name: string;
  email: string;
  username: string | null;
  phone: string | null;
  status: UserStatus;
  branchId: number;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  branch?: BranchRef;
  userRoles: { role: UserRoleRef }[];
}

export interface UserListResult {
  data: UserRecord[];
  pagination: PaginationMeta;
}

export interface UserListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: UserStatus;
  branchId?: number;
  role?: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  username: string;
  password: string;
  phone?: string | null;
  branchId?: number;
  roleIds: number[];
}

export type UpdateUserInput = Partial<
  Omit<CreateUserInput, "password" | "branchId">
>;

export interface RolePermissionSummary {
  permission: {
    module: string;
    action: string;
    description: string | null;
  };
}

export interface RoleRecord {
  id: number;
  seederKey: string;
  name: string;
  description: string | null;
  status: string;
  rolePermissions: RolePermissionSummary[];
}

export interface PermissionModule {
  module: string;
  actions: { action: string; description: string | null }[];
}

/* ---------------------------------------------------------------------------
 * Errors
 * ------------------------------------------------------------------------- */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, string> | null;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details =
      details && typeof details === "object"
        ? (details as Record<string, string>)
        : null;
  }
}

export class UnauthenticatedError extends ApiError {
  constructor(message = "Session expired. Please login again.") {
    super(401, "UNAUTHENTICATED", message);
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "You do not have permission to perform this action") {
    super(403, "FORBIDDEN", message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Resource not found") {
    super(404, "NOT_FOUND", message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends ApiError {
  constructor(message: string, code = "CONFLICT") {
    super(409, code, message);
    this.name = "ConflictError";
  }
}

export class BusinessRuleError extends ApiError {
  constructor(message: string) {
    super(422, "BUSINESS_RULE", message);
    this.name = "BusinessRuleError";
  }
}

export class ValidationError extends ApiError {
  readonly fieldErrors: Record<string, string>;

  constructor(message: string, details?: unknown) {
    super(400, "VALIDATION_ERROR", message, details);
    this.name = "ValidationError";
    this.fieldErrors = this.details ?? {};
  }
}

function toApiError(status: number, code: string, message: string, details?: unknown): ApiError {
  switch (code) {
    case "UNAUTHENTICATED":
    case "TOKEN_EXPIRED":
    case "TOKEN_INVALID":
      return new UnauthenticatedError(message);
    case "FORBIDDEN":
      return new ForbiddenError(message);
    case "NOT_FOUND":
    case "RECORD_NOT_FOUND":
      return new NotFoundError(message);
    case "CONFLICT":
    case "UNIQUE_CONSTRAINT":
      return new ConflictError(message, code);
    case "BUSINESS_RULE":
      return new BusinessRuleError(message);
    case "VALIDATION_ERROR":
      return new ValidationError(message, details);
    default:
      return new ApiError(status, code, message, details);
  }
}

interface ErrorBody {
  success?: false;
  message?: string;
  code?: string;
  details?: unknown;
}

/* ---------------------------------------------------------------------------
 * Request helper
 * ------------------------------------------------------------------------- */

async function rawRequest<TBody>(path: string, init?: RequestInit): Promise<TBody> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      headers: init?.body
        ? { "Content-Type": "application/json", ...(init.headers ?? {}) }
        : init?.headers,
      ...init,
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Cannot reach the server. Is the backend running?");
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON response (proxy error page, etc.)
  }

  if (!res.ok || (body && typeof body === "object" && (body as ErrorBody).success === false)) {
    const errBody = body as ErrorBody | null;
    const message = errBody?.message || `Request failed (${res.status})`;
    const code = errBody?.code || "ERROR";
    throw toApiError(res.status, code, message, errBody?.details);
  }

  return body as TBody;
}

/** Calls an endpoint whose body is `{ success: true, data: T }` and returns `data`. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const body = await rawRequest<{ data?: T }>(path, init);
  if (body.data === undefined) {
    throw new ApiError(0, "INVALID_RESPONSE", "Unexpected response from server");
  }
  return body.data;
}

function qs(params?: Record<string, string | number | boolean | null | undefined>): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      sp.set(key, String(value));
    }
  }
  const q = sp.toString();
  return q ? `?${q}` : "";
}

/* ---------------------------------------------------------------------------
 * Auth endpoints
 * ------------------------------------------------------------------------- */

export const authApi = {
  login: (identifier: string, password: string) =>
    request<LoginResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    }),

  me: () => request<MeResult>("/auth/me"),

  logout: () =>
    request<{ message?: string }>("/auth/logout", { method: "POST" }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message?: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};

/* ---------------------------------------------------------------------------
 * Users endpoints (Settings → User & Role Management)
 * ------------------------------------------------------------------------- */

export const userApi = {
  list: (query: UserListQuery = {}) =>
    request<UserListResult>(
      `/users${qs({ ...query } as Record<string, string | number | boolean | null | undefined>)}`,
    ),

  get: (id: number) => request<{ user: UserRecord }>(`/users/${id}`),

  create: (input: CreateUserInput) =>
    request<{ message: string }>("/users", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  update: (id: number, input: UpdateUserInput) =>
    request<{ user: UserRecord }>(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  updateStatus: (id: number, status: UserStatus) =>
    request<{ user: UserRecord }>(`/users/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};

/* ---------------------------------------------------------------------------
 * Roles endpoints
 * ------------------------------------------------------------------------- */

export const roleApi = {
  list: (status?: "ACTIVE" | "INACTIVE") =>
    request<{ roles: RoleRecord[] }>(
      `/roles${qs(status ? { status } : {})}`,
    ),
};

/* ---------------------------------------------------------------------------
 * Permissions endpoints
 * ------------------------------------------------------------------------- */

export const permissionApi = {
  list: (module?: string) =>
    request<{ modules: PermissionModule[] }>(
      `/permissions${qs(module ? { module } : {})}`,
    ),
};

/* ---------------------------------------------------------------------------
 * Patient endpoints
 * ------------------------------------------------------------------------- */

export const patientApi = {
  list: (query: PatientListQuery = {}) =>
    rawRequest<PatientListResult>(
      `/patients${qs({ ...query } as Record<string, string | number | boolean | null | undefined>)}`,
    ),

  get: (id: number) => request<{ patient: PatientDetail }>(`/patients/${id}`),

  create: (input: CreatePatientInput) =>
    request<{ patient: { id: number; branchId: number; patientCode: string } }>("/patients", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  update: (id: number, input: UpdatePatientInput) =>
    request<{ patient: PatientDetail }>(`/patients/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  updateStatus: (id: number, status: PatientStatus) =>
    request<{ patient: { id: number; status: PatientStatus } }>(`/patients/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  remove: (id: number) =>
    request<{ message: string }>(`/patients/${id}`, { method: "DELETE" }),
};

/* ---------------------------------------------------------------------------
 * Patient contact endpoints
 * ------------------------------------------------------------------------- */

export const contactApi = {
  list: (patientId: number) =>
    request<{ contacts: PatientContact[] }>(`/patients/${patientId}/contacts`),

  create: (patientId: number, input: PatientContactInput) =>
    request<{ contact: PatientContact }>(`/patients/${patientId}/contacts`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  update: (patientId: number, contactId: number, input: Partial<PatientContactInput>) =>
    request<{ contact: PatientContact }>(`/patients/${patientId}/contacts/${contactId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  remove: (patientId: number, contactId: number) =>
    request<{ message: string }>(`/patients/${patientId}/contacts/${contactId}`, {
      method: "DELETE",
    }),
};

/* ---------------------------------------------------------------------------
 * Branches (Settings → Branch Settings)
 * ------------------------------------------------------------------------- */

export type BranchStatus = "active" | "inactive";

export interface BranchRecord {
  id: number;
  name: string;
  code: string;
  registrationNo: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  logo: string | null;
  timezone: string | null;
  currency: string | null;
  status: BranchStatus;
  createdAt: string;
  updatedAt: string;
  _count?: {
    users: number;
    departments: number;
    patients: number;
  };
}

export interface BranchListResult {
  data: BranchRecord[];
  pagination: PaginationMeta;
}

export interface BranchListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: BranchStatus;
}

export type UpdateBranchInput = Partial<
  Omit<BranchRecord, "id" | "code" | "createdAt" | "updatedAt" | "_count">
>;

export type CreateBranchInput = {
  name: string;
  code: string;
  registrationNo?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  timezone?: string | null;
  currency?: string | null;
  status?: BranchStatus;
};

export const branchApi = {
  list: (query: BranchListQuery = {}) =>
    rawRequest<BranchListResult>(
      `/branches${qs({ ...query } as Record<string, string | number | boolean | null | undefined>)}`,
    ),

  get: (id: number) => request<{ branch: BranchRecord }>(`/branches/${id}`),

  create: (input: CreateBranchInput) =>
    request<{ branch: BranchRecord }>(`/branches`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  update: (id: number, input: UpdateBranchInput) =>
    request<{ branch: BranchRecord }>(`/branches/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
};

/* ---------------------------------------------------------------------------
 * Settings (Settings → General / Security)
 * ------------------------------------------------------------------------- */

export interface SystemSetting {
  id: number;
  branchId: number | null;
  settingGroup: string;
  settingKey: string;
  settingValue: string | null;
  dataType: string | null;
  isEncrypted: boolean;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface SecuritySetting {
  id: number;
  passwordMinLength: number;
  passwordExpiryDays: number;
  maxLoginAttempts: number;
  sessionTimeout: number;
  twoFactorEnabled: boolean;
  ipRestrictionEnabled: boolean;
  deviceRestrictionEnabled: boolean;
  auditLogEnabled: boolean;
  status: "active" | "inactive";
  updatedAt: string;
}

export type UpdateSecurityInput = Partial<
  Omit<SecuritySetting, "id" | "status" | "updatedAt">
>;

export interface PatientSetting {
  id: number;
  branchId: number;
  patientIdPrefix: string;
  autoGenerateId: boolean;
  defaultPatientType: string;
  requireGuardian: "NEVER" | "MINORS_ONLY" | "ALWAYS";
  duplicateDetection: boolean;
  phoneRequired: boolean;
  emailRequired: boolean;
  status: "active" | "inactive";
  updatedAt: string;
}

export type UpdatePatientSettingInput = Partial<
  Omit<PatientSetting, "id" | "branchId" | "status" | "updatedAt">
>;

/* -- Clinical settings (Settings → Clinical Settings) ---------------------- */

export interface OpdSetting {
  id: number;
  branchId: number;
  registrationFee: string | null;
  consultationFee: string | null;
  followupDays: number;
  appointmentDuration: number;
  queueEnabled: boolean;
  prescriptionEnabled: boolean;
  status: "active" | "inactive";
}

export type UpdateOpdSettingInput = {
  registrationFee?: string | null;
  consultationFee?: string | null;
  followupDays?: number;
  appointmentDuration?: number;
  queueEnabled?: boolean;
  prescriptionEnabled?: boolean;
  status?: "active" | "inactive";
};

export interface IpdSetting {
  id: number;
  branchId: number;
  admissionFee: string | null;
  dischargeFee: string | null;
  bedCharge: string | null;
  nursingCharge: string | null;
  serviceCharge: string | null;
  status: "active" | "inactive";
}

export type UpdateIpdSettingInput = {
  admissionFee?: string | null;
  dischargeFee?: string | null;
  bedCharge?: string | null;
  nursingCharge?: string | null;
  serviceCharge?: string | null;
  status?: "active" | "inactive";
};

export interface EmergencySetting {
  id: number;
  branchId: number;
  registrationFee: string | null;
  consultationFee: string | null;
  serviceCharge: string | null;
  triageEnabled: boolean;
  status: "active" | "inactive";
}

export type UpdateEmergencySettingInput = {
  registrationFee?: string | null;
  consultationFee?: string | null;
  serviceCharge?: string | null;
  triageEnabled?: boolean;
  status?: "active" | "inactive";
};

export interface PrescriptionSetting {
  id: number;
  branchId: number;
  showPatientHistory: boolean;
  showDiagnosis: boolean;
  showMedicine: boolean;
  showDosage: boolean;
  showInstruction: boolean;
  showDoctorSignature: boolean;
  showQrCode: boolean;
  status: "active" | "inactive";
}

export type UpdatePrescriptionSettingInput = {
  showPatientHistory?: boolean;
  showDiagnosis?: boolean;
  showMedicine?: boolean;
  showDosage?: boolean;
  showInstruction?: boolean;
  showDoctorSignature?: boolean;
  showQrCode?: boolean;
  status?: "active" | "inactive";
};

export const settingsApi = {
  system: {
    list: (branchId?: number) =>
      request<{ settings: SystemSetting[] }>(
        `/settings/system${qs(branchId ? { branchId } : {})}`,
      ),
    upsert: (input: {
      settingGroup: string;
      settingKey: string;
      settingValue?: string | null;
      dataType?: string | null;
      isEncrypted?: boolean;
      status?: "active" | "inactive";
    }) =>
      request<{ setting: SystemSetting }>("/settings/system", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    remove: (id: number) =>
      request<{ message: string }>(`/settings/system/${id}`, { method: "DELETE" }),
  },
  security: {
    get: () => request<{ security: SecuritySetting }>("/settings/security"),
    update: (input: UpdateSecurityInput) =>
      request<{ security: SecuritySetting }>("/settings/security", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
  },
  patient: {
    get: () => request<{ patientSetting: PatientSetting }>("/settings/patient"),
    update: (input: UpdatePatientSettingInput) =>
      request<{ patientSetting: PatientSetting }>("/settings/patient", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
  },
  opd: {
    get: () => request<{ opdSetting: OpdSetting }>("/settings/opd"),
    update: (input: UpdateOpdSettingInput) =>
      request<{ opdSetting: OpdSetting }>("/settings/opd", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
  },
  ipd: {
    get: () => request<{ ipdSetting: IpdSetting }>("/settings/ipd"),
    update: (input: UpdateIpdSettingInput) =>
      request<{ ipdSetting: IpdSetting }>("/settings/ipd", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
  },
  emergency: {
    get: () => request<{ emergencySetting: EmergencySetting }>("/settings/emergency"),
    update: (input: UpdateEmergencySettingInput) =>
      request<{ emergencySetting: EmergencySetting }>("/settings/emergency", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
  },
  prescription: {
    get: () => request<{ prescriptionSetting: PrescriptionSetting }>("/settings/prescription"),
    update: (input: UpdatePrescriptionSettingInput) =>
      request<{ prescriptionSetting: PrescriptionSetting }>("/settings/prescription", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
  },
};

/* ---------------------------------------------------------------------------
 * Hospital configuration (Settings → Hospital Configuration)
 * Departments / Doctors / Services
 * ------------------------------------------------------------------------- */

export type ActiveStatus = "active" | "inactive";

export interface DepartmentRecord {
  id: number;
  branchId: number;
  name: string;
  code: string;
  description: string | null;
  departmentType: string | null;
  status: ActiveStatus;
  createdAt: string;
  updatedAt: string;
  _count?: { doctors: number; services: number; employees: number };
}

export interface DepartmentListResult {
  data: DepartmentRecord[];
  pagination: PaginationMeta;
}

export interface DepartmentListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: ActiveStatus;
  departmentType?: string;
}

export interface CreateDepartmentInput {
  name: string;
  code: string;
  description?: string | null;
  departmentType?: string | null;
  status?: ActiveStatus;
}

export type UpdateDepartmentInput = Partial<
  Omit<CreateDepartmentInput, "code">
>;

export interface DoctorRecord {
  id: number;
  userId: number | null;
  branchId: number;
  departmentId: number | null;
  doctorCode: string;
  name: string;
  specialization: string | null;
  qualification: string | null;
  registrationNo: string | null;
  phone: string | null;
  email: string | null;
  consultationFee: string | null;
  followupFee: string | null;
  emergencyFee: string | null;
  commissionType: string | null;
  commissionValue: string | null;
  status: ActiveStatus;
  createdAt: string;
  updatedAt: string;
  department?: { id: number; name: string; code: string } | null;
}

export interface DoctorListResult {
  data: DoctorRecord[];
  pagination: PaginationMeta;
}

export interface DoctorListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: ActiveStatus;
  departmentId?: number;
}

export interface CreateDoctorInput {
  doctorCode: string;
  name: string;
  departmentId?: number | null;
  specialization?: string | null;
  qualification?: string | null;
  registrationNo?: string | null;
  phone?: string | null;
  email?: string | null;
  consultationFee?: string | null;
  followupFee?: string | null;
  emergencyFee?: string | null;
  commissionType?: "PERCENT" | "FIXED" | null;
  commissionValue?: string | null;
  status?: ActiveStatus;
}

export type UpdateDoctorInput = Partial<Omit<CreateDoctorInput, "doctorCode">>;

export interface ServiceCategoryRecord {
  id: number;
  name: string;
  description: string | null;
}

export interface ServiceRecord {
  id: number;
  branchId: number;
  departmentId: number | null;
  categoryId: number | null;
  serviceCode: string;
  name: string;
  description: string | null;
  price: string | null;
  taxPercent: string | null;
  discountAllowed: boolean;
  status: ActiveStatus;
  createdAt: string;
  updatedAt: string;
  department?: { id: number; name: string; code: string } | null;
  category?: { id: number; name: string } | null;
}

export interface ServiceListResult {
  data: ServiceRecord[];
  pagination: PaginationMeta;
}

export interface ServiceListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: ActiveStatus;
  departmentId?: number;
  categoryId?: number;
}

export interface CreateServiceInput {
  serviceCode: string;
  name: string;
  departmentId?: number | null;
  categoryId?: number | null;
  description?: string | null;
  price?: string | null;
  taxPercent?: string | null;
  discountAllowed?: boolean;
  status?: ActiveStatus;
}

export type UpdateServiceInput = Partial<Omit<CreateServiceInput, "serviceCode">>;

export const departmentApi = {
  list: (query: DepartmentListQuery = {}) =>
    rawRequest<DepartmentListResult>(
      `/departments${qs({ ...query } as Record<string, string | number | boolean | null | undefined>)}`,
    ),
  get: (id: number) => request<{ department: DepartmentRecord }>(`/departments/${id}`),
  create: (input: CreateDepartmentInput) =>
    request<{ department: DepartmentRecord }>("/departments", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: number, input: UpdateDepartmentInput) =>
    request<{ department: DepartmentRecord }>(`/departments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
};

export const doctorApi = {
  list: (query: DoctorListQuery = {}) =>
    rawRequest<DoctorListResult>(
      `/doctors${qs({ ...query } as Record<string, string | number | boolean | null | undefined>)}`,
    ),
  get: (id: number) => request<{ doctor: DoctorRecord }>(`/doctors/${id}`),
  create: (input: CreateDoctorInput) =>
    request<{ doctor: DoctorRecord }>("/doctors", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: number, input: UpdateDoctorInput) =>
    request<{ doctor: DoctorRecord }>(`/doctors/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
};

export const serviceApi = {
  list: (query: ServiceListQuery = {}) =>
    rawRequest<ServiceListResult>(
      `/services${qs({ ...query } as Record<string, string | number | boolean | null | undefined>)}`,
    ),
  get: (id: number) => request<{ service: ServiceRecord }>(`/services/${id}`),
  categories: () =>
    request<{ categories: ServiceCategoryRecord[] }>("/services/categories"),
  create: (input: CreateServiceInput) =>
    request<{ service: ServiceRecord }>("/services", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: number, input: UpdateServiceInput) =>
    request<{ service: ServiceRecord }>(`/services/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
};

/* ---------------------------------------------------------------------------
 * Shared error/date helpers
 * ------------------------------------------------------------------------- */

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err instanceof ValidationError) {
      const first = Object.values(err.fieldErrors)[0];
      return first ? first : err.message;
    }
    return err.message;
  }
  return "Something went wrong. Please try again.";
}

/**
 * Formats an ISO date string as YYYY-MM-DD (backend send/receive format).
 */
export function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  // Use local time parts so the input matches what the user sees.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function calcAge(dob: string | null | undefined): string {
  if (!dob) return "—";
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return String(Math.max(0, age));
}