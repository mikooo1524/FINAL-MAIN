# FINAL - EventGear

Updated UI and Logic for EventGear.

An offline event-equipment rental app built with React Native, Expo SDK 57,
Expo Router / React Navigation, and SQLite. This completes the supplied
partial app for the CS15L functional project scope.

## Run in VS Code

Install Node.js **24 LTS**, extract this folder,
open it in VS Code, then run:

```bash
npm ci
npx expo start
```

Open with an Expo Go version supporting **SDK 57**, or build an Android APK.
Choose **Sign in as Administrator** and use username **EventGear Admin** and
password **EventGear2026**. This is a fixed project login; no administrator
registration is needed. Other accounts register as customers; an
administrator can use **⇄ Supplier** and **⇄ Admin** in the dashboard header to switch
between Supplier and Administrator views. Regular customers stay in the customer view.
The admin Users list and dashboard customer total include only non-demo customers.
First launch creates six starter equipment listings with bundled photos,
sample daily rates and stock quantities. No demo customer accounts are created.
Suppliers and administrators can edit these listings or add equipment.

On upgrade, registered administrator accounts and legacy demo accounts are
removed. Linked inventory and booking history transfer to an internal
**EventGear Business** supplier record. That record cannot be deleted; the fixed
administrator login is separate and does not create an administrator row in
`users` or `customer_credentials`.

Each new browser, private session or app installation receives the same starter
equipment and fixed administrator login. Customer accounts, bookings, photos and
inventory edits are saved in that browser/device's SQLite database and survive
normal reloads at the same browser address. They do not synchronize between
browsers or devices. Private browsing data is removed when its session ends;
clearing site data also removes that browser's database.

## Completed features

- **Customer:** registration, sign-in/sign-out, individual carts and rental history,
  dashboard, searchable categories, equipment details, stock-aware
  quantities, persistent cart, rental dates/contact/notes, availability,
  checkout, payment-method demo, booking confirmation, history/details,
  pending dates/contact/note edits, and cancellation with stock release.
- **Supplier:** dashboard, equipment CRUD, validation of rates and stock,
  booking review with contact/notes/details,
  and success/error confirmations.
- **Administrator:** overview, user-directory CRUD with registered customer details,
  last-administrator protection, booking status updates and rental-value reports.
- **UX:** custom EventGear logo, navy/teal branding, reusable components,
  accessible buttons, mobile/web dialogs, loading/error/empty states,
  pull-to-refresh and responsive layouts.

## Database and booking rules

SQLite `eventgear.db` stores users, equipment, reservations, reservation_items,
cart_items, customer_credentials, audit_log and app_settings. Passwords are salted
and hashed; they are never shown in Admin Users. No AsyncStorage-only storage is used.
Foreign keys preserve relationships; parameterized queries separate input
from SQL. Cart changes persist after initial hydration.

Dates must be real calendar dates starting today or later. Rental days are
inclusive: Oct 14-15 = 2 days. Pending/confirmed bookings reserve stock.
Availability counts peak concurrent bookings, rather than adding reservations
on different days. Confirmation rechecks stock, prices and input inside a
queued transaction, then saves booking/items, clears the persisted cart and
logs the action. Failure rolls back. Old receipts retain their booked rates.

Allowed changes: Pending → Confirmed/Cancelled; Confirmed → Completed/Cancelled.
Completed/cancelled bookings are final. Completion is allowed on/after the end
date. Pending dates/contact/notes are editable. Changing dates rechecks stock and
recalculates totals at the booked rates. To change items, cancel and make a new
booking. Cancellation releases stock.

Active bookings block equipment deletion. Listings with historical bookings
are archived to preserve receipts; unreferenced listings are physically
deleted, demonstrating SQL DELETE. Starter equipment is inserted once on startup
for an empty catalog. Existing inventory is preserved, and deleted starters are
not recreated.

**Payment is a demonstration:** it records an intended method, charges no
money, and never marks payment collected. Reports show rental value, not revenue.

## Structure and comments

- `app/`: Expo Router root stack and nested customer/supplier/admin tabs.
- `frontend/screens/`: customer, supplier, administrator and role selection screens.
- `frontend/components/`: shared UI, dialogs, icons and database startup/recovery UI.
- `frontend/context/`: shared application state and SQLite cart hydration/persistence.
- `frontend/navigation/`: navigation helpers used by the screens.
- `frontend/styles/`: shared theme, colors and styling constants.
- `frontend/utils/`: equipment photo and number formatting helpers.
- `backend/data/`: local SQLite schema, queries, transactions, audit log and web locking.
- `backend/services/`: password hashing and fixed administrator credentials.
- `assets/`: custom logo and supplied equipment photos.
- `docs/`: requirement map, presentation guide, actual screenshots and PDF.

Comments explain the major data, validation, state and navigation blocks.

The backend folder contains local application logic bundled with the app; it is
not a separate server. Expo Router discovers routes in the root `app/` folder.

## Checks

```bash
npm run lint -- --no-cache
npm run typecheck
npx expo export --platform android --output-dir dist-android
npx expo export --platform web --output-dir dist-web
```

Lint and compiler
configuration checks passed. `checkJs` is disabled, so the latter is not full
static type verification. Android Hermes and web exports passed.

The running Chromium app was tested at phone widths (including 320px) and
on desktop. The workflow checked cart persistence after reload, booking,
contact editing, supplier create/delete/status updates, administrator user
creation and reports, with no runtime errors. PNGs in `docs/screenshots` are
actual web-app captures. Native APK installation still needs testing on a phone.

## Optional web preview

Start Expo's web development server:

```bash
npm run web
```

Use the address printed by Expo. Use one tab at a time for the SQLite file.
Hosting an exported web build requires a secure context, cross-origin isolation
headers and SPA route fallback.

## APK submission

**No APK has been generated here.** This workspace has no configured Android
SDK/Gradle build toolchain or authenticated Expo project. The Android export
is a JavaScript bundle, **not an installable APK**.

`eas.json` contains an internal preview profile with `android.buildType: "apk"`,
following https://docs.expo.dev/build-reference/apk/ . On your computer run:

```bash
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform android --profile preview
```

Use your team's Expo account/project when prompted. Allow EAS to generate/manage
Android signing credentials. Download the resulting APK from its build page,
install on a real Android phone, and follow `docs/DEMO_GUIDE.md` before submitting.

Alternatively, install Android Studio and its SDK, run
`npx expo prebuild --platform android`, open the generated Android project,
and build a debug APK. In its `android` folder use `gradlew.bat assembleDebug`
on Windows or `./gradlew assembleDebug` on macOS/Linux. The usual output is
`android/app/build/outputs/apk/debug/app-debug.apk`. Keep signing secrets out of Git.

## Documentation and remaining submission steps

1. Add the **actual team member names**; they were not supplied. The PDF marks
   this field as awaiting team details.
2. Build/test the **installable APK**, as above.
3. Push this source to your team's **GitHub repository** and submit its real URL;
   no team repository URL/account was supplied.
4. Submit APK, repository link, and `docs/EventGear_Documentation.pdf` through
   Google Classroom.

The PDF contains title, description, major-screen screenshots, database
structure, stack, architecture, verification, run/build instructions and demo.
The detailed PDF mapping is in `docs/REQUIREMENTS_CHECKLIST.md`.

## Scope

This is a working local course app. Clearing/uninstalling app data removes
local records. There is no secure sign-in, hosted multi-device synchronization,
real payment gateway or push service; these are not required by the supplied
CS15L PDF. A production marketplace would need those separate services.
