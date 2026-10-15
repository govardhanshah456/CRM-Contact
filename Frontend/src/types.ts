export type Tag = {
  id: string;
  name: string;
  created_at: string;
};

export type Contact = {
  id: string;
  first_name: string | null;
  first_name_version: number;
  last_name: string | null;
  last_name_version: number;
  email: string | null;
  email_version: number;
  phone: string | null;
  phone_version: number;
  company: string | null;
  company_version: number;
  overall_version: number;
  created_at: string;
  updated_at: string;
  tags: Tag[];
};

export type ContactField =
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "company";

export type Activity = {
  id: string;
  contact_id: string;
  action: string;
  created_at: string;
};

export type ContactList = {
  contacts: Contact[];
  total: number;
  page: number;
  limit: number;
};

export type ContactQuery = {
  q?: string;
  company?: string;
  tags?: string;
  page: number;
  limit: number;
  sortBy: "name" | "company" | "created_at" | "updated_at";
  order: "asc" | "desc";
};
