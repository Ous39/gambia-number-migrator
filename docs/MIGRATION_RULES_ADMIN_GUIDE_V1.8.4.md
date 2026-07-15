# Migration Rules Admin Guide — v1.8.4

The mobile app scans only when at least one verified active rule has been published.

## Workflow

1. Open **Operators** and confirm each operator is active with its correct two-digit new prefix.
2. Open **Migration Rules** and create or edit rules using only approved official ranges.
3. Remove words such as `sample`, `demo` and `fallback` from the name and notes of publishable rules.
4. Set the rule to **Active**.
5. Test a representative old seven-digit number. Confirm `Matched safely`, the operator and the generated nine-digit number.
6. Repeat tests at every range boundary and for known exceptions.
7. Press **Publish Active Rules**.
8. On the phone, refresh the Dashboard and run Scan Contacts.

Draft changes never affect phones until published. Disabling a draft rule also requires publishing before phones receive the change.

Never use guessed ranges in production. Keep the source/approval reference in Notes without including the words reserved for non-production examples.
