import type { Request } from "express";
import { HttpError } from "./errors.js";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CONTACT_FIELDS = {
  first_name: {
    prop: "firstName",
    column: "first_name",
    versionColumn: "first_name_version",
  },
  last_name: {
    prop: "lastName",
    column: "last_name",
    versionColumn: "last_name_version",
  },
  email: {
    prop: "email",
    column: "email",
    versionColumn: "email_version",
  },
  phone: {
    prop: "phone",
    column: "phone",
    versionColumn: "phone_version",
  },
  company: {
    prop: "company",
    column: "company",
    versionColumn: "company_version",
  },
} as const;

export type ContactField = keyof typeof CONTACT_FIELDS;

const SORT_FIELDS = new Set(["name", "company", "created_at", "updated_at"]);

export type CreateContactInput = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  tagIds: string[];
};

export type ContactPatch = {
  values: Partial<Record<ContactField, string | null>>;
  expectedVersions: Partial<Record<ContactField, number>>;
};

export type ListContactsQuery = {
  q?: string;
  company?: string;
  tags: string[];
  page: number;
  limit: number;
  sortBy: "name" | "company" | "created_at" | "updated_at";
  order: "ASC" | "DESC";
};

export function pathParam(value: string | string[] | undefined, name: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new HttpError(400, `Invalid ${name}`);
  }
  return value;
}

export function parseUuid(value: string, name: string): string {
  if (!UUID.test(value)) {
    throw new HttpError(400, `Invalid ${name}`);
  }
  return value.toLowerCase();
}

export function parseCreateContact(body: unknown): CreateContactInput {
  const record = expectObject(body);
  assertAllowedKeys(record, [...Object.keys(CONTACT_FIELDS), "tagIds"]);

  return {
    firstName: readOptionalString(record, "first_name"),
    lastName: readOptionalString(record, "last_name"),
    email: readOptionalEmail(record),
    phone: readOptionalString(record, "phone"),
    company: readOptionalString(record, "company"),
    tagIds: readUuidList(record.tagIds, "tagIds", false),
  };
}

export function parseContactPatch(body: unknown): ContactPatch {
  const record = expectObject(body);
  assertAllowedKeys(record, [...Object.keys(CONTACT_FIELDS), "expectedVersions"]);

  const expectedRecord = record.expectedVersions;
  if (
    expectedRecord === null ||
    typeof expectedRecord !== "object" ||
    Array.isArray(expectedRecord)
  ) {
    throw new HttpError(400, "expectedVersions is required");
  }

  const versions = expectedRecord as Record<string, unknown>;
  const values: ContactPatch["values"] = {};
  const expectedVersions: ContactPatch["expectedVersions"] = {};

  for (const field of Object.keys(CONTACT_FIELDS) as ContactField[]) {
    if (record[field] === undefined) {
      continue;
    }

    values[field] =
      field === "email"
        ? readNullableEmail(record[field])
        : readNullableString(record[field], field);

    const version = versions[field];
    if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
      throw new HttpError(
        400,
        `expectedVersions.${field} must be a positive integer`,
      );
    }
    expectedVersions[field] = version;
  }

  for (const key of Object.keys(versions)) {
    if (!(key in values)) {
      throw new HttpError(400, `expectedVersions.${key} has no matching field`);
    }
  }

  if (Object.keys(values).length === 0) {
    throw new HttpError(400, "At least one field is required");
  }

  return { values, expectedVersions };
}

export function parseListContactsQuery(
  query: Request["query"],
): ListContactsQuery {
  const sortBy = readQueryString(query.sortBy, "sortBy") ?? "created_at";
  if (!SORT_FIELDS.has(sortBy)) {
    throw new HttpError(400, "Unsupported sort field");
  }

  const orderRaw = (readQueryString(query.order, "order") ?? "desc").toLowerCase();
  if (orderRaw !== "asc" && orderRaw !== "desc") {
    throw new HttpError(400, "order must be asc or desc");
  }

  const q = readQueryString(query.q, "q")?.trim();
  const company = readQueryString(query.company, "company")?.trim();
  const tagsRaw = readQueryString(query.tags, "tags");
  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
    : [];

  return {
    q: q && q.length > 0 ? q : undefined,
    company: company && company.length > 0 ? company : undefined,
    tags,
    page: positiveInt(readQueryString(query.page, "page"), "page", 1),
    limit: positiveInt(readQueryString(query.limit, "limit"), "limit", 20, 100),
    sortBy: sortBy as ListContactsQuery["sortBy"],
    order: orderRaw === "asc" ? "ASC" : "DESC",
  };
}

export function parseTagName(body: unknown): string {
  const record = expectObject(body);
  assertAllowedKeys(record, ["name"]);
  const name = readNullableString(record.name, "name");
  if (name === null) {
    throw new HttpError(400, "name is required");
  }
  return name;
}

export function parseBulkTags(body: unknown): { contactIds: string[]; tagId: string } {
  const record = expectObject(body);
  assertAllowedKeys(record, ["contactIds", "tagId"]);

  if (typeof record.tagId !== "string") {
    throw new HttpError(400, "Invalid tagId");
  }

  const contactIds = readUuidList(record.contactIds, "contactIds", true);
  if (contactIds.length > 1000) {
    throw new HttpError(400, "contactIds must contain at most 1000 ids");
  }

  return {
    contactIds,
    tagId: parseUuid(record.tagId, "tagId"),
  };
}

export function parseLimit(value: unknown, fallback: number): number {
  return positiveInt(readQueryString(value, "limit"), "limit", fallback, 100);
}

function expectObject(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be an object");
  }
  return body as Record<string, unknown>;
}

function assertAllowedKeys(record: Record<string, unknown>, allowed: string[]) {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      throw new HttpError(400, `Unsupported field ${key}`);
    }
  }
}

function readOptionalString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  if (record[key] === undefined) {
    return null;
  }
  return readNullableString(record[key], key);
}

function readNullableString(value: unknown, key: string): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new HttpError(400, `${key} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new HttpError(400, `${key} cannot be empty`);
  }
  return trimmed;
}

function readOptionalEmail(record: Record<string, unknown>): string | null {
  if (record.email === undefined) {
    return null;
  }
  return readNullableEmail(record.email);
}

function readNullableEmail(value: unknown): string | null {
  const email = readNullableString(value, "email");
  if (email === null) {
    return null;
  }
  if (!EMAIL.test(email)) {
    throw new HttpError(400, "email must be a valid email address");
  }
  return email.toLowerCase();
}

function readUuidList(value: unknown, key: string, required: boolean): string[] {
  if (value === undefined) {
    if (required) {
      throw new HttpError(400, `${key} is required`);
    }
    return [];
  }
  if (!Array.isArray(value)) {
    throw new HttpError(400, `${key} must be an array of uuids`);
  }
  if (required && value.length === 0) {
    throw new HttpError(400, `${key} must contain at least one uuid`);
  }
  return [...new Set(value.map((item) => {
    if (typeof item !== "string") {
      throw new HttpError(400, `${key} must be an array of uuids`);
    }
    return parseUuid(item, key);
  }))];
}

function readQueryString(value: unknown, name: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new HttpError(400, `${name} must be a string`);
  }
  return value;
}

function positiveInt(
  value: string | undefined,
  name: string,
  fallback: number,
  max?: number,
): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  if (!/^\d+$/.test(value) || value === "0") {
    throw new HttpError(400, `${name} must be a positive integer`);
  }
  const parsed = Number(value);
  if (max !== undefined && parsed > max) {
    throw new HttpError(400, `${name} must be at most ${max}`);
  }
  return parsed;
}
