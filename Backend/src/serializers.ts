import type { Contact } from "./entities/contact.js";
import type { ContactActivity } from "./entities/contact-activity.js";
import type { Tag } from "./entities/tag.js";

export function toTag(tag: Tag) {
  return {
    id: tag.id,
    name: tag.name,
    created_at: tag.createdAt,
  };
}

export function toContact(contact: Contact) {
  return {
    id: contact.id,
    first_name: contact.firstName,
    first_name_version: contact.firstNameVersion,
    last_name: contact.lastName,
    last_name_version: contact.lastNameVersion,
    email: contact.email,
    email_version: contact.emailVersion,
    phone: contact.phone,
    phone_version: contact.phoneVersion,
    company: contact.company,
    company_version: contact.companyVersion,
    overall_version: contact.overallVersion,
    created_at: contact.createdAt,
    updated_at: contact.updatedAt,
    tags: (contact.tags ?? [])
      .map(toTag)
      .sort((left, right) => left.name.localeCompare(right.name)),
  };
}

export function toActivity(activity: ContactActivity) {
  return {
    id: activity.id,
    contact_id: activity.contact.id,
    action: activity.action,
    created_at: activity.createdAt,
  };
}
