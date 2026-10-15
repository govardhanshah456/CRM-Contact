import type { Activity, Contact, ContactList, ContactQuery, Tag } from "./types.ts";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const body = text ? (JSON.parse(text) as { error?: string }) : {};

  if (!response.ok) {
    throw new ApiError(response.status, body.error ?? "Request failed");
  }

  return body as T;
}

export function listContacts(query: ContactQuery) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.company) params.set("company", query.company);
  if (query.tags) params.set("tags", query.tags);
  params.set("page", String(query.page));
  params.set("limit", String(query.limit));
  params.set("sortBy", query.sortBy);
  params.set("order", query.order);
  return request<ContactList>(`/api/contacts?${params.toString()}`);
}

export function createContact(body: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
}) {
  return request<Contact>("/api/contacts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getContact(id: string) {
  return request<Contact>(`/api/contacts/${id}`);
}

export function updateContact(
  id: string,
  body: Record<string, unknown>,
) {
  return request<Contact>(`/api/contacts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteContact(id: string) {
  return request<void>(`/api/contacts/${id}`, { method: "DELETE" });
}

export function listTags() {
  return request<{ tags: Tag[] }>("/api/tags");
}

export function createTag(name: string) {
  return request<Tag>("/api/tags", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function assignTag(contactId: string, tagId: string) {
  return request<void>(`/api/contacts/${contactId}/tags/${tagId}`, {
    method: "PATCH",
  });
}

export function unassignTag(contactId: string, tagId: string) {
  return request<void>(`/api/contacts/${contactId}/tags/${tagId}`, {
    method: "DELETE",
  });
}

export function bulkAssignTags(contactIds: string[], tagId: string) {
  return request<{ assigned: number; tagId: string }>("/api/contacts/bulk-tags", {
    method: "POST",
    body: JSON.stringify({ contactIds, tagId }),
  });
}

export function listActivities(contactId: string) {
  return request<{ activities: Activity[] }>(
    `/api/contacts/${contactId}/activities`,
  );
}

export function contactName(contact: Pick<Contact, "first_name" | "last_name">) {
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
  return name || "Unnamed contact";
}
