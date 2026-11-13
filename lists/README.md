# Predefined site lists

When the overlay is opened over an application that has no site list yet,
the app looks for a predefined list here and offers to use it. The folder
is packaged with the app (the JSON files only).

## `index.json`

Maps executables to list files:

```json
{
  "lists": [
    { "file": "star-citizen.json", "exe": ["starcitizen"] }
  ]
}
```

- `file`: name of the list file in this folder (letters, digits, `_`, `-`, ending in `.json`).
- `exe`: executable names that identify the game: lowercase, without the
  `.exe` extension (`StarCitizen.exe` → `starcitizen`). List every name
  the game may have, e.g. the Windows executable and the native Linux one.
  The overlay shows the detected executable on its Home.

## List file

```json
{
  "name": "Star Citizen",
  "sites": [
    { "url": "https://scmdb.net/" },
    { "url": "https://starcitizen.tools", "title": "Star Citizen Wiki" }
  ]
}
```

- `name`: name given to the list.
- `sites`: `http`/`https` addresses; `title` is optional (if missing,
  the page title is used).
