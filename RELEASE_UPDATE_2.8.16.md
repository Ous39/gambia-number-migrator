# GNM 2.8.16 — mobile scan and UI reliability update

## Mobile scan corrections

- Verified standalone 9-digit Gambian numbers now appear as **Already Updated**.
- A contact containing both the matching old and new number appears once as a verified duplicate pair instead of being double-counted.
- Unknown 9-digit numbers remain visible under **Needs Review** and are never selected for automatic modification.
- The saved scan remains available for normal navigation, while **Scan again for new or changed contacts** deliberately refreshes the phonebook after contacts change.
- Existing `+220`, `220`, `00220`, spaces, and punctuation normalization continues to work for both old and new formats.

## UI and safety improvements

- The dashboard scan actions now clearly separate viewing saved results from refreshing the phonebook.
- Preview rows show an explicit green current-format state for verified 9-digit numbers instead of displaying a misleading number-to-same-number arrow.
- Existing large-list batching, persistent operation progress, admin-controlled cleanup schedule, backup-first writes, Expo LAN startup, and Expo Go notification safeguards remain included.

## Verification completed

- TypeScript checks passed for Shared, Mobile, API, and Admin.
- 32 automated tests passed.
- Shared tests cover verified new numbers, duplicate-pair counting, unknown 9-digit safety, normalization, migration rules, cleanup, and a 100,000-contact workload.
- Expo production exports passed for Android, iOS, and Web.
- API and Admin production builds passed.
