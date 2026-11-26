import type { PrescriptionRecord } from "@/app/lib/api";

export interface PrintDoctor {
  name: string;
  qualification?: string | null;
  specialization?: string | null;
  bmdc?: string | null;
  phone?: string | null;
  email?: string | null;
  signature?: string | null;
}

export interface PrintPatient {
  name: string;
  age: string;
  gender: string;
  code: string;
}

export interface PrintComplaint {
  name: string;
  duration?: string;
}

export interface PrintVital {
  label: string;
  value: string;
}

export interface PrintItem {
  title: string;
  generic?: string;
  frequency?: string;
  dosage?: string;
  duration?: string;
  instruction?: string;
}

export interface PrintModel {
  doctor: PrintDoctor;
  patient: PrintPatient;
  date: string;
  rxNo: string;
  complaints?: PrintComplaint[];
  vitals?: PrintVital[];
  items: PrintItem[];
  advice?: string;
  notes?: string;
  followUp?: string;
  referTo?: string;
  leftSections?: { title: string; values: string[] }[];
  rightSections?: { title: string; values: string[] }[];
}

const LEFT_SECTION_DEFS: [string, string][] = [
  ["ACTIVITY_LEVEL", "Activity Level"],
  ["PAST_HISTORY", "Past History"],
  ["DRUG_HISTORY", "Drug History"],
  ["INVESTIGATIONS", "Investigations"],
  ["DIAGNOSIS", "Diagnosis"],
  ["TREATMENT_PLAN", "Treatment Plan"],
  ["OPERATION_NOTES", "Operation Notes"],
];

const RIGHT_SECTION_DEFS: [string, string][] = [
  ["PHYSIOTHERAPY", "Physiotherapy"],
  ["NEXT_PLANS", "Next Plans"],
  ["HOSPITALIZATIONS", "Hospitalizations"],
];

function renderSections(
  sections: { title: string; values: string[] }[] | undefined,
): string {
  if (!sections || sections.length === 0) return "";
  return sections
    .map(
      (s) =>
        `<div class="block"><p class="block-title">${escapeHtml(s.title)}:</p><ul>${s.values
          .map((v) => `<li>• ${escapeHtml(v)}</li>`)
          .join("")}</ul></div>`,
    )
    .join("");
}

export function escapeHtml(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB").replace(/\//g, "-");
}

function titleCaseGender(gender: string | null | undefined): string {
  if (!gender) return "—";
  return gender.charAt(0) + gender.slice(1).toLowerCase();
}

/** Builds a complete, self-contained printable HTML document from a normalized model. */
export function buildPrescriptionHtml(model: PrintModel): string {
  const { doctor, patient } = model;

  const doctorLeft = [
    `<h1>${escapeHtml(doctor.name)}</h1>`,
    doctor.qualification
      ? `<p class="doc-sub">${escapeHtml(doctor.qualification)}</p>`
      : "",
    doctor.specialization
      ? `<p class="doc-sub">${escapeHtml(doctor.specialization)}</p>`
      : "",
    doctor.bmdc ? `<p class="doc-sub">BMDC Reg: ${escapeHtml(doctor.bmdc)}</p>` : "",
  ].join("");

  const doctorRight = [
    doctor.phone ? `<p>${escapeHtml(doctor.phone)}</p>` : "",
    doctor.email ? `<p>${escapeHtml(doctor.email)}</p>` : "",
  ].join("");

  const complaints =
    model.complaints && model.complaints.length > 0
      ? `<div class="block"><p class="block-title">Complaints:</p><ul>${model.complaints
          .map(
            (c) =>
              `<li>• ${escapeHtml(c.name)}${
                c.duration ? `<span class="sub">${escapeHtml(c.duration)}</span>` : ""
              }</li>`,
          )
          .join("")}</ul></div>`
      : "";

  const vitals =
    model.vitals && model.vitals.length > 0
      ? `<div class="block"><p class="block-title">On Examination:</p><ul>${model.vitals
          .map(
            (v) =>
              `<li>• ${escapeHtml(v.label)}<span class="sub">${escapeHtml(v.value)}</span></li>`,
          )
          .join("")}</ul></div>`
      : "";

  const items =
    model.items.length > 0
      ? `<ol>${model.items
          .map((item, idx) => {
            const title = item.title;
            const generic = item.generic ? ` (${escapeHtml(item.generic)})` : "";
            const right = [
              item.instruction ? `<span class="it-right">${escapeHtml(item.instruction)}</span>` : "",
              item.duration ? `<span class="it-right">${escapeHtml(item.duration)}</span>` : "",
            ].join("");
            const sub =
              item.frequency || item.dosage
                ? `<div class="it-sub">${escapeHtml(item.frequency ?? "")}${
                    item.frequency && item.dosage ? " · " : ""
                  }${escapeHtml(item.dosage ?? "")}</div>`
                : "";
            return `<li><div class="it-row"><span class="it-title">${idx + 1}. ${escapeHtml(
              title,
            )}${generic}</span>${right}</div>${sub}</li>`;
          })
          .join("")}</ol>`
      : `<p class="muted">No medicines recorded.</p>`;

  const advice = model.advice
    ? `<div class="block advice"><p class="block-title">Advices:</p><p class="pre">${escapeHtml(
        model.advice,
      )}</p></div>`
    : "";

  const notes = model.notes
    ? `<div class="block"><p class="block-title">Notes:</p><p class="pre">${escapeHtml(
        model.notes,
      )}</p></div>`
    : "";

  const followUp =
    model.followUp || model.referTo
      ? `<p class="followup"><b>Follow up:</b> ${escapeHtml(model.followUp ?? "")}${
          model.referTo ? ` — Refer to: ${escapeHtml(model.referTo)}` : ""
        }</p>`
      : "";

  const signature = doctor.signature
    ? `<img src="${escapeHtml(doctor.signature)}" alt="signature" class="sig-img" />`
    : `<div class="sig-space"></div>`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(model.rxNo || "Prescription")}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; color: #111; margin: 0; padding: 18px; }
  .sheet { max-width: 820px; margin: 0 auto; }
  .doc-head { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; border-bottom: 2px solid #217a3c; padding: 4px 12px 6px; }
  .doc-head h1 { margin: 0; font-size: 24px; color: #217a3c; }
  .doc-sub { margin: 1px 0; font-size: 15px; font-weight: 600; color: #b42318; }
  .doc-right { text-align: right; color: #b42318; font-size: 15px; line-height: 1.35; }
  .doc-right p { margin: 0; }
  .patient { border-bottom: 2px solid #217a3c; padding: 4px 12px; font-size: 15px; }
  .rxno { border-bottom: 2px solid #217a3c; padding: 2px 12px; text-align: right; font-size: 14px; color: #b42318; }
  .body { width: 100%; border-collapse: collapse; min-height: 300px; }
  .body > tbody > tr > td { vertical-align: top; }
  .col-left { width: 26%; border-right: 1px solid #000; padding: 8px; }
  .col-right { width: 74%; padding: 8px; }
  .rx-title { font-size: 22px; font-weight: 700; margin: 0 0 6px; }
  ol { margin: 0; padding-left: 2px; list-style: none; }
  li { margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px dotted #999; }
  .it-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  .it-title { font-weight: 700; }
  .it-right { font-size: 13px; font-style: italic; white-space: nowrap; }
  .it-sub { padding-left: 16px; font-size: 13px; }
  .block { margin-bottom: 12px; }
  .block-title { font-weight: 700; margin: 0 0 2px; }
  .block ul { margin: 0; padding-left: 2px; list-style: none; }
  .sub { display: block; padding-left: 12px; font-size: 13px; }
  .pre { white-space: pre-line; margin: 0; padding-left: 8px; }
  .after-gap { height: 40px; }
  .bottom-right { width: 74%; margin-left: auto; padding: 0 8px; }
  .advice { margin: 0 0 12px; }
  .followup { margin: 8px 0; }
  .sig { margin-top: 28px; display: flex; justify-content: flex-end; padding: 0 24px 12px; }
  .sig-box { text-align: center; }
  .sig-img { height: 56px; object-fit: contain; display: block; margin: 0 auto; }
  .sig-space { height: 56px; }
  .sig-line { width: 176px; border-top: 1px solid #000; padding-top: 2px; font-size: 13px; }
  .muted { color: #666; }
  @page { margin: 14mm; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="sheet">
    <div class="doc-head">
      <div>${doctorLeft}</div>
      <div class="doc-right">${doctorRight}</div>
    </div>
    <div class="patient"><b>Name:</b> ${escapeHtml(patient.name)} &nbsp;&nbsp; <b>Age:</b> ${escapeHtml(
      patient.age,
    )} &nbsp;|&nbsp; <b>Gender:</b> ${escapeHtml(patient.gender)} &nbsp;|&nbsp; <b>Date:</b> ${escapeHtml(
      model.date,
    )} &nbsp;|&nbsp; <b>ID:</b> ${escapeHtml(patient.code)}</div>
    <div class="rxno"><b>Rx No:</b> ${escapeHtml(model.rxNo || "—")}</div>
    <table class="body"><tbody><tr>
      <td class="col-left">${complaints}${vitals}${notes}${renderSections(model.leftSections)}</td>
      <td class="col-right">
        <p class="rx-title">Rx</p>
        ${items}
        ${renderSections(model.rightSections)}
      </td>
    </tr></tbody></table>
    <div class="after-gap"></div>
    <div class="bottom-right">${advice}${followUp}</div>
    <div class="sig">
      <div class="sig-box">
        ${signature}
        <div class="sig-line">Doctor&apos;s Signature</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/** Opens a blank window, writes the document and triggers the print dialog. */
export function openPrintWindow(html: string): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
  return true;
}

/** Maps a stored prescription record to a print model. */
export function modelFromRecord(record: PrescriptionRecord): PrintModel {
  const age = record.patient.dateOfBirth
    ? (() => {
        const d = new Date(record.patient.dateOfBirth!);
        if (Number.isNaN(d.getTime())) return "—";
        const now = new Date();
        let a = now.getFullYear() - d.getFullYear();
        const m = now.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a -= 1;
        return `${Math.max(0, a)} Years`;
      })()
    : "—";

  return {
    doctor: {
      name: record.doctor.name,
      qualification: record.doctor.qualification,
      specialization: record.doctor.specialization,
      bmdc: record.doctor.bmdcRegistrationNo,
      phone: record.doctor.phone,
      email: record.doctor.email,
      signature: record.doctor.signature,
    },
    patient: {
      name: record.patient.name,
      age,
      gender: titleCaseGender(record.patient.gender),
      code: record.patient.patientCode,
    },
    date: formatDate(record.createdAt),
    rxNo: record.prescriptionNumber,
    complaints: (record.details?.complaints ?? []).map((c) => ({
      name: c.name,
      duration: c.duration ?? undefined,
    })),
    vitals: (record.details?.vitals ?? []).map((v) => ({
      label: v.label,
      value: v.value,
    })),
    items: record.items.map((item) => ({
      title: item.medicine.brandName || item.medicine.genericName,
      generic: item.medicine.brandName ? item.medicine.genericName : "",
      frequency: item.frequency ?? "",
      dosage: item.dosage ?? "",
      duration: item.duration ?? "",
      instruction: item.instruction ?? "",
    })),
    advice: record.details?.advice ?? "",
    followUp: record.details?.followUp ?? "",
    referTo: record.details?.referTo ?? "",
    notes: record.notes ?? "",
    leftSections: LEFT_SECTION_DEFS.flatMap(([key, title]) => {
      const values = (record.details as Record<string, unknown> | null | undefined)?.[key];
      return Array.isArray(values) && values.length > 0
        ? [{ title, values: values as string[] }]
        : [];
    }),
    rightSections: RIGHT_SECTION_DEFS.flatMap(([key, title]) => {
      const values = (record.details as Record<string, unknown> | null | undefined)?.[key];
      return Array.isArray(values) && values.length > 0
        ? [{ title, values: values as string[] }]
        : [];
    }),
  };
}

export { formatDate as formatPrintDate };

/** Builds a plain-text subject/body for emailing a prescription. */
export function buildPrescriptionEmail(model: PrintModel): {
  subject: string;
  body: string;
} {
  const subject = `Prescription ${model.rxNo} - ${model.patient.name}`;
  const lines: string[] = [];

  lines.push(`Prescription: ${model.rxNo}`);
  lines.push(`Date: ${model.date}`);
  lines.push("");
  lines.push(`Patient: ${model.patient.name} (ID: ${model.patient.code})`);
  lines.push(
    `Doctor: ${model.doctor.name}${
      model.doctor.qualification ? `, ${model.doctor.qualification}` : ""
    }`,
  );
  lines.push("");

  if (model.complaints && model.complaints.length > 0) {
    lines.push("Complaints:");
    for (const c of model.complaints) {
      lines.push(`- ${c.name}${c.duration ? ` (${c.duration})` : ""}`);
    }
    lines.push("");
  }

  if (model.vitals && model.vitals.length > 0) {
    lines.push("On Examination:");
    for (const v of model.vitals) lines.push(`- ${v.label}: ${v.value}`);
    lines.push("");
  }

  for (const s of model.leftSections ?? []) {
    lines.push(`${s.title}:`);
    for (const v of s.values) lines.push(`- ${v}`);
    lines.push("");
  }

  if (model.notes) {
    lines.push(`Notes: ${model.notes}`);
    lines.push("");
  }

  lines.push("Rx:");
  if (model.items.length === 0) {
    lines.push("- No medicines recorded.");
  } else {
    model.items.forEach((item, idx) => {
      const title = item.generic ? `${item.title} (${item.generic})` : item.title;
      const details = [item.frequency, item.dosage, item.duration, item.instruction]
        .filter(Boolean)
        .join(", ");
      lines.push(`${idx + 1}. ${title}${details ? ` - ${details}` : ""}`);
    });
  }
  lines.push("");

  for (const s of model.rightSections ?? []) {
    lines.push(`${s.title}:`);
    for (const v of s.values) lines.push(`- ${v}`);
    lines.push("");
  }

  if (model.advice) {
    lines.push(`Advices: ${model.advice}`);
    lines.push("");
  }
  if (model.followUp || model.referTo) {
    lines.push(
      `Follow up: ${model.followUp ?? ""}${model.referTo ? ` — Refer to: ${model.referTo}` : ""}`,
    );
    lines.push("");
  }

  lines.push(`- ${model.doctor.name}`);
  return { subject, body: lines.join("\n") };
}