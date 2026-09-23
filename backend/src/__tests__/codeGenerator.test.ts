import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import {
  CODE_ENTITIES,
  formatBusinessCode,
  generateBusinessCode,
  nextCodeNumber,
} from "../utils/codeGenerator";

/* ---------------------------------------------------------------------------
 * Central code generator utility
 * ------------------------------------------------------------------------- */

/** Simulates MySQL row-lock serialization of the upsert on a shared counter.
 * Real DB has one row per (entity, branchId) — the mock mirrors that. */
function makeTx() {
  const counters = new Map<string, number>();
  const upsert = vi.fn(
    async (args: {
      where: { entity_branchId: { entity: string; branchId: number } };
    }) => {
      const { entity, branchId } = args.where.entity_branchId;
      const key = `${entity}:${branchId}`;
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return { nextNumber: next };
    },
  );
  return {
    tx: { codeSequence: { upsert } } as unknown as Prisma.TransactionClient,
    upsert,
  };
}

describe("formatBusinessCode", () => {
  it("zero-pads the sequence behind the prefix", () => {
    expect(formatBusinessCode("PAT", 1)).toBe("PAT-000001");
    expect(formatBusinessCode("PAT", 123456)).toBe("PAT-123456");
    expect(formatBusinessCode("SRV", 7, 4)).toBe("SRV-0007");
  });
});

describe("nextCodeNumber", () => {
  it("claims 1 on first use then increments atomically", async () => {
    const upsert = vi.fn()
      .mockResolvedValueOnce({ nextNumber: 1 })
      .mockResolvedValueOnce({ nextNumber: 2 });
    const tx = { codeSequence: { upsert } } as unknown as Prisma.TransactionClient;

    expect(await nextCodeNumber(tx, CODE_ENTITIES.PATIENT, 1)).toBe(1);
    expect(await nextCodeNumber(tx, CODE_ENTITIES.PATIENT, 1)).toBe(2);
    expect(upsert).toHaveBeenNthCalledWith(1, {
      where: { entity_branchId: { entity: "Patient", branchId: 1 } },
      update: { nextNumber: { increment: 1 } },
      create: { entity: "Patient", branchId: 1, nextNumber: 1 },
      select: { nextNumber: true },
    });
  });

  it("isolates sequence numbers per branch", async () => {
    const { tx } = makeTx();
    const b1 = await generateBusinessCode(tx, CODE_ENTITIES.DOCTOR, 1);
    const b1b = await generateBusinessCode(tx, CODE_ENTITIES.DOCTOR, 1);
    const b2 = await generateBusinessCode(tx, CODE_ENTITIES.DOCTOR, 2);
    expect(b1).toBe("DOC-000001");
    expect(b1b).toBe("DOC-000002");
    expect(b2).toBe("DOC-000001");
  });

  it("isolates sequence numbers per entity in the same branch", async () => {
    const { tx } = makeTx();
    const doctor = await generateBusinessCode(tx, CODE_ENTITIES.DOCTOR, 1);
    const service = await generateBusinessCode(tx, CODE_ENTITIES.SERVICE, 1);
    const patient = await generateBusinessCode(tx, CODE_ENTITIES.PATIENT, 1);
    expect(doctor).toBe("DOC-000001");
    expect(service).toBe("SRV-000001");
    expect(patient).toBe("PAT-000001");
  });

  it("claims unique sequential numbers under concurrency", async () => {
    const { tx } = makeTx();
    const codes = await Promise.all(
      Array.from({ length: 50 }, () => generateBusinessCode(tx, CODE_ENTITIES.PATIENT, 2)),
    );
    expect(codes).toHaveLength(50);
    expect(new Set(codes).size).toBe(50);
    expect(codes[0]).toBe("PAT-000001");
    expect(codes[49]).toBe("PAT-000050");
  });
});

/* ---------------------------------------------------------------------------
 * Doctor & Service create service wiring
 * ------------------------------------------------------------------------- */

vi.mock("../lib/prisma", () => {
  const makeModel = () => ({
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    delete: vi.fn(),
  });

  const prismaClient = {
    branch: makeModel(),
    doctor: makeModel(),
    service: makeModel(),
    codeSequence: makeModel(),
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: typeof prismaClient) => Promise<unknown>)(prismaClient);
      }
      throw new Error("unsupported $transaction signature");
    }),
  };
  return { prisma: prismaClient };
});

vi.mock("../utils/audit", () => ({
  writeAuditLog: vi.fn(async () => {}),
}));

const mockPrisma = (await import("../lib/prisma")).prisma as unknown as {
  branch: { findUnique: ReturnType<typeof vi.fn> };
  doctor: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  service: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  codeSequence: { upsert: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

import { createDoctor } from "../modules/doctors/doctor.service";
import { createService } from "../modules/services/service.service";

const actor = {
  id: 1,
  email: "admin@example.com",
  name: "Admin",
  username: "admin",
  branchId: 1,
  status: "ACTIVE",
  roles: [{ id: 1, seederKey: "SUPER_ADMIN", name: "Super Admin" }],
};

describe("createDoctor — automatic code", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates a branch-scoped DOC- code for the actor's branch", async () => {
    (mockPrisma.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });
    (mockPrisma.codeSequence.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ nextNumber: 1 });
    (mockPrisma.doctor.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5,
      branchId: 1,
      doctorCode: "DOC-000001",
      name: "Dr. Rahim",
    });

    const actorLocal = { ...actor, roles: [{ id: 2, seederKey: "ADMIN", name: "Admin" }] };
    const result = await createDoctor(actorLocal, { name: "Dr. Rahim" });

    expect(mockPrisma.codeSequence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entity_branchId: { entity: "Doctor", branchId: 1 } },
      }),
    );
    expect(mockPrisma.doctor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ doctorCode: "DOC-000001", branchId: 1 }),
      }),
    );
    expect(result.doctorCode).toBe("DOC-000001");
  });

  it("ignores any client-supplied doctor code", async () => {
    (mockPrisma.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });
    (mockPrisma.codeSequence.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ nextNumber: 4 });
    (mockPrisma.doctor.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 6,
      branchId: 1,
      doctorCode: "DOC-000004",
      name: "Evil",
    });

    await createDoctor(actorLocal(), { name: "Evil", doctorCode: "SKIP-ME" } as never);

    const createCall = (mockPrisma.doctor.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(createCall.data.doctorCode).toBe("DOC-000004");
    expect(createCall.data.doctorCode).not.toBe("SKIP-ME");
  });
});

describe("createService — automatic code", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates a branch-scoped SRV- code for the actor's branch", async () => {
    (mockPrisma.branch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });
    (mockPrisma.codeSequence.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ nextNumber: 1 });
    (mockPrisma.service.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 9,
      branchId: 1,
      serviceCode: "SRV-000001",
      name: "General Consultation",
    });

    const actorLocal = { ...actor, roles: [{ id: 2, seederKey: "ADMIN", name: "Admin" }] };
    const result = await createService(actorLocal, { name: "General Consultation" });

    expect(mockPrisma.codeSequence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entity_branchId: { entity: "Service", branchId: 1 } },
      }),
    );
    expect(mockPrisma.service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ serviceCode: "SRV-000001", branchId: 1 }),
      }),
    );
    expect(result.serviceCode).toBe("SRV-000001");
  });
});

function actorLocal() {
  return { ...actor, roles: [{ id: 2, seederKey: "ADMIN", name: "Admin" }] };
}