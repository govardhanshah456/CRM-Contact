import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ApiError,
  bulkAssignTags,
  contactName,
  createContact,
  deleteContact,
  listContacts,
  listTags,
} from "../api.ts";
import type { ContactQuery } from "../types.ts";
import { When } from "../when.tsx";

const PAGE_SIZE = 20;
type SortColumn = "name" | "created_at" | "updated_at";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactsPage() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [company, setCompany] = useState(params.get("company") ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkTagId, setBulkTagId] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [bulkPending, setBulkPending] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [adding, setAdding] = useState(false);

  const query = readQuery(params);

  function setSort(column: SortColumn) {
    const explicit = params.get("sortBy") === column;
    const order = params.get("order");
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("page");
      if (!explicit) {
        next.set("sortBy", column);
        next.set("order", "asc");
      } else if (order === "asc") {
        next.set("order", "desc");
      } else {
        next.delete("sortBy");
        next.delete("order");
      }
      return next;
    });
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      replaceParam(setParams, "q", q.trim());
    }, 300);
    return () => window.clearTimeout(handle);
  }, [q, setParams]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      replaceParam(setParams, "company", company.trim());
    }, 300);
    return () => window.clearTimeout(handle);
  }, [company, setParams]);

  const contactsQuery = useQuery({
    queryKey: ["contacts", query],
    queryFn: () => listContacts(query),
  });
  const tagsQuery = useQuery({
    queryKey: ["tags"],
    queryFn: listTags,
  });

  const contacts = contactsQuery.data?.contacts ?? [];
  const pageIds = contacts.map((contact) => contact.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function togglePage() {
    setSelected((current) => {
      if (allSelected) {
        return current.filter((id) => !pageIds.includes(id));
      }
      return [...new Set([...current, ...pageIds])];
    });
  }

  async function removeContact(id: string, name: string) {
    if (!window.confirm(`Delete ${name}?`)) return;
    setDeleteError("");
    setDeletingId(id);
    try {
      await deleteContact(id);
      setSelected((current) => current.filter((item) => item !== id));
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
    } catch (error) {
      setDeleteError(error instanceof ApiError ? error.message : "Could not delete the contact.");
    } finally {
      setDeletingId("");
    }
  }

  async function assignSelected() {
    setBulkError("");
    setBulkMessage("");
    if (!bulkTagId) {
      setBulkError("Choose a tag to assign.");
      return;
    }
    setBulkPending(true);
    try {
      const result = await bulkAssignTags(selected, bulkTagId);
      setBulkMessage(
        result.assigned === 0
          ? "Those contacts already have this tag."
          : `Assigned the tag to ${result.assigned} contact${result.assigned === 1 ? "" : "s"}.`,
      );
      setSelected([]);
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
    } catch (error) {
      setBulkError(error instanceof ApiError ? error.message : "Could not assign the tag.");
    } finally {
      setBulkPending(false);
    }
  }

  const total = contactsQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section>
      <div className="name-cell">
        <h1>Contacts</h1>
        <button type="button" onClick={() => setAdding((open) => !open)}>
          {adding ? "Close" : "Add contact"}
        </button>
      </div>
      {adding && (
        <AddContactForm
          onCreated={async () => {
            setAdding(false);
            await queryClient.invalidateQueries({ queryKey: ["contacts"] });
          }}
        />
      )}
      <form className="filters" onSubmit={(event) => event.preventDefault()}>
        <label>
          Search
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Name, email, phone, or company"
          />
        </label>
        <label>
          Company
          <input
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            placeholder="Exact company"
          />
        </label>
        <label>
          Tag
          <select
            value={params.get("tags") ?? ""}
            onChange={(event) => replaceParam(setParams, "tags", event.target.value)}
          >
            <option value="">Any tag</option>
            {(tagsQuery.data?.tags ?? []).map((tag) => (
              <option key={tag.id} value={tag.name}>
                {tag.name}
              </option>
            ))}
          </select>
        </label>
      </form>

      {contactsQuery.isLoading && <p className="status">Loading contacts…</p>}
      {contactsQuery.isError && (
        <p className="banner error" role="alert">
          {contactsQuery.error instanceof ApiError
            ? contactsQuery.error.message
            : "Could not load contacts. Check that the API is running."}
        </p>
      )}
      {bulkError && (
        <p className="banner error" role="alert">
          {bulkError}
        </p>
      )}
      {bulkMessage && <p className="banner info">{bulkMessage}</p>}
      {deleteError && (
        <p className="banner error" role="alert">
          {deleteError}
        </p>
      )}

      {contactsQuery.isSuccess && contacts.length === 0 && (
        <p className="status">No contacts match these filters.</p>
      )}

      {contacts.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="check-cell">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={togglePage}
                    aria-label="Select all contacts on this page"
                  />
                </th>
                <SortHeader
                  label="Name"
                  column="name"
                  active={params.get("sortBy") === "name"}
                  order={params.get("order") === "desc" ? "desc" : "asc"}
                  onSort={setSort}
                />
                <th>Email</th>
                <th>Phone</th>
                <th>Company</th>
                <th>Tags</th>
                <SortHeader
                  label="Created"
                  column="created_at"
                  active={params.get("sortBy") === "created_at"}
                  order={params.get("order") === "desc" ? "desc" : "asc"}
                  onSort={setSort}
                />
                <SortHeader
                  label="Updated"
                  column="updated_at"
                  active={params.get("sortBy") === "updated_at"}
                  order={params.get("order") === "desc" ? "desc" : "asc"}
                  onSort={setSort}
                />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id} className={selected.includes(contact.id) ? "is-selected" : undefined}>
                  <td className="check-cell">
                    <input
                      type="checkbox"
                      checked={selected.includes(contact.id)}
                      onChange={() => toggle(contact.id)}
                      aria-label={`Select ${contactName(contact)}`}
                    />
                  </td>
                  <td>
                    <Link to={`/contacts/${contact.id}`}>{contactName(contact)}</Link>
                  </td>
                  <td>{contact.email ?? "—"}</td>
                  <td>{contact.phone ?? "—"}</td>
                  <td>{contact.company ?? "—"}</td>
                  <td>
                    {contact.tags.length === 0 ? (
                      "—"
                    ) : (
                      <span className="tag-list">
                        {contact.tags.map((tag) => (
                          <span key={tag.id} className="tag-chip">
                            {tag.name}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td>
                    <When value={contact.created_at} />
                  </td>
                  <td>
                    <When value={contact.updated_at} />
                  </td>
                  <td className="row-end">
                    <button
                      type="button"
                      className="danger"
                      disabled={deletingId === contact.id}
                      onClick={() => void removeContact(contact.id, contactName(contact))}
                    >
                      {deletingId === contact.id ? "Deleting…" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {contactsQuery.isSuccess && total > 0 && (
        <div className="pager">
          <button
            type="button"
            disabled={query.page <= 1}
            onClick={() => replaceParam(setParams, "page", String(query.page - 1), false)}
          >
            Previous
          </button>
          <span>
            Page {query.page} of {pageCount} · {total} contacts
          </span>
          <button
            type="button"
            disabled={query.page >= pageCount}
            onClick={() => replaceParam(setParams, "page", String(query.page + 1), false)}
          >
            Next
          </button>
        </div>
      )}

      {selected.length > 0 && (
        <div className="bulk">
          <strong>{selected.length} selected</strong>
          <label>
            Tag
            <select value={bulkTagId} onChange={(event) => setBulkTagId(event.target.value)}>
              <option value="">Choose a tag</option>
              {(tagsQuery.data?.tags ?? []).map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => void assignSelected()} disabled={bulkPending}>
            {bulkPending ? "Assigning…" : "Assign tag"}
          </button>
          <button type="button" className="secondary" onClick={() => setSelected([])}>
            Clear
          </button>
        </div>
      )}
    </section>
  );
}

function AddContactForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const navigate = useNavigate();
  const [values, setValues] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company: "",
  });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const body: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) {
      const trimmed = value.trim();
      if (!trimmed) continue;
      if (key === "email" && !EMAIL.test(trimmed)) {
        setError("Enter a valid email address.");
        return;
      }
      body[key] = key === "email" ? trimmed.toLowerCase() : trimmed;
    }
    if (Object.keys(body).length === 0) {
      setError("Enter at least one field.");
      return;
    }
    setPending(true);
    try {
      const contact = await createContact(body);
      await onCreated();
      navigate(`/contacts/${contact.id}`);
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Could not add the contact.");
      setPending(false);
    }
  }

  return (
    <form className="stack add-contact" onSubmit={(event) => void submit(event)}>
      <label>
        First name
        <input
          value={values.first_name}
          onChange={(event) => setValues({ ...values, first_name: event.target.value })}
        />
      </label>
      <label>
        Last name
        <input
          value={values.last_name}
          onChange={(event) => setValues({ ...values, last_name: event.target.value })}
        />
      </label>
      <label>
        Email
        <input
          type="email"
          value={values.email}
          onChange={(event) => setValues({ ...values, email: event.target.value })}
        />
      </label>
      <label>
        Phone
        <input
          value={values.phone}
          onChange={(event) => setValues({ ...values, phone: event.target.value })}
        />
      </label>
      <label>
        Company
        <input
          value={values.company}
          onChange={(event) => setValues({ ...values, company: event.target.value })}
        />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save contact"}
      </button>
      {error && (
        <p className="banner error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function SortHeader({
  label,
  column,
  active,
  order,
  onSort,
}: {
  label: string;
  column: SortColumn;
  active: boolean;
  order: "asc" | "desc";
  onSort: (column: SortColumn) => void;
}) {
  return (
    <th aria-sort={active ? (order === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className={active ? "sort-header is-active" : "sort-header"} onClick={() => onSort(column)}>
        {label}
        {active && <span aria-hidden="true">{order === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}

function readQuery(params: URLSearchParams): ContactQuery {
  const sortBy = params.get("sortBy");
  const order = params.get("order");
  const page = Number(params.get("page") ?? "1");
  return {
    q: params.get("q") ?? undefined,
    company: params.get("company") ?? undefined,
    tags: params.get("tags") ?? undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    limit: PAGE_SIZE,
    sortBy:
      sortBy === "name" || sortBy === "company" || sortBy === "updated_at" || sortBy === "created_at"
        ? sortBy
        : "created_at",
    order: order === "asc" ? "asc" : "desc",
  };
}

function replaceParam(
  setParams: ReturnType<typeof useSearchParams>[1],
  key: string,
  value: string,
  resetPage = true,
) {
  setParams((current) => {
    const next = new URLSearchParams(current);
    if (value) next.set(key, value);
    else next.delete(key);
    if (resetPage) next.delete("page");
    if ((current.get(key) ?? "") === value) return current;
    if (next.toString() === current.toString()) return current;
    return next;
  });
}
