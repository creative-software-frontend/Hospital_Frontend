import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/prisma", () => {
  const makeModel = () => ({
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
  });

  const prismaClient = {
    employee: makeModel(),
    branch: makeModel(),
    department: makeModel(),
    designation: makeModel(),
    employeeType: makeModel(),
    codeSequence: makeModel(),
    role: makeModel(),
    user: makeModel(),
    userRole: makeModel(),
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === "function") {
        // interactive transaction — tx is just the client mock itself
        return (arg as (tx: typeof prismaClient) => Promise<unknown>)(prismaClient);
      }
      if (Array.isArray(arg)) {
        const results = [];
        for (const fn of arg) {
          if (typeof fn === "function") results.push(await fn());
        }
        return results;
      }
      throw new Error("unsupported $transaction signature");
    }),
  };
  return { prisma: prismaClient };
});

vi.mock("../utils/audit", () => ({
  writeAuditLog: vi.fn(async () => {}),
}));

vi.mock("../modules/auth/auth.service", () => ({
  assertPasswordAcceptable: vi.fn(() => Promise.resolve()),
}));

const mockPrisma = (await import("../lib/prisma")).prisma as unknown as {
  employee: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  branch: { findUnique: ReturnType<typeof vi.fn> };
  department: { findUnique: ReturnType<typeof vi.fn> };
  designation: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  employeeType: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  codeSequence: { upsert: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
  role: { findUnique: ReturnType<typeof vi.fn> };
  user: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  userRole: { createMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const { writeAuditLog } = await import("../utils/audit");
const auditMock = writeAuditLog as unknown as ReturnType<typeof vi.fn>;

import * as employeeService from "../modules/employees/employee.service";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  listEmployeesQuerySchema,
  employeeIdParamSchema,
} from "../modules/employees/employee.validation";
import { CODE_ENTITIES } from "../utils/codeGenerator";

const superAdmin = {
  id: 1,
  email: "root@example.com",
  name: "Root",
  username: "root",
  branchId: 1,
  status: "ACTIVE",
  roles: [{ id: 1, seederKey: "SUPER_ADMIN", name: "Super Admin" }],
};

const branchUser = {
  id: 7,
  email: "hr@clinic.test",
  name: "HR",
  username: "hr",
  branchId: 1,
  status: "ACTIVE",
  roles: [{ id: 11, seederKey: "EMPLOYEE", name: "Employee" }],
};

const SAMPLE_EMPLOYEE = {
  id: 41,
  userId: null,
  branchId: 1,
  employeeTypeId: 2,
  designationId: 5,
  departmentId: 3,
  name: "Nusrat Jahan",
  employeeCode: "EMP-000001",
  phone: "01711000000",
  email: "nusrat@clinic.test",
  hireDate: new Date("2024-05-01"),
  basicSalary: "25000.00",
  status: "active",
  createdAt: new Date("2026-01-05T10:00:00Z"),
  updatedAt: new Date("2026-01-05T10:00:00Z"),
};

const VALID_INPUT = {
  name: "Nusrat Jahan",
  departmentId: 3,
  designationId: 5,
  employeeTypeId: 2,
  phone: "01711000000",
  email: "nusrat@clinic.test",
  basicSalary: "25000.00",
  password: "Str0ng!pass",
  confirmPassword: "Str0ng!pass",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.branch.findUnique.mockResolvedValue({ id: 1 });
  mockPrisma.department.findUnique.mockResolvedValue({ id: 3 });
  mockPrisma.designation.findUnique.mockResolvedValue({ id: 5 });
  mockPrisma.employeeType.findUnique.mockResolvedValue({ id: 2 });
  mockPrisma.codeSequence.upsert.mockResolvedValue({ nextNumber: 1 });
  mockPrisma.codeSequence.findUnique.mockResolvedValue(null);
  mockPrisma.employee.create.mockResolvedValue(SAMPLE_EMPLOYEE);
  mockPrisma.employee.count.mockResolvedValue(0);
  // Account creation is mandatory, so every createEmployee call goes through
  // the role lookup, email conflict check, username derivation and user write.
  mockPrisma.role.findUnique.mockResolvedValue({ id: 12, seederKey: "EMPLOYEE" });
  mockPrisma.user.findUnique.mockResolvedValue(null);
  mockPrisma.user.create.mockResolvedValue({ id: 88 });
  mockPrisma.userRole.createMany.mockResolvedValue({ count: 1 });
  mockPrisma.employee.findMany.mockResolvedValue([]);
  mockPrisma.employee.update.mockResolvedValue(SAMPLE_EMPLOYEE);
});

describe("createEmployee", () => {
  it("creates the employee with a generated EMP code scoped to the actor's branch", async () => {
    const row = await employeeService.createEmployee(branchUser, VALID_INPUT);

    expect(row).toEqual(SAMPLE_EMPLOYEE);
    expect(mockPrisma.codeSequence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entity_branchId: { entity: "Employee", branchId: 1 } },
        create: { entity: "Employee", branchId: 1, nextNumber: 1 },
      }),
    );
    expect(CODE_ENTITIES.EMPLOYEE).toBe("Employee");

    const call = mockPrisma.employee.create.mock.calls[0][0];
    expect(call.data.branchId).toBe(1);
    expect(call.data.name).toBe("Nusrat Jahan");
    expect(call.data.employeeCode).toBe("EMP-000001");
  });

  it("never takes the branch from the payload", async () => {
    await employeeService.createEmployee(branchUser, {
      ...VALID_INPUT,
      ...({ branchId: 999 } as Record<string, unknown>),
    });

    expect(mockPrisma.employee.create.mock.calls[0][0].data.branchId).toBe(1);
  });

  it("never takes the employee code from the payload, it is always generated", async () => {
    await employeeService.createEmployee(branchUser, {
      ...VALID_INPUT,
      ...({ employeeCode: "HACK-1" } as Record<string, unknown>),
    });

    expect(mockPrisma.employee.create.mock.calls[0][0].data.employeeCode).toBe("EMP-000001");
  });

  it("rejects a department / designation / employee type that does not exist", async () => {
    mockPrisma.department.findUnique.mockResolvedValue(null);
    await expect(
      employeeService.createEmployee(branchUser, { name: "Ghost", departmentId: 4242 }),
    ).rejects.toThrow(/Department not found/i);

    mockPrisma.department.findUnique.mockResolvedValue({ id: 3 });
    mockPrisma.designation.findUnique.mockResolvedValue(null);
    await expect(
      employeeService.createEmployee(branchUser, { name: "Ghost", designationId: 4242 }),
    ).rejects.toThrow(/Designation not found/i);

    mockPrisma.designation.findUnique.mockResolvedValue({ id: 5 });
    mockPrisma.employeeType.findUnique.mockResolvedValue(null);
    await expect(
      employeeService.createEmployee(branchUser, { name: "Ghost", employeeTypeId: 4242 }),
    ).rejects.toThrow(/Employee type not found/i);

    expect(mockPrisma.employee.create).not.toHaveBeenCalled();
  });

  it("skips the reference lookups when they are not submitted", async () => {
    await employeeService.createEmployee(branchUser, {
      name: "Minimal Employee",
      email: "min@clinic.test",
      password: "Str0ng!pass",
      confirmPassword: "Str0ng!pass",
    });

    expect(mockPrisma.department.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.designation.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.employeeType.findUnique).not.toHaveBeenCalled();
  });

  it("applies defaults and stores a supplied status", async () => {
    await employeeService.createEmployee(branchUser, {
      name: "On Leave",
      email: "leave@clinic.test",
      status: "inactive",
      password: "Str0ng!pass",
      confirmPassword: "Str0ng!pass",
    });

    const data = mockPrisma.employee.create.mock.calls[0][0].data;
    expect(data.status).toBe("inactive");
    expect(data.departmentId).toBeNull();
    expect(data.designationId).toBeNull();
    expect(data.employeeTypeId).toBeNull();
  });

  it("persists the profile fields (dates, enums, photo, addresses)", async () => {
    await employeeService.createEmployee(branchUser, {
      ...VALID_INPUT,
      hireDate: new Date("2024-05-01"),
      gender: "FEMALE",
      dateOfBirth: new Date("1990-02-03"),
      maritalStatus: "MARRIED",
      bloodGroup: "O_POS",
      photo: "/api/uploads/photos/a.png",
      permanentAddress: "12 Dhaka Road",
      presentAddress: "34 Comilla Road",
    });

    const data = mockPrisma.employee.create.mock.calls[0][0].data;
    expect(data.gender).toBe("FEMALE");
    expect(data.bloodGroup).toBe("O_POS");
    expect(data.maritalStatus).toBe("MARRIED");
    expect(data.hireDate).toEqual(new Date("2024-05-01"));
    expect(data.dateOfBirth).toEqual(new Date("1990-02-03"));
    expect(data.photo).toBe("/api/uploads/photos/a.png");
    expect(data.permanentAddress).toBe("12 Dhaka Road");
    expect(data.presentAddress).toBe("34 Comilla Road");
  });

  it("always creates the linked login account, so a password is mandatory", async () => {
    await expect(
      employeeService.createEmployee(branchUser, { name: "No Login", email: "nologin@clinic.test" }),
    ).rejects.toThrow(/Password is required/i);
    expect(mockPrisma.employee.create).not.toHaveBeenCalled();
  });

  it("creates a linked login account with a derived username and a hashed password", async () => {
    const row = await employeeService.createEmployee(branchUser, VALID_INPUT);

    const userArgs = mockPrisma.user.create.mock.calls[0][0];
    expect(userArgs.data.username).toBe("nusrat");
    expect(userArgs.data.email).toBe("nusrat@clinic.test");
    expect(userArgs.data.password).not.toBe("Str0ng!pass");
    expect(userArgs.data.branchId).toBe(1);
    expect(userArgs.data.status).toBe("ACTIVE");
    expect(userArgs.data.passwordHistory).toEqual([userArgs.data.password]);

    expect(mockPrisma.userRole.createMany.mock.calls[0][0].data).toEqual([{ userId: 88, roleId: 12 }]);
    expect(mockPrisma.employee.create.mock.calls[0][0].data.userId).toBe(88);
    expect(row).toEqual(SAMPLE_EMPLOYEE);
  });

  it("derives a unique username when the local part collides", async () => {
    mockPrisma.user.findUnique
      .mockReset()
      .mockResolvedValueOnce(null) // email conflict check passes
      .mockResolvedValueOnce({ id: 99 }) // first username candidate is taken
      .mockResolvedValueOnce(null); // suffixed candidate is free

    await employeeService.createEmployee(branchUser, VALID_INPUT);

    expect(mockPrisma.user.create.mock.calls[0][0].data.username).toBe("nusrat_2");
  });

  it("rejects when the email already belongs to another user", async () => {
    mockPrisma.user.findUnique.mockReset().mockResolvedValueOnce({ id: 5 });

    await expect(employeeService.createEmployee(branchUser, VALID_INPUT)).rejects.toThrow(
      /already exists/i,
    );
    expect(mockPrisma.employee.create).not.toHaveBeenCalled();
  });

  it("rejects account creation without an email", async () => {
    mockPrisma.user.findUnique.mockReset().mockResolvedValue(null);

    await expect(
      employeeService.createEmployee(branchUser, {
        name: "No Email",
        password: "Str0ng!pass",
        confirmPassword: "Str0ng!pass",
      }),
    ).rejects.toThrow(/Email is required/i);
    expect(mockPrisma.employee.create).not.toHaveBeenCalled();
  });

  it("rejects creation when the actor's branch does not exist", async () => {
    mockPrisma.branch.findUnique.mockResolvedValue(null);

    await expect(employeeService.createEmployee(branchUser, VALID_INPUT)).rejects.toThrow(
      /Branch not found/i,
    );
    expect(mockPrisma.employee.create).not.toHaveBeenCalled();
  });

  it("does not create the employee when code generation fails inside the transaction", async () => {
    mockPrisma.codeSequence.upsert.mockRejectedValue(new Error("sequence locked"));

    await expect(employeeService.createEmployee(branchUser, VALID_INPUT)).rejects.toThrow(
      "sequence locked",
    );
    expect(mockPrisma.employee.create).not.toHaveBeenCalled();
  });

  it("writes an audit log with the new employee's identity and account creation", async () => {
    await employeeService.createEmployee(branchUser, VALID_INPUT);

    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        module: "employee",
        action: "create",
        tableName: "Employee",
        recordId: "41",
        newValues: expect.objectContaining({
          name: "Nusrat Jahan",
          employeeCode: "EMP-000001",
          accountCreated: true,
          username: "nusrat",
        }),
      }),
    );
  });
});

describe("updateEmployee", () => {
  it("updates the employee inside the actor's own branch", async () => {
    mockPrisma.employee.findFirst
      .mockResolvedValueOnce({ id: 41, branchId: 1 })
      .mockResolvedValueOnce(SAMPLE_EMPLOYEE);

    const row = await employeeService.updateEmployee(branchUser, 41, { name: "Nusrat J." });

    expect(row).toEqual(SAMPLE_EMPLOYEE);
    expect(mockPrisma.employee.update).toHaveBeenCalledWith({
      where: { id: 41 },
      data: { name: "Nusrat J." },
    });
  });

  it("rejects an unknown employee", async () => {
    mockPrisma.employee.findFirst.mockReset().mockResolvedValue(null);

    await expect(employeeService.updateEmployee(branchUser, 999, { name: "Ghost" })).rejects.toThrow(
      /Employee not found/i,
    );
    expect(mockPrisma.employee.update).not.toHaveBeenCalled();
  });

  it("rejects moving an employee into a designation that does not exist", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue({ id: 41, branchId: 1 });
    mockPrisma.designation.findUnique.mockResolvedValue(null);

    await expect(
      employeeService.updateEmployee(branchUser, 41, { designationId: 4242 }),
    ).rejects.toThrow(/Designation not found/i);
    expect(mockPrisma.employee.update).not.toHaveBeenCalled();
  });

  it("blocks a non super-admin from editing another branch's employee", async () => {
    mockPrisma.employee.findFirst.mockReset().mockResolvedValue({ id: 41, branchId: 2 });

    await expect(employeeService.updateEmployee(branchUser, 41, { name: "Hijack" })).rejects.toThrow(
      /do not have permission/i,
    );
    expect(mockPrisma.employee.update).not.toHaveBeenCalled();
  });

  it("lets a super-admin edit across branches and records the audit trail", async () => {
    mockPrisma.employee.findFirst
      .mockResolvedValueOnce({ id: 41, branchId: 2 })
      .mockResolvedValueOnce(SAMPLE_EMPLOYEE);

    await employeeService.updateEmployee(superAdmin, 41, { name: "Approved" });

    expect(mockPrisma.employee.update).toHaveBeenCalledWith({
      where: { id: 41 },
      data: { name: "Approved" },
    });
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        module: "employee",
        action: "update",
        recordId: "41",
        oldValues: { name: "Nusrat Jahan", employeeCode: "EMP-000001" },
        newValues: { name: "Approved" },
      }),
    );
  });
});

describe("getEmployee and listEmployees", () => {
  it("returns the employee for the same branch", async () => {
    mockPrisma.employee.findFirst
      .mockResolvedValueOnce({ id: 41, branchId: 1 })
      .mockResolvedValueOnce(SAMPLE_EMPLOYEE);

    expect(await employeeService.getEmployee(branchUser, 41)).toEqual(SAMPLE_EMPLOYEE);
  });

  it("hides an employee from another branch", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue({ id: 41, branchId: 2 });

    await expect(employeeService.getEmployee(branchUser, 41)).rejects.toThrow(
      /do not have permission/i,
    );
  });

  it("scopes the list to the actor's branch and hides deleted rows", async () => {
    await employeeService.listEmployees(branchUser, {});

    expect(mockPrisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { branchId: 1, deletedAt: null } }),
    );
  });

  it("searches name, code, email and phone together", async () => {
    await employeeService.listEmployees(branchUser, { search: "nusrat" });

    const where = mockPrisma.employee.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { name: { contains: "nusrat" } },
      { employeeCode: { contains: "nusrat" } },
      { email: { contains: "nusrat" } },
      { phone: { contains: "nusrat" } },
    ]);
  });

  it("applies the status, department and designation filters", async () => {
    await employeeService.listEmployees(branchUser, { status: "active", departmentId: 3, designationId: 5 });

    const where = mockPrisma.employee.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("active");
    expect(where.departmentId).toBe(3);
    expect(where.designationId).toBe(5);
  });

  it("returns pagination metadata with the rows", async () => {
    mockPrisma.employee.count.mockResolvedValue(45);
    mockPrisma.employee.findMany.mockResolvedValue([SAMPLE_EMPLOYEE]);

    const result = await employeeService.listEmployees(branchUser, { page: 2, limit: 20 });

    expect(result.data).toEqual([SAMPLE_EMPLOYEE]);
    expect(result.pagination).toEqual({ page: 2, limit: 20, total: 45, totalPages: 3 });
  });
});

describe("peekNextEmployeeCode and listEmployeeReferences", () => {
  it("previews EMP-000001 without claiming a sequence number", async () => {
    mockPrisma.codeSequence.findUnique.mockResolvedValue(null);

    const code = await employeeService.peekNextEmployeeCode(branchUser);

    expect(code).toBe("EMP-000001");
    expect(mockPrisma.codeSequence.upsert).not.toHaveBeenCalled();
  });

  it("previews the next sequence number when one already exists", async () => {
    // nextNumber stores the LAST issued code, so the preview is one past it.
    mockPrisma.codeSequence.findUnique.mockResolvedValue({ nextNumber: 7 });

    expect(await employeeService.peekNextEmployeeCode(branchUser)).toBe("EMP-000008");
  });

  it("returns active employee types and designations for the dropdowns", async () => {
    mockPrisma.employeeType.findMany.mockResolvedValue([{ id: 2, name: "Full-time" }]);
    mockPrisma.designation.findMany.mockResolvedValue([{ id: 5, name: "Accountant" }]);

    const refs = await employeeService.listEmployeeReferences();

    expect(refs.employeeTypes).toEqual([{ id: 2, name: "Full-time" }]);
    expect(refs.designations).toEqual([{ id: 5, name: "Accountant" }]);
    expect(mockPrisma.employeeType.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "active" } }),
    );
  });
});

const SCHEMA_BASE = {
  name: "Nusrat Jahan",
  email: "nusrat@clinic.test",
  password: "Str0ng!pass",
  confirmPassword: "Str0ng!pass",
};

describe("createEmployeeSchema", () => {
  it("requires a name, an email and a password, since a login account is mandatory", () => {
    expect(createEmployeeSchema.safeParse({}).success).toBe(false);
    expect(createEmployeeSchema.safeParse({ ...SCHEMA_BASE, name: "   " }).success).toBe(false);
    expect(createEmployeeSchema.safeParse({ ...SCHEMA_BASE, email: undefined }).success).toBe(false);
    expect(createEmployeeSchema.safeParse({ ...SCHEMA_BASE, password: undefined }).success).toBe(false);
    expect(createEmployeeSchema.safeParse(SCHEMA_BASE).success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const parsed = createEmployeeSchema.safeParse({ ...SCHEMA_BASE, confirmPassword: "different" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === "confirmPassword")).toBe(true);
    }
  });

  it("lowercases the email and rejects a malformed one", () => {
    expect(createEmployeeSchema.parse({ ...SCHEMA_BASE, email: "Nusrat@Clinic.TEST" }).email).toBe(
      "nusrat@clinic.test",
    );
    expect(createEmployeeSchema.safeParse({ ...SCHEMA_BASE, email: "not-an-email" }).success).toBe(false);
  });

  it("strips an injected branchId and employeeCode so they can never reach the database", () => {
    const parsed = createEmployeeSchema.parse({
      ...SCHEMA_BASE,
      branchId: 999,
      employeeCode: "HACK-1",
    } as never);
    expect(parsed).not.toHaveProperty("branchId");
    expect(parsed).not.toHaveProperty("employeeCode");
  });

  it("accepts salary with up to two decimals and rejects anything else", () => {
    expect(createEmployeeSchema.safeParse({ ...SCHEMA_BASE, basicSalary: "25000" }).success).toBe(true);
    expect(createEmployeeSchema.safeParse({ ...SCHEMA_BASE, basicSalary: "25000.55" }).success).toBe(true);
    expect(createEmployeeSchema.safeParse({ ...SCHEMA_BASE, basicSalary: "25000.555" }).success).toBe(false);
    expect(createEmployeeSchema.safeParse({ ...SCHEMA_BASE, basicSalary: "-5" }).success).toBe(false);
  });

  it("coerces reference ids and rejects non-integers", () => {
    const parsed = createEmployeeSchema.parse({
      ...SCHEMA_BASE,
      departmentId: "3",
      designationId: "5",
      employeeTypeId: "2",
    });
    expect(parsed.departmentId).toBe(3);
    expect(parsed.designationId).toBe(5);
    expect(parsed.employeeTypeId).toBe(2);
    expect(createEmployeeSchema.safeParse({ ...SCHEMA_BASE, departmentId: 0 }).success).toBe(false);
    expect(createEmployeeSchema.safeParse({ ...SCHEMA_BASE, designationId: 2.5 }).success).toBe(false);
  });

  it("rejects an unknown gender / blood group / status and a future date", () => {
    expect(createEmployeeSchema.safeParse({ ...SCHEMA_BASE, gender: "M" }).success).toBe(false);
    expect(createEmployeeSchema.safeParse({ ...SCHEMA_BASE, bloodGroup: "O" }).success).toBe(false);
    expect(createEmployeeSchema.safeParse({ ...SCHEMA_BASE, status: "retired" }).success).toBe(false);
    expect(createEmployeeSchema.safeParse({ ...SCHEMA_BASE, dateOfBirth: "2999-01-01" }).success).toBe(false);
    expect(createEmployeeSchema.safeParse({ ...SCHEMA_BASE, hireDate: "2999-01-01" }).success).toBe(false);
  });

  it("accepts enum values, ISO dates, photo and addresses", () => {
    const parsed = createEmployeeSchema.parse({
      ...SCHEMA_BASE,
      hireDate: "2024-05-01",
      gender: "FEMALE",
      dateOfBirth: "1990-02-03",
      maritalStatus: "MARRIED",
      bloodGroup: "O_POS",
      photo: "/api/uploads/photos/a.png",
      permanentAddress: "12 Dhaka Road",
      presentAddress: "34 Comilla Road",
    });
    expect(parsed.hireDate).toEqual(new Date("2024-05-01"));
    expect(parsed.gender).toBe("FEMALE");
    expect(parsed.maritalStatus).toBe("MARRIED");
    expect(parsed.bloodGroup).toBe("O_POS");
    expect(parsed.photo).toBe("/api/uploads/photos/a.png");
    expect(parsed.presentAddress).toBe("34 Comilla Road");
  });
});

describe("updateEmployeeSchema", () => {
  it("allows a partial update, including clearing a field", () => {
    expect(updateEmployeeSchema.safeParse({}).success).toBe(true);
    expect(updateEmployeeSchema.safeParse({ status: "inactive" }).success).toBe(true);
    expect(updateEmployeeSchema.safeParse({ designationId: null, basicSalary: null }).success).toBe(true);
  });

  it("still validates the fields that are present and keeps password fields out", () => {
    expect(updateEmployeeSchema.safeParse({ name: "" }).success).toBe(false);
    expect(updateEmployeeSchema.safeParse({ email: "bad" }).success).toBe(false);
    expect(Object.keys(updateEmployeeSchema.shape as Record<string, unknown>)).not.toContain("password");
    expect(Object.keys(updateEmployeeSchema.shape as Record<string, unknown>)).not.toContain("confirmPassword");
  });
});

describe("listEmployeesQuerySchema and employeeIdParamSchema", () => {
  it("coerces numeric query strings", () => {
    const parsed = listEmployeesQuerySchema.parse({ page: "2", limit: "50", departmentId: "3" });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(50);
    expect(parsed.departmentId).toBe(3);
  });

  it("caps the page size at 100 and rejects invalid input", () => {
    expect(listEmployeesQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(listEmployeesQuerySchema.safeParse({ status: "unknown" }).success).toBe(false);
    expect(listEmployeesQuerySchema.safeParse({ sortOrder: "sideways" }).success).toBe(false);
  });

  it("requires a positive integer employee id", () => {
    expect(employeeIdParamSchema.parse({ id: "12" }).id).toBe(12);
    expect(employeeIdParamSchema.safeParse({ id: "0" }).success).toBe(false);
    expect(employeeIdParamSchema.safeParse({ id: "abc" }).success).toBe(false);
  });
});
