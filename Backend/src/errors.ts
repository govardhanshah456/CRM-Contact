import { QueryFailedError } from "typeorm";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

function driverConstraint(error: unknown, code: string): string | undefined {
  if (!(error instanceof QueryFailedError)) {
    return undefined;
  }

  const driverError = error.driverError as { code?: string; constraint?: string };
  if (driverError.code !== code) {
    return undefined;
  }

  return driverError.constraint;
}

export function uniqueConstraint(error: unknown): string | undefined {
  return driverConstraint(error, "23505");
}

export function rethrowAsHttp(error: unknown): never {
  if (error instanceof HttpError) {
    throw error;
  }

  const constraint = uniqueConstraint(error);
  if (constraint === "contacts_email_lower_unique") {
    throw new HttpError(409, "Email already exists");
  }
  if (constraint === "tags_name_lower_unique") {
    throw new HttpError(409, "Tag name already exists");
  }

  const foreignKey = driverConstraint(error, "23503");
  if (foreignKey === "contact_tags_contact_id_fkey") {
    throw new HttpError(404, "Contact not found");
  }
  if (foreignKey === "contact_tags_tag_id_fkey") {
    throw new HttpError(404, "Tag not found");
  }

  throw error;
}
