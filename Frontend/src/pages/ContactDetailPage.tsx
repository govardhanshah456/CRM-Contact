import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ApiError,
  assignTag,
  contactName,
  createTag,
  deleteContact,
  getContact,
  listActivities,
  listTags,
  unassignTag,
  updateContact,
} from "../api.ts";
import type { Contact, ContactField } from "../types.ts";
import { whenText } from "../when.tsx";

const FIELDS: { key: ContactField; label: string; version: keyof Contact }[] = [
  { key: "first_name", label: "First name", version: "first_name_version" },
  { key: "last_name", label: "Last name", version: "last_name_version" },
  { key: "email", label: "Email", version: "email_version" },
  { key: "phone", label: "Phone", version: "phone_version" },
  { key: "company", label: "Company", version: "company_version" },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormValues = Record<ContactField, string>;

export function ContactDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const contactQuery = useQuery({
    queryKey: ["contact", id],
    queryFn: () => getContact(id),
    enabled: id.length > 0,
  });
  const activitiesQuery = useQuery({
    queryKey: ["activities", id],
    queryFn: () => listActivities(id),
    enabled: id.length > 0,
  });

  if (contactQuery.isLoading) {
    return <p className="status">Loading contact…</p>;
  }

  if (contactQuery.isError || !contactQuery.data) {
    return (
      <p className="banner error" role="alert">
        {contactQuery.error instanceof ApiError
          ? contactQuery.error.message
          : "Could not load this contact."}
      </p>
    );
  }

  return (
    <section>
      <p>
        <Link to="/contacts">Back to contacts</Link>
      </p>
      <div className="name-cell">
        <div>
          <h1>{contactName(contactQuery.data)}</h1>
          <p className="timestamps">
            <span>
              Created{" "}
              <time dateTime={contactQuery.data.created_at}>{whenText(contactQuery.data.created_at)}</time>
            </span>
            <span>
              Updated{" "}
              <time dateTime={contactQuery.data.updated_at}>{whenText(contactQuery.data.updated_at)}</time>
            </span>
          </p>
        </div>
        <button
          type="button"
          className="danger"
          disabled={deleting}
          onClick={() => {
            const name = contactName(contactQuery.data);
            if (!window.confirm(`Delete ${name}?`)) return;
            setDeleteError("");
            setDeleting(true);
            void deleteContact(id)
              .then(async () => {
                await queryClient.invalidateQueries({ queryKey: ["contacts"] });
                navigate("/contacts");
              })
              .catch((error: unknown) => {
                setDeleteError(
                  error instanceof ApiError ? error.message : "Could not delete the contact.",
                );
                setDeleting(false);
              });
          }}
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
      {deleteError && (
        <p className="banner error" role="alert">
          {deleteError}
        </p>
      )}
      <ContactForm
        contact={contactQuery.data}
        onSaved={async () => {
          await queryClient.invalidateQueries({ queryKey: ["contact", id] });
          await queryClient.invalidateQueries({ queryKey: ["activities", id] });
          await queryClient.invalidateQueries({ queryKey: ["contacts"] });
        }}
      />
      <TagEditor
        contact={contactQuery.data}
        onChanged={async () => {
          await queryClient.invalidateQueries({ queryKey: ["contact", id] });
          await queryClient.invalidateQueries({ queryKey: ["activities", id] });
          await queryClient.invalidateQueries({ queryKey: ["tags"] });
          await queryClient.invalidateQueries({ queryKey: ["contacts"] });
        }}
      />
      <section className="panel">
        <h2>Recent activity</h2>
      {activitiesQuery.isLoading && <p className="status">Loading activity…</p>}
      {activitiesQuery.isError && (
        <p className="banner error" role="alert">
          Could not load activity.
        </p>
      )}
      {activitiesQuery.isSuccess && activitiesQuery.data.activities.length === 0 && (
        <p className="status">No activity yet.</p>
      )}
      {activitiesQuery.isSuccess && activitiesQuery.data.activities.length > 0 && (
        <ul className="activity">
          {activitiesQuery.data.activities.map((activity) => (
            <li key={activity.id}>
              <span>{activity.action}</span>
              <time dateTime={activity.created_at}>{whenText(activity.created_at)}</time>
            </li>
          ))}
        </ul>
      )}
      </section>
    </section>
  );
}

function ContactForm({
  contact,
  onSaved,
}: {
  contact: Contact;
  onSaved: () => Promise<void>;
}) {
  const [conflict, setConflict] = useState(false);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const form = useForm<FormValues>({ defaultValues: toForm(contact) });
  const { reset } = form;

  useEffect(() => {
    reset(toForm(contact));
  }, [contact, reset]);

  async function onSubmit(values: FormValues) {
    setConflict(false);
    setMessage("");
    setFailure("");
    form.clearErrors();

    const body: Record<string, unknown> = {};
    const expectedVersions: Record<string, number> = {};

    for (const field of FIELDS) {
      const raw = values[field.key].trim();
      if (raw.length === 0) {
        if (contact[field.key] !== null) {
          body[field.key] = null;
          expectedVersions[field.key] = contact[field.version] as number;
        }
        continue;
      }
      if (field.key === "email" && !EMAIL.test(raw)) {
        form.setError("email", { message: "Enter a valid email address." });
        return;
      }
      const next = field.key === "email" ? raw.toLowerCase() : raw;
      if (next !== contact[field.key]) {
        body[field.key] = next;
        expectedVersions[field.key] = contact[field.version] as number;
      }
    }

    if (Object.keys(expectedVersions).length === 0) {
      setMessage("No changes to save.");
      return;
    }

    try {
      await updateContact(contact.id, { ...body, expectedVersions });
      setMessage("Contact saved.");
      await onSaved();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && error.message === "Email already exists") {
        setFailure("That email is already used by another contact.");
        return;
      }
      if (error instanceof ApiError && error.status === 409) {
        setConflict(true);
        await onSaved();
        return;
      }
      setFailure(error instanceof ApiError ? error.message : "Could not save the contact.");
    }
  }

  return (
    <form className="stack" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      {FIELDS.map((field) => (
        <label key={field.key}>
          {field.label}
          <input type={field.key === "email" ? "email" : "text"} {...form.register(field.key)} />
          {form.formState.errors[field.key] && (
            <span className="field-error">{form.formState.errors[field.key]?.message}</span>
          )}
        </label>
      ))}
      <button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Saving…" : "Save changes"}
      </button>
      {conflict && (
        <p className="banner warn" role="alert">
          Someone else updated one of these fields. The form was reloaded with the latest values.
          Review them and save again.
        </p>
      )}
      {failure && (
        <p className="banner error" role="alert">
          {failure}
        </p>
      )}
      {message && <p className="banner info">{message}</p>}
    </form>
  );
}

function TagEditor({
  contact,
  onChanged,
}: {
  contact: Contact;
  onChanged: () => Promise<void>;
}) {
  const tagsQuery = useQuery({ queryKey: ["tags"], queryFn: listTags });
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const assigned = new Set(contact.tags.map((tag) => tag.id));
  const available = (tagsQuery.data?.tags ?? []).filter((tag) => !assigned.has(tag.id));

  async function addTag(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    setError("");
    if (!trimmed) {
      setError("Enter a tag name.");
      return;
    }
    setPending(true);
    try {
      const existing = (tagsQuery.data?.tags ?? []).find(
        (tag) => tag.name.toLowerCase() === trimmed.toLowerCase(),
      );
      let tagId = existing?.id;
      if (!tagId) {
        try {
          tagId = (await createTag(trimmed)).id;
        } catch (createError) {
          if (!(createError instanceof ApiError) || createError.status !== 409) {
            throw createError;
          }
          const fresh = await listTags();
          tagId = fresh.tags.find((tag) => tag.name.toLowerCase() === trimmed.toLowerCase())?.id;
          if (!tagId) throw createError;
        }
      }
      await assignTag(contact.id, tagId);
      setName("");
      await onChanged();
    } catch (addError) {
      setError(addError instanceof ApiError ? addError.message : "Could not add the tag.");
    } finally {
      setPending(false);
    }
  }

  async function removeTag(tagId: string) {
    setError("");
    setPending(true);
    try {
      await unassignTag(contact.id, tagId);
      await onChanged();
    } catch (removeError) {
      setError(removeError instanceof ApiError ? removeError.message : "Could not remove the tag.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel">
      <h2>Tags</h2>
      {contact.tags.length === 0 && <p className="status">No tags yet.</p>}
      {contact.tags.length > 0 && (
        <ul className="tags">
          {contact.tags.map((tag) => (
            <li key={tag.id}>
              {tag.name}
              <button type="button" onClick={() => void removeTag(tag.id)} disabled={pending}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="tag-add" onSubmit={(event) => void addTag(event)}>
        <label>
          Add a tag
          <input
            list="available-tags"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="vip"
          />
        </label>
        <datalist id="available-tags">
          {available.map((tag) => (
            <option key={tag.id} value={tag.name} />
          ))}
        </datalist>
        <button type="submit" disabled={pending}>
          {pending ? "Working…" : "Add tag"}
        </button>
      </form>
      {error && (
        <p className="banner error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function toForm(contact: Contact): FormValues {
  return {
    first_name: contact.first_name ?? "",
    last_name: contact.last_name ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    company: contact.company ?? "",
  };
}
