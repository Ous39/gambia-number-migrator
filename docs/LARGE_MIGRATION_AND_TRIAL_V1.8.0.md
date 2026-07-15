# Large Migration and Secure Trial — v1.8.0

## Access model

- Scanning and preview are free and unlimited.
- A new device can apply up to 10 Add & Keep Old updates.
- Trial use is counted atomically by the server against a privacy-safe device reference.
- Replace and Cleanup require server-confirmed active payment status.
- Contact names and phone numbers are never sent to the entitlement API.

## Large migrations

Add and Replace operations write contacts sequentially because mobile contact stores are not transaction-safe under parallel writes. Each change is re-read and verified. Job state is checkpointed every 25 processed records, and re-running the same selection resumes completed work without intentionally applying it twice.

Backups are stored locally in verified chunks of 100 records. Preview uses a virtualized list. Scan processing yields to the UI every 50 contacts.

## Operational guidance

- Keep the app open for very large jobs.
- Start with Add & Keep Old mode.
- Test on low-cost Android hardware with 1,000, 5,000 and 10,000 synthetic contacts before store release.
- Record scan, backup and write duration from migration history.
- Do not advertise a guaranteed completion time because mobile contact providers and device performance vary.
