const PANEL_ID = "yt-lyrics-mvp-panel";
const ACTIVE_CLASS = "yt-lyrics-mvp-line-active";
const EXTENSION_BUILD = "0.5.4";
const LYRICS_LIBRARY_PATH = "lyrics/index.json";
const AUTO_SCROLL_SPEED = 7;
const COLLAPSE_STORAGE_KEY = "ytLyricsMvpCollapsed";

let activeLineIndex = -1;
let currentVideo = null;
let currentLyrics = [];
let timeUpdateHandler = null;
let currentPath = window.location.pathname + window.location.search;
let routeCheckInterval = null;
let initRequestId = 0;
let lyricsLibraryCache = null;
let autoScrollFrameId = null;
let autoScrollLastTick = 0;
let currentMatchedVideoId = null;

function waitForVideo() {
  const observer = new MutationObserver(() => {
    handlePageState();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  if (!routeCheckInterval) {
    routeCheckInterval = window.setInterval(handleRouteChange, 500);
  }

  handlePageState();
}

async function initializeLyricsPanel(video) {
  const requestId = ++initRequestId;
  const previousVideo = currentVideo;
  const pageVideoId = getCurrentVideoId();
  currentVideo = video;
  currentMatchedVideoId = pageVideoId;
  activeLineIndex = -1;

  renderPanel({
    source: "manual",
    label: getCurrentVideoLabel(),
    lines: []
  });

  const lyricsData = await getLyricsForCurrentVideo();

  if (
    requestId !== initRequestId ||
    currentVideo !== video ||
    !isWatchPage() ||
    currentMatchedVideoId !== pageVideoId
  ) {
    return;
  }

  currentLyrics = lyricsData.lines;
  renderPanel(lyricsData);

  if (previousVideo && timeUpdateHandler) {
    previousVideo.removeEventListener("timeupdate", timeUpdateHandler);
  }

  timeUpdateHandler = () => {
    syncLyrics(video.currentTime);
  };

  video.addEventListener("timeupdate", timeUpdateHandler);
  syncLyrics(video.currentTime);
  startAutoScrollLoop();
}

function renderPanel(lyricsData) {
  const host = getPanelHost();
  if (!host) {
    return;
  }

  removePanel();

  const panel = document.createElement("aside");
  panel.id = PANEL_ID;
  panel.classList.toggle("yt-lyrics-mvp-panel-collapsed", isPanelCollapsed());

  const panelCollapsed = isPanelCollapsed();
  const hasLyrics = lyricsData.lines.length > 0;
  const songMeta = getPanelDisplayMeta(lyricsData, panelCollapsed);

  const header = document.createElement("div");
  header.className = "yt-lyrics-mvp-header";

  const collapseButton = document.createElement("button");
  collapseButton.type = "button";
  collapseButton.className = "yt-lyrics-mvp-toggle";
  collapseButton.setAttribute("aria-label", isPanelCollapsed() ? "Expand lyrics panel" : "Collapse lyrics panel");
  collapseButton.textContent = isPanelCollapsed() ? "+" : "—";
  collapseButton.addEventListener("click", () => {
    setPanelCollapsed(!isPanelCollapsed());
    renderPanel({
      source: lyricsData.source,
      label: lyricsData.label,
      lines: lyricsData.lines
    });
  });

  const title = document.createElement("h2");
  title.className = "yt-lyrics-mvp-title";
  title.textContent = songMeta.title;

  const artist = document.createElement("p");
  artist.className = "yt-lyrics-mvp-artist";
  artist.textContent = songMeta.artist;

  header.append(title, artist, collapseButton);

  const linesContainer = document.createElement("div");
  linesContainer.className = "yt-lyrics-mvp-lines";
  linesContainer.addEventListener("scroll", () => updatePanelScrollState(panel, linesContainer));

  if (lyricsData.lines.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "yt-lyrics-mvp-empty";
    emptyState.textContent = panelCollapsed
      ? "Lyrics coming soon"
      : "We are working on the lyrics for this song. Check back later. If you want to help build the library and add lyrics for the extension, DM me on IG @Atha4k.";
    linesContainer.appendChild(emptyState);
  } else {
    lyricsData.lines.forEach((line, index) => {
      const lineElement = document.createElement("p");
      lineElement.className = "yt-lyrics-mvp-line";
      lineElement.dataset.index = String(index);
      lineElement.textContent = line.text;

      if (typeof line.time !== "number") {
        lineElement.classList.add("yt-lyrics-mvp-line-unsynced");
      }

      linesContainer.appendChild(lineElement);
    });
  }

  panel.append(header, linesContainer);

  if (shouldUseFloatingHost(host)) {
    panel.classList.add("yt-lyrics-mvp-panel-floating");
    document.body.appendChild(panel);
  } else {
    host.prepend(panel);
  }

  updatePanelScrollState(panel, linesContainer);
}

function parseSongLabel(label) {
  if (typeof label !== "string" || !label.trim()) {
    return {
      title: "Lyrics",
      artist: "Unknown artist"
    };
  }

  const parts = label.split(" - ");
  if (parts.length >= 2) {
    return {
      artist: parts[0].trim(),
      title: parts.slice(1).join(" - ").trim()
    };
  }

  return {
    title: label.trim(),
    artist: "Manual library"
  };
}

function getPanelDisplayMeta(lyricsData, panelCollapsed) {
  if (lyricsData.lines.length === 0) {
    return {
      title: "Lyrics coming soon",
      artist: panelCollapsed ? "" : ""
    };
  }

  return parseSongLabel(lyricsData.label);
}

function isWatchPage() {
  return window.location.pathname === "/watch";
}

function removePanel() {
  const existingPanel = document.getElementById(PANEL_ID);
  if (existingPanel) {
    existingPanel.remove();
  }
}

function getPanelHost() {
  return (
    document.querySelector("#secondary-inner") ||
    document.querySelector("#secondary") ||
    document.querySelector("#related") ||
    document.body
  );
}

function shouldUseFloatingHost(host) {
  return host === document.body || host.id === "related";
}

function handlePageState() {
  if (!isWatchPage()) {
    teardownLyricsPanel();
    return;
  }

  const video = document.querySelector("video");
  const pageVideoId = getCurrentVideoId();
  if (!video) {
    return;
  }

  if (video === currentVideo && pageVideoId === currentMatchedVideoId) {
    return;
  }

  initializeLyricsPanel(video);
}

function handleRouteChange() {
  const nextPath = window.location.pathname + window.location.search;
  if (nextPath === currentPath) {
    return;
  }

  currentPath = nextPath;
  handlePageState();
}

function teardownLyricsPanel() {
  if (currentVideo && timeUpdateHandler) {
    currentVideo.removeEventListener("timeupdate", timeUpdateHandler);
  }

  stopAutoScrollLoop();
  currentVideo = null;
  currentMatchedVideoId = null;
  currentLyrics = [];
  activeLineIndex = -1;
  removePanel();
}

function syncLyrics(currentTime) {
  if (!currentLyrics.some((line) => typeof line.time === "number")) {
    return;
  }

  const panel = document.getElementById(PANEL_ID);
  if (!panel) {
    return;
  }

  const linesContainer = panel.querySelector(".yt-lyrics-mvp-lines");
  if (!linesContainer) {
    return;
  }

  const newActiveIndex = findActiveLineIndex(currentTime);

  if (newActiveIndex === activeLineIndex) {
    return;
  }

  const previousActiveLine = linesContainer.querySelector(`.${ACTIVE_CLASS}`);
  if (previousActiveLine) {
    previousActiveLine.classList.remove(ACTIVE_CLASS);
  }

  const nextActiveLine = linesContainer.querySelector(`[data-index="${newActiveIndex}"]`);
  if (nextActiveLine) {
    nextActiveLine.classList.add(ACTIVE_CLASS);
  }

  activeLineIndex = newActiveIndex;
}

function findActiveLineIndex(currentTime) {
  for (let index = currentLyrics.length - 1; index >= 0; index -= 1) {
    if (typeof currentLyrics[index].time !== "number") {
      continue;
    }

    if (currentTime >= currentLyrics[index].time) {
      return index;
    }
  }

  return -1;
}

function startAutoScrollLoop() {
  stopAutoScrollLoop();
  autoScrollLastTick = performance.now();
  autoScrollFrameId = window.requestAnimationFrame(runAutoScrollStep);
}

function stopAutoScrollLoop() {
  if (autoScrollFrameId) {
    window.cancelAnimationFrame(autoScrollFrameId);
    autoScrollFrameId = null;
  }
}

function runAutoScrollStep(timestamp) {
  const panel = document.getElementById(PANEL_ID);
  const linesContainer = panel?.querySelector(".yt-lyrics-mvp-lines");

  if (!panel || !linesContainer || !currentVideo) {
    autoScrollFrameId = window.requestAnimationFrame(runAutoScrollStep);
    return;
  }

  const deltaMs = timestamp - autoScrollLastTick;
  autoScrollLastTick = timestamp;

  if (!currentVideo.paused && !currentVideo.ended && !isAtScrollEnd(linesContainer)) {
    const nextScrollTop = Math.min(
      linesContainer.scrollTop + (AUTO_SCROLL_SPEED * deltaMs) / 1000,
      getMaxScrollTop(linesContainer)
    );

    linesContainer.scrollTop = nextScrollTop;
  }

  updatePanelScrollState(panel, linesContainer);
  autoScrollFrameId = window.requestAnimationFrame(runAutoScrollStep);
}

function updatePanelScrollState(panel, linesContainer) {
  panel.classList.toggle("yt-lyrics-mvp-panel-at-end", isAtScrollEnd(linesContainer));
}

function getMaxScrollTop(linesContainer) {
  return Math.max(0, linesContainer.scrollHeight - linesContainer.clientHeight);
}

function isAtScrollEnd(linesContainer) {
  return getMaxScrollTop(linesContainer) - linesContainer.scrollTop <= 6;
}

async function getLyricsForCurrentVideo() {
  const videoId = getCurrentVideoId();
  if (!videoId) {
    return emptyLyricsResponse(getCurrentVideoLabel());
  }

  const lyricsLibrary = await loadLyricsLibrary();

  for (const fileName of lyricsLibrary.files) {
    const lyricsFile = await loadLyricsFile(fileName);
    if (!lyricsFile || !matchesVideo(lyricsFile, videoId)) {
      continue;
    }

    return {
      source: "manual",
      label: lyricsFile.label || fileName,
      lines: Array.isArray(lyricsFile.lines)
        ? lyricsFile.lines
            .filter((line) => typeof line.text === "string")
            .map((line, index) => ({
              text: line.text,
              order: index,
              ...(typeof line.time === "number" ? { time: line.time } : {})
            }))
            .sort((left, right) => {
              const leftHasTime = typeof left.time === "number";
              const rightHasTime = typeof right.time === "number";

              if (leftHasTime && rightHasTime) {
                return left.time - right.time;
              }

              return left.order - right.order;
            })
            .map(({ order, ...line }) => line)
        : []
    };
  }

  return emptyLyricsResponse(getCurrentVideoLabel());
}

function getCurrentVideoId() {
  return new URL(window.location.href).searchParams.get("v");
}

function getCurrentVideoLabel() {
  const titleText =
    document.querySelector("ytd-watch-metadata h1")?.textContent?.trim() ||
    document.querySelector("meta[name='title']")?.getAttribute("content") ||
    "Lyrics";

  return titleText;
}

async function loadLyricsLibrary() {
  if (lyricsLibraryCache) {
    return lyricsLibraryCache;
  }

  const response = await fetch(chrome.runtime.getURL(LYRICS_LIBRARY_PATH));
  if (!response.ok) {
    throw new Error("Could not load lyrics library");
  }

  const libraryData = await response.json();
  lyricsLibraryCache = {
    files: Array.isArray(libraryData.files) ? libraryData.files : []
  };

  return lyricsLibraryCache;
}

async function loadLyricsFile(fileName) {
  const response = await fetch(chrome.runtime.getURL(`lyrics/${fileName}`));
  if (!response.ok) {
    return null;
  }

  return response.json();
}

function emptyLyricsResponse(label) {
  return {
    source: "manual",
    label,
    lines: []
  };
}

function matchesVideo(lyricsFile, currentVideoId) {
  const videoIds = Array.isArray(lyricsFile.videoIds) ? lyricsFile.videoIds : [];
  if (videoIds.includes(currentVideoId)) {
    return true;
  }

  const youtubeUrls = Array.isArray(lyricsFile.youtubeUrls) ? lyricsFile.youtubeUrls : [];
  return youtubeUrls.some((url) => extractVideoIdFromUrl(url) === currentVideoId);
}

function extractVideoIdFromUrl(url) {
  try {
    return new URL(url).searchParams.get("v");
  } catch (error) {
    return null;
  }
}

function isPanelCollapsed() {
  return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true";
}

function setPanelCollapsed(value) {
  window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(value));
}

waitForVideo();
