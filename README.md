# CRM Contact Workspace

A contact list with search, filters, tags, activity history, and field-level concurrent edits.

## How to run

PostgreSQL needs to be running locally. Create the database once:

```sql
CREATE ROLE postgres LOGIN PASSWORD 'postgres' SUPERUSER;
CREATE DATABASE crm_contact OWNER postgres;
```

Skip the role if `postgres` already exists. Connection defaults live in `Backend/.env.example` (`localhost:5432`, database `crm_contact`). Copy that file to `Backend/.env` only if you need different values.

Start the API first, then the UI. The frontend proxies `/api` to `http://localhost:3010`.

```bash
cd Backend
npm install
npm run dev
```

The API listens on port 3010 and applies pending migrations on startup.

In a second terminal:

```bash
cd Backend
npm run seed
```

Seed loads 1000 contacts and 100 tags, with 3–4 tags on each contact. It replaces existing contacts and tags.

```bash
cd Frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The API is at `http://localhost:3010`.

Backend tests use the same database and remove the rows they create:

```bash
cd Backend
npm test
```

## Tech stack

- Frontend: React, TypeScript, Vite, React Router, TanStack Query, React Hook Form
- Backend: Node.js, Express, TypeScript, TypeORM
- Database: PostgreSQL
- Tests: Node.js test runner and Supertest

## Technical decisions

- Routes, controllers, and services are separate. A route only matches the URL and status code. The service owns the query and the transaction, so the same rule is not copied into every handler.
- Primary keys are UUIDs. The API can return an id without reading it back from a database sequence, and the id does not show how many contacts exist.
- Schema changes go through TypeORM migrations, with `synchronize` off. A migration is a reviewed SQL change. Leaving schema sync on would let the server alter tables from the entity files at startup.
- PostgreSQL enforces unique emails, unique tag names (case-insensitive), and one row per contact-tag pair. Two requests can both pass an application check before either insert lands. The unique index lets one commit and returns the other as `409`.
- Contact writes and their activity records run in the same transaction. The contact change and its history commit together, so a failed activity insert does not leave a saved edit with no record.
- Search, company filter, tag filter, sort, and pagination run on the server. The list can grow past what the browser should download and filter itself. Sort columns are limited to `name`, `company`, `created_at`, and `updated_at`, so a query parameter cannot choose an arbitrary column.
- Contacts and tags use a `contact_tags` junction table. A contact has many tags and a tag has many contacts, and neither row should store a list of the other. The composite primary key `(contact_id, tag_id)` makes a second assignment of the same pair impossible.

## Data model

| Table                | What it stores                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `contacts`           | `first_name`, `last_name`, `email`, `phone`, `company`, a version for each of those fields, and `overall_version` |
| `tags`               | Tag name                                                                                                          |
| `contact_tags`       | Which contacts have which tags. Primary key is `(contact_id, tag_id)`                                             |
| `contact_activities` | A text action for a contact, such as a field update or a tag change                                               |

```text
tags *── contact_tags ──* contacts ──1 contact_activities
```

## Concurrent updates

Versions are stored per field so an edit to `first_name` does not reject a simultaneous edit to `last_name`. One version for the whole row would treat those as a conflict.

A contact edit sends `expectedVersions` only for the fields in that request. One `UPDATE` changes those columns and increments their versions, and it only matches when each supplied version is still current.

Two edits to different fields on the same contact both succeed. Two edits to the same field with the same expected version produce one `200` and one `409`. A duplicate email or tag name also returns `409`, including when both requests arrive together. Assigning a tag that is already on the contact is ignored by `ON CONFLICT DO NOTHING`, so only the new link records an activity.

`Backend` tests cover different-field updates, same-field conflicts, duplicate emails, duplicate tag names, and duplicate tag assignment.

## Scale and AI usage

- [Scale considerations](SCALE.md) describes how I would change the system for larger data and traffic.
- [AI usage and reviewed decisions](AI_USAGE.md) explains how I used Cursor and records the suggestions I rejected or changed after review.

## Known limits

- There is no authentication or authorization.
- Frontend behavior is checked manually. Automated tests cover the backend concurrency cases.
- Tags can be created and assigned. They cannot be renamed or deleted for every contact at once.
- Activity rows store a plain action string.
- Narrow screens can scroll the contact table sideways.
