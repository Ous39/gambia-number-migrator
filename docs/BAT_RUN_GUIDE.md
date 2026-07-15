# Running the project with BAT files on Windows

Use these BAT files from the project root folder.

## First time only

Double-click:

```text
RUN_THIS_FIRST.bat
```

This installs dependencies, starts PostgreSQL with Docker, runs migrations, and seeds the admin user.

Admin login:

```text
admin / admin12345
```

## Normal daily run

Double-click:

```text
START_ALL.bat
```

It opens three windows:

- API on `http://localhost:8089/api/health`
- Admin on `http://localhost:5173`
- Mobile Expo on port `8082`

## Run only one part

```text
START_API.bat
START_ADMIN.bat
START_MOBILE.bat
```

## Phone testing

`START_MOBILE.bat` automatically detects your PC LAN IP and sets:

```text
EXPO_PUBLIC_API_BASE_URL=http://YOUR_PC_IP:8089/api
```

Your phone and PC must be on the same Wi-Fi or hotspot.

## If Expo port is busy

Double-click:

```text
FIX_PORTS.bat
```

Then run `START_MOBILE.bat` again.

## If normal QR does not work

Try:

```text
START_MOBILE_TUNNEL.bat
```

## Stop everything

Double-click:

```text
STOP_ALL.bat
```
