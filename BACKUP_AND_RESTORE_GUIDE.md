# Backup and Restore Guide

GNM stores contact backups locally in verified chunks of 100 records. A backup is not added to the restorable index until all chunks can be read and the item count matches. Failed partial writes are removed.

Before updating contacts, create a fresh full backup and keep the app installed. Restore shows the selected backup and processes local contact snapshots. Test interruption, duplicates, insufficient storage, permission loss, and 10,000-contact behavior on each supported OS before release. App deletion or clearing storage can delete local backups.
