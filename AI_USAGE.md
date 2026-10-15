# AI usage and reviewed decisions

I defined the contact, tag, and activity fields. I used Cursor to turn that schema into TypeORM entities and an API, generate implementation drafts, investigate errors, write the high-risk tests, and refine the frontend and documentation. I reviewed the generated code and changed it when a suggestion did not match what I wanted.

## Decisions I changed

### Junction table

- Cursor suggested an explicit `ContactTag` entity with `created_at`.
- I said the relationship did not need that metadata and should be a normal junction table.
- Final decision: `@ManyToMany` and `@JoinTable`. `contact_tags` stores only `contact_id` and `tag_id`, and that pair is the primary key.

### Controller and service split

- Cursor put the first contact endpoint's logic in the route module.
- I asked for controllers and services instead of putting everything in routes.
- Final decision: routes map URLs to controllers. Services own the queries, transactions, and business rules.

### Field versions

- Cursor first treated optimistic locking as one version for the whole contact.
- I asked for each changed field to be checked against that field's version, with a conflict when the version is stale.
- Final decision: each editable field has its own version. Different fields can update together. A stale write to the same field returns `409`.

### Missing contact or tag during insert

- Cursor described a contact or tag deleted between the check and the insert as a data problem.
- I said the database already blocks the bad row. The problem was returning `500` for a missing contact or tag.
- Final decision: those foreign-key failures return `404`. Other database failures stay `500`.

### Delete button

- The first list had no delete control on the row.
- I asked for delete at the far right of the row, in a danger color.
- Final decision: each row ends with a danger button, a confirmation, and an error message if the delete fails.

### Add contact

- The first list had no way to create a contact.
- I asked where the add-contact button was.
- Final decision: the list has an Add contact form with validation, and it opens the new contact after save.

### Checkboxes

- Cursor applied one minimum width to every input, which stretched the checkboxes.
- I said the UI was rough and the checkboxes looked wrong.
- Final decision: checkboxes are left out of that width rule and use a compact size.

### Tests

- Cursor started toward broad tests for ordinary create, read, and update behavior.
- I asked for tests only on the risky cases, not the obvious ones.
- Final decision: the tests cover stale same-field writes, independent field writes, duplicate emails, duplicate tag names, and duplicate tag assignment.

### Sort controls

- Cursor used Sort and Order dropdowns above the table.
- I asked for Name and Created to sort when the column header is clicked.
- Final decision: those two headers sort on the server.

### Third click

- The first header behavior only switched between ascending and descending.
- I asked for the third click to reset the sort.
- Final decision: the cycle is ascending, descending, then reset.

### Scale write-up

- Cursor drafted a long architecture document for the scale questions.
- I said the prompt only asked for brief considerations, in first person.
- Final decision: `SCALE.md` is a short first-person answer for each question.

### Hot shard

- Cursor stopped the scaling answer at one leader per account shard.
- I said one shard can still get most of the traffic, and asked for consistent hashing with virtual nodes.
- Final decision: accounts are placed with consistent hashing and virtual nodes. One account that is still too busy is split further.

### Technical decisions in the README

- Cursor listed the decisions without saying why they were made.
- I said the list did not mean much without the reasons.
- Final decision: each decision in the README includes why it is there.

### Phone search

- Cursor first treated phone search as a query change only.
- I asked for a migration as part of that fix.
- Final decision: phone is part of search, and a migration adds trigram indexes for the searched text fields.

The suggestion I rejected was the extra `created_at` column on the contact-tag relationship. I had already defined the fields, and that column was not one of them.
