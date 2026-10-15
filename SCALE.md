# Scale considerations

## Millions of contacts per large account

I would add an `account_id` and index the fields used by account-level filters and sorting. If one database could no longer handle the data, I would partition or shard contacts by account. I would also cache commonly accessed contacts and filter results.

## Millions of contact updates per day

Since the API is stateless, I would run multiple API instances behind a load balancer and distribute requests between them. Writes would go to a database leader and be replicated asynchronously to followers. If one leader became the bottleneck, I would shard by account and place those shards with consistent hashing and virtual nodes, so one server does not receive most of the accounts. If a single account was still too busy, I would split that account's contacts further. The existing optimistic locking would continue to handle conflicting updates.

## Frequent searches and filters

I would add indexes for commonly filtered and sorted fields, and cache repeated queries. For text-based searches across millions of contacts, I would use Elasticsearch instead of making PostgreSQL scan the contact table.

## Many simultaneous users

I would use multiple API instances behind a load balancer and a database connection pool. Read replicas, indexes, and caching would handle most reads. Writes would go to the leader and be asynchronously replicated to followers. Optimistic locking would still protect simultaneous edits to the same fields.
