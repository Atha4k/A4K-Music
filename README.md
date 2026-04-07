# YouTube Lyrics MVP

This is a simple Chrome extension MVP that:

- injects a lyrics panel into YouTube pages
- syncs highlighted lines with the current video time
- loads manual lyrics from separate JSON files per video
- uses text-first lyric files, with optional timestamps later
- supports a slow reading-mode auto-scroll for full lyrics
- uses a simplified reading card without footer controls
- includes a collapsible bar mode for when you want to hide the panel
- refreshes lyrics correctly when you switch to another YouTube video
- shows a contributor-friendly "lyrics coming soon" state for songs not in the library yet

## Files

- `manifest.json`: tells Chrome how to load the extension
- `content.js`: injects the sidebar and loads lyric files by video ID
- `styles.css`: styles the sidebar
- `lyrics/index.json`: lists all lyric files in the project
- `lyrics/*.json`: one lyric file per song, including its own YouTube links and video IDs

## How to test

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Turn on `Developer mode`.
4. Click `Load unpacked`.
5. Select this folder:
   `/Users/atahankasapcopur/Documents/Playground/A4K-Music`
6. Open any YouTube video page.
7. You should see the lyrics panel on the right side.

## How to add manual lyrics for a video

1. Create a new JSON file in the `lyrics` folder.
2. Put the `videoIds` and `youtubeUrls` directly in that song file.
3. Add the file name to `lyrics/index.json`.

Example `lyrics/index.json` entry:

```json
"rick-astley-never-gonna-give-you-up.json"
```

Example lyric file:

```json
{
  "label": "Rick Astley - Never Gonna Give You Up",
  "videoIds": ["dQw4w9WgXcQ"],
  "youtubeUrls": [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  ],
  "lines": [
    { "time": 0, "text": "We're no strangers to love" },
    { "time": 7, "text": "You know the rules and so do I" }
  ]
}
```

Current example files:

- `lyrics/drake-when-to-say-when.json`
- `lyrics/dave-raindance.json`

The video ID is the value after `v=` in the YouTube URL.

Example:

```txt
https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

The video ID is:

```txt
dQw4w9WgXcQ
```

## What to build next

- build a small lyric editor instead of editing JSON by hand
- support multiple video IDs for the same song
- add title-based fallback matching
- add import/export for lyric files
