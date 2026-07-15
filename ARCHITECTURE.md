# Architecture

## System architecture

The project is a pnpm monorepo with three apps and one shared package.

- Mobile app scans and updates contacts locally using `expo-contacts`.
- API stores only migration rules, transition settings, app config, payments, and audit logs.
- Admin panel manages rules and settings.
- Shared package contains the rule engine and validation schemas used by all layers.

## Privacy model

Contacts never leave the user's device. The backend never receives contact names, phone books, or full contact lists. Backups and history are stored locally through AsyncStorage.

## Rule engine design

Rules support prefix, range, exact, and exception types. Detection uses active rules only, sorted by priority and specificity. Prefix rules use longest-prefix preference through specificity sorting. If no rule matches, the number is marked Manual Review.

## Transition mode design

During transition, Duplicate/Add Mode is recommended. Replace Mode remains available only as an advanced user decision and shows a warning.

## Duplicate/Add Mode

The app adds the rule-generated 9-digit number to the same contact while keeping the old number. It first checks the same contact to avoid adding the new number twice.

## Remove Old Duplicates

Cleanup only removes old numbers when a verified matching new number exists in the same contact. The matching pair must be verified by the rule engine.

## Payment flow

The mobile app creates a payment intent without contact data. The backend stores provider, reference, device ID, feature key, amount, currency, status, and non-sensitive metadata. Mock/manual mode can be confirmed in the admin panel.
