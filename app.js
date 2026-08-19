const defaultWords = [
  { id: "apple", english: "apple", korean: "사과", pronunciation: "애플", category: "nature", image: "assets/words/apple.jpg" },
  { id: "cat", english: "cat", korean: "고양이", pronunciation: "캣", category: "animals", image: "assets/words/cat.jpg" },
  { id: "dog", english: "dog", korean: "강아지", pronunciation: "도그", category: "animals", image: "assets/words/dog.jpg" },
  { id: "sun", english: "sun", korean: "해", pronunciation: "썬", category: "nature", image: "assets/words/sun.jpg" },
  { id: "moon", english: "moon", korean: "달", pronunciation: "문", category: "nature", image: "assets/words/moon.jpg" },
  { id: "book", english: "book", korean: "책", pronunciation: "북", category: "things", image: "assets/words/book.jpg" },
  { id: "ball", english: "ball", korean: "공", pronunciation: "볼", category: "things", image: "assets/words/ball.jpg" },
  { id: "fish", english: "fish", korean: "물고기", pronunciation: "피시", category: "animals", image: "assets/words/fish.jpg" },
  { id: "car", english: "car", korean: "자동차", pronunciation: "카", category: "things", image: "assets/words/car.jpg" },
  { id: "tree", english: "tree", korean: "나무", pronunciation: "트리", category: "nature", image: "assets/words/tree.jpg" },
];

const storageKeys = {
  customWords: "kongkong-custom-words-v1",
  defaultOverrides: "kongkong-default-overrides-v1",
  deletedDefaultIds: "kongkong-deleted-default-ids-v1",
  learned: "kongkong-learned-words-v1",
  wrongWords: "kongkong-wrong-words-v1",
  dailyPlans: "kongkong-daily-plans-v1",
  dailyCompleted: "kongkong-daily-completed-v1",
  syncCode: "kongkong-sync-code-v1",
  syncUpdatedAt: "kongkong-sync-updated-at-v1",
};

const speakerIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M11 5 6.5 9H3v6h3.5l4.5 4V5ZM15 9.5c.8.7 1.2 1.5 1.2 2.5s-.4 1.8-1.2 2.5M17.8 6.8c1.6 1.4 2.4 3.1 2.4 5.2s-.8 3.8-2.4 5.2"/>
  </svg>`;

const elements = {
  learnedCount: document.querySelector("#learnedCount"),
  wordCount: document.querySelector("#wordCount"),
  dailyGoalText: document.querySelector("#dailyGoalText"),
  dailyProgressBar: document.querySelector("#dailyProgressBar"),
  startDailyButton: document.querySelector("#startDailyButton"),
  cardGrid: document.querySelector("#cardGrid"),
  emptyState: document.querySelector("#emptyState"),
  cardsTab: document.querySelector("#cardsTab"),
  quizTab: document.querySelector("#quizTab"),
  reviewTab: document.querySelector("#reviewTab"),
  wrongCount: document.querySelector("#wrongCount"),
  cardsPanel: document.querySelector("#cardsPanel"),
  quizPanel: document.querySelector("#quizPanel"),
  reviewPanel: document.querySelector("#reviewPanel"),
  quizShell: document.querySelector("#quizShell"),
  reviewShell: document.querySelector("#reviewShell"),
  categoryFilter: document.querySelector("#categoryFilter"),
  studyDialog: document.querySelector("#studyDialog"),
  studyImage: document.querySelector("#studyImage"),
  studyWord: document.querySelector("#studyWord"),
  studyMeaning: document.querySelector("#studyMeaning"),
  studyPronunciation: document.querySelector("#studyPronunciation"),
  studySpeakButton: document.querySelector("#studySpeakButton"),
  learnButton: document.querySelector("#learnButton"),
  editWordButton: document.querySelector("#editWordButton"),
  deleteWordButton: document.querySelector("#deleteWordButton"),
  customBadge: document.querySelector("#customBadge"),
  previousWordButton: document.querySelector("#previousWordButton"),
  nextWordButton: document.querySelector("#nextWordButton"),
  studyDots: document.querySelector("#studyDots"),
  addDialog: document.querySelector("#addDialog"),
  addTitle: document.querySelector("#addTitle"),
  formModeLabel: document.querySelector("#formModeLabel"),
  formSubmitButton: document.querySelector("#formSubmitButton"),
  openAddButton: document.querySelector("#openAddButton"),
  openSyncButton: document.querySelector("#openSyncButton"),
  syncDot: document.querySelector("#syncDot"),
  syncDialog: document.querySelector("#syncDialog"),
  syncCodeDisplay: document.querySelector("#syncCodeDisplay"),
  copySyncCodeButton: document.querySelector("#copySyncCodeButton"),
  syncCodeInput: document.querySelector("#syncCodeInput"),
  connectSyncCodeButton: document.querySelector("#connectSyncCodeButton"),
  syncNowButton: document.querySelector("#syncNowButton"),
  syncStatusIcon: document.querySelector("#syncStatusIcon"),
  syncStatusTitle: document.querySelector("#syncStatusTitle"),
  syncStatusMessage: document.querySelector("#syncStatusMessage"),
  syncError: document.querySelector("#syncError"),
  addWordForm: document.querySelector("#addWordForm"),
  englishInput: document.querySelector("#englishInput"),
  koreanInput: document.querySelector("#koreanInput"),
  pronunciationInput: document.querySelector("#pronunciationInput"),
  imageInput: document.querySelector("#imageInput"),
  imagePreview: document.querySelector("#imagePreview"),
  uploadPlaceholder: document.querySelector("#uploadPlaceholder"),
  formError: document.querySelector("#formError"),
  toast: document.querySelector("#toast"),
};

let customWords = readStorage(storageKeys.customWords, []);
let defaultOverrides = readStorage(storageKeys.defaultOverrides, {});
let deletedDefaultIds = new Set(readStorage(storageKeys.deletedDefaultIds, []));
let learnedWords = new Set(readStorage(storageKeys.learned, []));
let wrongWords = new Set(readStorage(storageKeys.wrongWords, []));
let dailyPlans = readStorage(storageKeys.dailyPlans, {});
let dailyCompleted = readStorage(storageKeys.dailyCompleted, {});
let syncCode = String(readStorage(storageKeys.syncCode, "")).trim().toUpperCase();
let localStateUpdatedAt = Number(readStorage(storageKeys.syncUpdatedAt, Date.now()));
let activeSort = "oldest";
let activeMode = "cards";
let activeStudyIndex = 0;
let selectedImage = "";
let editingWordId = null;
let meaningLookupInProgress = false;
let meaningLookupTimer;
let toastTimer;
let quiz = null;
let cloudSyncEnabled = false;
let cloudSyncHydrating = false;
let cloudSyncTimer;
let cloudSyncPromise = null;
let localCloudDirty = false;
let cloudSyncQueued = false;
let localChangeVersion = 0;

if (!/^[A-Z2-9]{12}$/.test(syncCode)) {
  syncCode = createSyncCode();
  localStorage.setItem(storageKeys.syncCode, JSON.stringify(syncCode));
}

const isAndroidApp = Boolean(window.AndroidApp) || (
  ["localhost", "127.0.0.1"].includes(window.location.hostname)
  && new URLSearchParams(window.location.search).has("android-preview")
);

if (isAndroidApp) {
  document.body.classList.add("is-android-app");
  document.querySelector("#apkDownload")?.setAttribute("hidden", "");
}

function readStorage(key, fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    return saved ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    if (cloudSyncEnabled && !cloudSyncHydrating && ![storageKeys.syncCode, storageKeys.syncUpdatedAt].includes(key)) {
      localStateUpdatedAt = Date.now();
      localCloudDirty = true;
      localChangeVersion += 1;
      localStorage.setItem(storageKeys.syncUpdatedAt, JSON.stringify(localStateUpdatedAt));
      scheduleCloudSync();
    }
    return true;
  } catch {
    showToast("저장 공간이 부족해요. 오래된 직접 등록 카드를 정리해 주세요.");
    return false;
  }
}

function createSyncCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint32Array(12);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}

function getSyncApiUrl() {
  const base = window.location.protocol === "file:" ? "https://english.gomdol.net" : "";
  return `${base}/api/state`;
}

function serializeCloudState() {
  return {
    schemaVersion: 1,
    updatedAt: new Date(localStateUpdatedAt).toISOString(),
    customWords,
    defaultOverrides,
    deletedDefaultIds: [...deletedDefaultIds],
    learnedWords: [...learnedWords],
    wrongWords: [...wrongWords],
    dailyPlans,
    dailyCompleted,
  };
}

function isValidCloudState(state) {
  if (!state || typeof state !== "object") return false;
  return Array.isArray(state.customWords)
    && state.defaultOverrides && typeof state.defaultOverrides === "object"
    && Array.isArray(state.deletedDefaultIds)
    && Array.isArray(state.learnedWords)
    && Array.isArray(state.wrongWords)
    && state.dailyPlans && typeof state.dailyPlans === "object"
    && state.dailyCompleted && typeof state.dailyCompleted === "object";
}

function applyCloudState(state) {
  if (!isValidCloudState(state)) return false;
  cloudSyncHydrating = true;
  customWords = state.customWords;
  defaultOverrides = state.defaultOverrides;
  deletedDefaultIds = new Set(state.deletedDefaultIds);
  learnedWords = new Set(state.learnedWords);
  wrongWords = new Set(state.wrongWords);
  dailyPlans = state.dailyPlans;
  dailyCompleted = state.dailyCompleted;
  localStateUpdatedAt = Number.isFinite(Date.parse(state.updatedAt)) ? Date.parse(state.updatedAt) : Date.now();

  localStorage.setItem(storageKeys.customWords, JSON.stringify(customWords));
  localStorage.setItem(storageKeys.defaultOverrides, JSON.stringify(defaultOverrides));
  localStorage.setItem(storageKeys.deletedDefaultIds, JSON.stringify([...deletedDefaultIds]));
  localStorage.setItem(storageKeys.learned, JSON.stringify([...learnedWords]));
  localStorage.setItem(storageKeys.wrongWords, JSON.stringify([...wrongWords]));
  localStorage.setItem(storageKeys.dailyPlans, JSON.stringify(dailyPlans));
  localStorage.setItem(storageKeys.dailyCompleted, JSON.stringify(dailyCompleted));
  localStorage.setItem(storageKeys.syncUpdatedAt, JSON.stringify(localStateUpdatedAt));
  renderCards();
  if (activeMode === "review") renderReviewPanel();
  cloudSyncHydrating = false;
  localCloudDirty = false;
  return true;
}

function setSyncStatus(state, title, message) {
  elements.openSyncButton.dataset.state = state;
  elements.syncStatusTitle.textContent = title;
  elements.syncStatusMessage.textContent = message;
  const icons = { idle: "●", pending: "○", syncing: "↻", synced: "✓", offline: "!", error: "!" };
  elements.syncStatusIcon.textContent = icons[state] || "●";
}

function scheduleCloudSync() {
  if (!cloudSyncEnabled || cloudSyncHydrating) return;
  clearTimeout(cloudSyncTimer);
  setSyncStatus("pending", "저장 대기 중", "변경사항을 곧 서버에 저장해요.");
  cloudSyncTimer = setTimeout(() => syncWithCloud(), 900);
}

async function syncWithCloud({ preferRemote = false, announce = false } = {}) {
  if (cloudSyncPromise) {
    cloudSyncQueued = true;
    return cloudSyncPromise;
  }
  if (!navigator.onLine) {
    setSyncStatus("offline", "오프라인", "기기에 저장했고 온라인이 되면 다시 동기화해요.");
    return null;
  }

  const changeVersionAtStart = localChangeVersion;
  cloudSyncPromise = (async () => {
    setSyncStatus("syncing", "동기화 중", "서버 데이터와 안전하게 맞추고 있어요.");
    elements.syncError.textContent = "";
    const headers = { "X-Sync-Key": syncCode };
    const remoteResponse = await fetch(getSyncApiUrl(), { headers, cache: "no-store" });
    if (!remoteResponse.ok) throw new Error(`동기화 조회 실패 (${remoteResponse.status})`);
    const remotePayload = await remoteResponse.json();
    const localState = serializeCloudState();
    let chosenState = localState;

    if (isValidCloudState(remotePayload.state)) {
      const remoteTime = Date.parse(remotePayload.state.updatedAt || 0) || 0;
      const localTime = Date.parse(localState.updatedAt || 0) || 0;
      if (preferRemote && localChangeVersion === changeVersionAtStart) {
        chosenState = remotePayload.state;
        applyCloudState(chosenState);
      } else if (localCloudDirty) {
        chosenState = localState;
      } else if (remoteTime > localTime) {
        chosenState = remotePayload.state;
        applyCloudState(chosenState);
      }
    }

    const saveResponse = await fetch(getSyncApiUrl(), {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ state: chosenState }),
    });
    if (!saveResponse.ok) throw new Error(`동기화 저장 실패 (${saveResponse.status})`);
    const saveResult = await saveResponse.json();
    if (localChangeVersion === changeVersionAtStart) localCloudDirty = false;
    else cloudSyncQueued = true;
    setSyncStatus("synced", "동기화 완료", `${new Date(saveResult.updatedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}에 서버에 저장했어요.`);
    if (announce) showToast("클라우드 동기화를 완료했어요!");
    return saveResult;
  })()
    .catch((error) => {
      setSyncStatus("error", "동기화 실패", "기기에는 안전하게 저장됐어요. 잠시 후 다시 시도해요.");
      elements.syncError.textContent = error.message;
      if (announce) showToast("서버 동기화에 실패했어요. 기기 저장은 유지돼요.");
      return null;
    })
    .finally(() => {
      cloudSyncPromise = null;
      if (cloudSyncQueued || localCloudDirty) {
        cloudSyncQueued = false;
        scheduleCloudSync();
      }
    });

  return cloudSyncPromise;
}

function openSyncDialog() {
  elements.syncCodeDisplay.textContent = syncCode;
  elements.syncCodeInput.value = "";
  elements.syncError.textContent = "";
  elements.syncDialog.showModal();
}

async function copySyncCode() {
  try {
    await navigator.clipboard.writeText(syncCode);
    showToast("동기화 코드를 복사했어요.");
  } catch {
    elements.syncError.textContent = `코드를 길게 눌러 복사해 주세요: ${syncCode}`;
  }
}

async function connectSyncCode() {
  const nextCode = elements.syncCodeInput.value.toUpperCase().replace(/[^A-Z2-9]/g, "");
  if (!/^[A-Z2-9]{12}$/.test(nextCode)) {
    elements.syncError.textContent = "영문 대문자와 숫자로 된 12자리 코드를 입력해 주세요.";
    return;
  }
  syncCode = nextCode;
  localStorage.setItem(storageKeys.syncCode, JSON.stringify(syncCode));
  elements.syncCodeDisplay.textContent = syncCode;
  elements.syncCodeInput.value = "";
  await syncWithCloud({ preferRemote: true, announce: true });
}

async function initializeCloudSync() {
  elements.syncCodeDisplay.textContent = syncCode;
  cloudSyncEnabled = true;
  await syncWithCloud();
}

function getAllWords() {
  const builtInWords = defaultWords
    .filter((word) => !deletedDefaultIds.has(word.id))
    .map((word) => ({
      ...word,
      ...(defaultOverrides[word.id] || {}),
      id: word.id,
      custom: false,
      builtIn: true,
    }));
  return [...builtInWords, ...customWords];
}

function getTodayKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hashString(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededShuffle(items, seed) {
  const result = [...items];
  let state = seed || 1;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function getDailyWords() {
  const allWords = getAllWords();
  const allIds = new Set(allWords.map((word) => word.id));
  const today = getTodayKey();
  const targetCount = Math.min(10, allWords.length);
  let plan = Array.isArray(dailyPlans[today]) ? dailyPlans[today].filter((id) => allIds.has(id)) : [];

  if (plan.length < targetCount) {
    const candidates = seededShuffle(
      allWords.filter((word) => !plan.includes(word.id)),
      hashString(`${today}:${allWords.map((word) => word.id).join("|")}`),
    );
    plan = [...plan, ...candidates.slice(0, targetCount - plan.length).map((word) => word.id)];
    dailyPlans[today] = plan;
    trimDailyHistory(dailyPlans);
    writeStorage(storageKeys.dailyPlans, dailyPlans);
  }

  return plan.map((id) => allWords.find((word) => word.id === id)).filter(Boolean);
}

function trimDailyHistory(store) {
  const keys = Object.keys(store).sort().reverse();
  keys.slice(31).forEach((key) => delete store[key]);
}

function getTodayCompletedSet() {
  return new Set(Array.isArray(dailyCompleted[getTodayKey()]) ? dailyCompleted[getTodayKey()] : []);
}

function saveTodayCompleted(completedSet) {
  dailyCompleted[getTodayKey()] = [...completedSet];
  trimDailyHistory(dailyCompleted);
  writeStorage(storageKeys.dailyCompleted, dailyCompleted);
}

function registrationValue(word) {
  const defaultIndex = defaultWords.findIndex((item) => item.id === word.id);
  if (defaultIndex >= 0) return defaultIndex;
  if (Number.isFinite(word.createdAt)) return word.createdAt;
  const idTimestamp = Number(String(word.id).replace("custom-", ""));
  return Number.isFinite(idTimestamp) ? idTimestamp : Date.now();
}

function getVisibleWords() {
  const words = getAllWords();
  if (activeSort === "daily") return getDailyWords();
  if (activeSort === "alphabetical") {
    return [...words].sort((a, b) => a.english.localeCompare(b.english, "en"));
  }
  if (activeSort === "newest") {
    return [...words].sort((a, b) => registrationValue(b) - registrationValue(a));
  }
  return [...words].sort((a, b) => registrationValue(a) - registrationValue(b));
}

function escapeHtml(value) {
  const node = document.createElement("span");
  node.textContent = value;
  return node.innerHTML;
}

function renderCards() {
  const allWords = getAllWords();
  const words = getVisibleWords();
  elements.wordCount.textContent = allWords.length;
  elements.learnedCount.textContent = [...learnedWords].filter((id) => allWords.some((word) => word.id === id)).length;
  elements.emptyState.hidden = words.length !== 0;
  elements.cardGrid.innerHTML = words
    .map(
      (word) => `
        <button class="word-card" type="button" data-word-id="${word.id}" aria-label="${escapeHtml(word.english)}, ${escapeHtml(word.korean)} 카드 열기">
          <span class="card-image">
            <img src="${word.image}" alt="${escapeHtml(word.korean)} 그림" loading="lazy" />
            ${word.custom ? '<span class="mine-badge">MY</span>' : ""}
            ${learnedWords.has(word.id) ? '<span class="learned-badge" aria-label="배운 단어">★</span>' : ""}
          </span>
          <span class="card-copy">
            <span>
              <strong>${escapeHtml(word.english)}</strong>
              <small>${escapeHtml(word.korean)}</small>
            </span>
            <span class="mini-speaker" aria-hidden="true">${speakerIcon}</span>
          </span>
        </button>`,
    )
    .join("");
  renderDailyGoal();
  renderWrongCount();
}

function renderDailyGoal() {
  const dailyWords = getDailyWords();
  const dailyIds = new Set(dailyWords.map((word) => word.id));
  const completed = [...getTodayCompletedSet()].filter((id) => dailyIds.has(id)).length;
  const total = dailyWords.length;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  elements.dailyGoalText.textContent = `${total}단어 중 ${completed}개 완료`;
  elements.dailyProgressBar.style.width = `${percent}%`;
  elements.startDailyButton.textContent = completed === total && total > 0 ? "오늘 목표 완료!" : "오늘의 10개 보기";
}

function renderWrongCount() {
  const validIds = new Set(getAllWords().map((word) => word.id));
  wrongWords = new Set([...wrongWords].filter((id) => validIds.has(id)));
  elements.wrongCount.textContent = wrongWords.size;
  writeStorage(storageKeys.wrongWords, [...wrongWords]);
}

function startDailyStudy() {
  activeSort = "daily";
  syncSortButtons();
  setMode("cards");
  renderCards();
  document.querySelector(".learning-board").scrollIntoView({ behavior: "smooth", block: "start" });
  showToast("오늘의 추천 10단어를 모았어요!");
}

function openStudy(wordId) {
  const words = getVisibleWords();
  activeStudyIndex = Math.max(0, words.findIndex((word) => word.id === wordId));
  updateStudyDialog();
  elements.studyDialog.showModal();
}

function getCurrentStudyWord() {
  return getVisibleWords()[activeStudyIndex];
}

function updateStudyDialog() {
  const words = getVisibleWords();
  const word = words[activeStudyIndex];
  if (!word) return;

  elements.studyImage.src = word.image;
  elements.studyImage.alt = `${word.korean} 그림`;
  elements.studyWord.textContent = word.english;
  elements.studyMeaning.textContent = word.korean;
  elements.studyPronunciation.textContent = word.pronunciation || "천천히 듣고 따라 해요";
  elements.customBadge.hidden = !word.custom;
  elements.editWordButton.hidden = false;
  elements.deleteWordButton.hidden = false;

  const isLearned = learnedWords.has(word.id);
  elements.learnButton.classList.toggle("is-learned", isLearned);
  elements.learnButton.innerHTML = isLearned
    ? '<span aria-hidden="true">★</span> 잘했어요! 배운 단어예요'
    : '<span aria-hidden="true">☆</span> 이 단어 배웠어요';

  elements.previousWordButton.disabled = words.length < 2;
  elements.nextWordButton.disabled = words.length < 2;
  elements.studyDots.innerHTML = words
    .map((_, index) => `<span class="${index === activeStudyIndex ? "is-active" : ""}"></span>`)
    .join("");
}

function moveStudy(direction) {
  const words = getVisibleWords();
  if (words.length < 2) return;
  activeStudyIndex = (activeStudyIndex + direction + words.length) % words.length;
  updateStudyDialog();
}

function speak(text) {
  if (window.AndroidApp && typeof window.AndroidApp.speak === "function") {
    try {
      if (window.AndroidApp.speak(text)) return;
    } catch {
      // Browser speech remains available when the native bridge is unavailable.
    }
  }

  if (!("speechSynthesis" in window)) {
    showToast("이 브라우저에서는 음성 듣기를 지원하지 않아요.");
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.78;
  utterance.pitch = 1.04;
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find((voice) => voice.lang === "en-US" && /Samantha|Ava|Google US English/i.test(voice.name));
  if (preferredVoice) utterance.voice = preferredVoice;
  window.speechSynthesis.speak(utterance);
}

function toggleLearned() {
  const word = getCurrentStudyWord();
  if (!word) return;
  const todayIds = new Set(getDailyWords().map((item) => item.id));
  const completedToday = getTodayCompletedSet();

  if (learnedWords.has(word.id)) {
    learnedWords.delete(word.id);
    completedToday.delete(word.id);
    showToast("배운 단어에서 뺐어요.");
  } else {
    learnedWords.add(word.id);
    if (todayIds.has(word.id)) completedToday.add(word.id);
    showToast("참 잘했어요! 오늘 목표에 기록했어요 ★");
  }

  writeStorage(storageKeys.learned, [...learnedWords]);
  saveTodayCompleted(completedToday);
  updateStudyDialog();
  renderCards();
}

function resetWordForm() {
  elements.addWordForm.reset();
  selectedImage = "";
  elements.imagePreview.src = "";
  elements.imagePreview.hidden = true;
  elements.uploadPlaceholder.hidden = false;
  elements.formError.textContent = "";
}

function openAddDialog(word = null) {
  resetWordForm();
  editingWordId = word?.id || null;

  if (word) {
    elements.formModeLabel.textContent = "EDIT WORD CARD";
    elements.addTitle.textContent = "낱말카드를 수정해요";
    elements.formSubmitButton.textContent = "수정 내용 저장하기";
    elements.englishInput.value = word.english;
    elements.koreanInput.value = word.korean;
    elements.pronunciationInput.value = word.pronunciation || "";
    selectedImage = word.image;
    elements.imagePreview.src = word.image;
    elements.imagePreview.hidden = false;
    elements.uploadPlaceholder.hidden = true;
  } else {
    elements.formModeLabel.textContent = "MY WORD CARD";
    elements.addTitle.textContent = "새 단어를 등록해요";
    elements.formSubmitButton.textContent = "낱말카드 만들기";
  }

  elements.addDialog.showModal();
  requestAnimationFrame(() => elements.englishInput.focus());
}

function openEditCurrentWord() {
  const word = getCurrentStudyWord();
  if (!word) return;
  elements.studyDialog.close();
  openAddDialog(word);
}

async function translateEnglishWord(english, signal) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(english)}&langpair=en%7Cko`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Translation HTTP ${response.status}`);
  const result = await response.json();
  const meaning = String(result?.responseData?.translatedText || "").trim();
  if (!meaning || meaning.toLowerCase() === english.toLowerCase()) throw new Error("No translation");
  return meaning;
}

async function fillMeaningFromEnglish() {
  if (meaningLookupInProgress) return;
  const english = elements.englishInput.value.trim().toLowerCase();
  if (!/^[a-zA-Z][a-zA-Z -]*$/.test(english)) {
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  meaningLookupInProgress = true;
  elements.formError.textContent = "";
  try {
    const meaning = await translateEnglishWord(english, controller.signal);
    if (elements.englishInput.value.trim().toLowerCase() === english) {
      elements.koreanInput.value = meaning;
      showToast(`“${english}” 뜻을 자동으로 입력했어요.`);
    }
  } catch {
    elements.formError.textContent = "한글 뜻을 자동으로 찾지 못했어요. 직접 입력해 주세요.";
  } finally {
    clearTimeout(timeout);
    meaningLookupInProgress = false;
  }
}

async function prepareImage(file) {
  const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
  if (!allowedTypes.includes(file.type)) throw new Error("JPG, PNG, WEBP 그림만 사용할 수 있어요.");
  if (file.size > 12 * 1024 * 1024) throw new Error("그림 파일은 12MB보다 작아야 해요.");

  const source = await fileToDataUrl(file);
  const image = await loadImage(source);
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  const maxSize = 720;
  const scale = Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sourceWidth * scale);
  canvas.height = Math.round(sourceHeight * scale);
  const context = canvas.getContext("2d");
  context.fillStyle = "#fffdf7";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("그림을 불러오지 못했어요."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("그림을 불러오지 못했어요."));
    image.src = src;
  });
}

async function handleImageSelection(event) {
  const [file] = event.target.files;
  if (!file) return;
  elements.formError.textContent = "";
  try {
    selectedImage = await prepareImage(file);
    elements.imagePreview.src = selectedImage;
    elements.imagePreview.hidden = false;
    elements.uploadPlaceholder.hidden = true;
  } catch (error) {
    selectedImage = "";
    elements.imageInput.value = "";
    elements.formError.textContent = error.message;
  }
}

function saveWord(event) {
  event.preventDefault();
  const form = new FormData(elements.addWordForm);
  const english = String(form.get("english") || "").trim().toLowerCase();
  const korean = String(form.get("korean") || "").trim();
  const pronunciation = String(form.get("pronunciation") || "").trim();
  const editingWord = editingWordId ? getAllWords().find((word) => word.id === editingWordId) : null;
  const category = editingWord?.category || "words";

  if (!/^[a-zA-Z][a-zA-Z -]*$/.test(english)) {
    elements.formError.textContent = "영어 단어는 알파벳으로 적어 주세요.";
    return;
  }
  if (!korean) {
    elements.formError.textContent = "한글 뜻을 적거나 자동 생성을 눌러 주세요.";
    return;
  }
  if (!selectedImage) {
    elements.formError.textContent = "단어와 어울리는 그림을 직접 골라 주세요.";
    return;
  }
  if (getAllWords().some((word) => word.id !== editingWordId && word.english.toLowerCase() === english)) {
    elements.formError.textContent = "이미 등록된 영어 단어예요.";
    return;
  }

  if (editingWordId) {
    const builtIn = defaultWords.some((word) => word.id === editingWordId);
    if (builtIn) {
      defaultOverrides[editingWordId] = {
        english,
        korean,
        pronunciation,
        category,
        image: selectedImage,
        updatedAt: Date.now(),
      };
      if (!writeStorage(storageKeys.defaultOverrides, defaultOverrides)) return;
    } else {
      const previous = customWords.find((word) => word.id === editingWordId);
      const updated = {
        ...previous,
        english,
        korean,
        pronunciation,
        category,
        image: selectedImage,
        custom: true,
        updatedAt: Date.now(),
      };
      const nextWords = customWords.map((word) => (word.id === editingWordId ? updated : word));
      if (!writeStorage(storageKeys.customWords, nextWords)) return;
      customWords = nextWords;
    }
    showToast(`“${english}” 카드를 수정했어요!`);
  } else {
    const newWord = {
      id: `custom-${Date.now()}`,
      english,
      korean,
      pronunciation,
      category,
      image: selectedImage,
      custom: true,
      createdAt: Date.now(),
    };
    const nextWords = [...customWords, newWord];
    if (!writeStorage(storageKeys.customWords, nextWords)) return;
    customWords = nextWords;
    activeSort = "newest";
    showToast(`“${english}” 낱말카드를 만들었어요!`);
  }

  editingWordId = null;
  syncSortButtons();
  renderCards();
  elements.addDialog.close();
}

function deleteCurrentWord() {
  const word = getCurrentStudyWord();
  if (!word) return;
  if (!window.confirm(`“${word.english}” 낱말카드를 삭제할까요?`)) return;

  if (word.builtIn) {
    deletedDefaultIds.add(word.id);
    delete defaultOverrides[word.id];
    writeStorage(storageKeys.deletedDefaultIds, [...deletedDefaultIds]);
    writeStorage(storageKeys.defaultOverrides, defaultOverrides);
  } else {
    customWords = customWords.filter((item) => item.id !== word.id);
    writeStorage(storageKeys.customWords, customWords);
  }
  learnedWords.delete(word.id);
  wrongWords.delete(word.id);
  Object.keys(dailyPlans).forEach((date) => {
    dailyPlans[date] = dailyPlans[date].filter((id) => id !== word.id);
  });
  Object.keys(dailyCompleted).forEach((date) => {
    dailyCompleted[date] = dailyCompleted[date].filter((id) => id !== word.id);
  });
  writeStorage(storageKeys.learned, [...learnedWords]);
  writeStorage(storageKeys.wrongWords, [...wrongWords]);
  writeStorage(storageKeys.dailyPlans, dailyPlans);
  writeStorage(storageKeys.dailyCompleted, dailyCompleted);
  elements.studyDialog.close();
  renderCards();
  renderReviewPanel();
  showToast("낱말카드를 삭제했어요.");
}

function setMode(mode) {
  if (mode === "cards") quiz = null;
  if (mode === "quiz" && quiz?.review) quiz = null;
  if (mode === "review" && quiz && !quiz.review) quiz = null;
  activeMode = mode;
  const modes = ["cards", "quiz", "review"];
  const tabs = { cards: elements.cardsTab, quiz: elements.quizTab, review: elements.reviewTab };
  const panels = { cards: elements.cardsPanel, quiz: elements.quizPanel, review: elements.reviewPanel };

  modes.forEach((name) => {
    const active = name === mode;
    tabs[name].classList.toggle("is-active", active);
    tabs[name].setAttribute("aria-selected", String(active));
    panels[name].hidden = !active;
  });
  elements.categoryFilter.hidden = mode !== "cards";
  if (mode === "cards") renderCards();
  if (mode === "quiz" && !quiz) renderQuizIntro();
  if (mode === "review" && !quiz) renderReviewPanel();
}

function renderQuizIntro() {
  elements.quizShell.innerHTML = `
    <div class="quiz-intro">
      <div class="quiz-intro-inner">
        <div class="quiz-mascot" aria-hidden="true">?</div>
        <h2>그림 퀴즈, 준비됐나요?</h2>
        <p>그림을 보고 알맞은 영어 단어를 골라요.<br>문제는 모두 5개예요.</p>
        <button class="button button-primary" type="button" data-start-quiz>퀴즈 시작!</button>
      </div>
    </div>`;
}

function renderReviewPanel() {
  const words = getAllWords().filter((word) => wrongWords.has(word.id));
  renderWrongCount();
  if (!words.length) {
    elements.reviewShell.innerHTML = `
      <div class="quiz-intro">
        <div class="quiz-intro-inner">
          <div class="quiz-mascot" aria-hidden="true">✓</div>
          <h2>아직 오답이 없어요!</h2>
          <p>그림 퀴즈에서 틀린 단어가<br>자동으로 이곳에 모여요.</p>
          <button class="button button-primary" type="button" data-go-quiz>그림 퀴즈 풀기</button>
        </div>
      </div>`;
    return;
  }

  elements.reviewShell.innerHTML = `
    <div class="review-intro">
      <div class="review-heading">
        <div>
          <h2>다시 보면 기억나는 오답 ${words.length}개</h2>
          <p>그림을 누르면 소리를 듣고 카드로 다시 볼 수 있어요.</p>
        </div>
        <button class="button button-primary" type="button" data-start-review>오답 퀴즈 시작</button>
      </div>
      <div class="review-list">
        ${words.map((word) => `
          <button class="review-word" type="button" data-review-word-id="${word.id}">
            <img src="${word.image}" alt="${escapeHtml(word.korean)} 그림" />
            <strong>${escapeHtml(word.english)}</strong>
            <small>${escapeHtml(word.korean)}</small>
          </button>`).join("")}
      </div>
    </div>`;
}

function getActiveQuizShell() {
  return quiz?.review ? elements.reviewShell : elements.quizShell;
}

function startQuiz(review = false) {
  const source = review
    ? getAllWords().filter((word) => wrongWords.has(word.id))
    : getAllWords();
  if (!source.length) {
    showToast(review ? "복습할 오답이 없어요!" : "퀴즈를 만들 단어가 없어요.");
    return;
  }
  const questions = shuffle([...source]).slice(0, review ? Math.min(10, source.length) : Math.min(5, source.length));
  quiz = { questions, index: 0, score: 0, answered: false, review };
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const shell = getActiveQuizShell();
  const target = quiz.questions[quiz.index];
  const otherChoices = shuffle(getAllWords().filter((word) => word.id !== target.id)).slice(0, 3);
  const choices = shuffle([target, ...otherChoices]);
  const progress = ((quiz.index + 1) / quiz.questions.length) * 100;

  shell.innerHTML = `
    <div class="quiz-play">
      <div class="quiz-topline">
        <div class="quiz-progress" aria-label="퀴즈 진행률"><span style="width: ${progress}%"></span></div>
        <span class="quiz-number">${quiz.index + 1} / ${quiz.questions.length}</span>
      </div>
      <h2 class="quiz-question">${quiz.review ? "오답을 다시 맞혀 볼까요?" : "이 그림의 영어 단어는 무엇일까요?"}</h2>
      <div class="quiz-card"><img src="${target.image}" alt="${escapeHtml(target.korean)} 그림" /></div>
      <div class="quiz-options">
        ${choices.map((choice) => `<button class="quiz-option" type="button" data-quiz-choice="${choice.id}">${escapeHtml(choice.english)}</button>`).join("")}
      </div>
      <div class="quiz-feedback" aria-live="polite"></div>
    </div>`;
}

function answerQuiz(choiceId) {
  if (!quiz || quiz.answered) return;
  quiz.answered = true;
  const shell = getActiveQuizShell();
  const target = quiz.questions[quiz.index];
  const isCorrect = choiceId === target.id;

  if (isCorrect) {
    quiz.score += 1;
    if (quiz.review) wrongWords.delete(target.id);
  } else {
    wrongWords.add(target.id);
  }
  writeStorage(storageKeys.wrongWords, [...wrongWords]);
  renderWrongCount();

  shell.querySelectorAll("[data-quiz-choice]").forEach((button) => {
    button.disabled = true;
    if (button.dataset.quizChoice === target.id) button.classList.add("is-correct");
    if (button.dataset.quizChoice === choiceId && !isCorrect) button.classList.add("is-wrong");
  });

  speak(target.english);
  const feedback = shell.querySelector(".quiz-feedback");
  feedback.innerHTML = `
    <div>
      <p>${isCorrect ? (quiz.review ? "정답! 오답 목록에서 뺐어요 ★" : "정답이에요! 참 잘했어요 ★") : `괜찮아요! 정답은 “${escapeHtml(target.english)}”`}</p>
      <small>${escapeHtml(target.english)} · ${escapeHtml(target.korean)}</small>
    </div>
    <button class="button button-primary" type="button" data-next-question>${quiz.index + 1 === quiz.questions.length ? "결과 보기" : "다음 문제"}</button>`;
}

function nextQuestion() {
  if (!quiz) return;
  quiz.index += 1;
  quiz.answered = false;
  if (quiz.index >= quiz.questions.length) renderQuizComplete();
  else renderQuizQuestion();
}

function renderQuizComplete() {
  const shell = getActiveQuizShell();
  const total = quiz.questions.length;
  const review = quiz.review;
  const score = quiz.score;
  const message = score === total ? "완벽해요! 영어 탐험가네요!" : score >= Math.ceil(total / 2) ? "멋져요! 기억이 더 선명해졌어요!" : "좋은 시작이에요! 한 번 더 볼까요?";
  shell.innerHTML = `
    <div class="quiz-complete">
      <div class="quiz-complete-inner">
        <div class="quiz-score-ring"><span>${score}/${total}</span></div>
        <h2>${message}</h2>
        <p>${review ? "맞힌 단어는 오답 목록에서 자동으로 빠졌어요." : "틀린 단어는 오답 복습에 자동으로 모았어요."}</p>
        <button class="button button-primary" type="button" ${review ? "data-start-review" : "data-start-quiz"}>한 번 더 풀기</button>
        <button class="button button-quiet" type="button" ${review ? "data-show-review" : "data-back-to-cards"}>${review ? "오답 목록 보기" : "카드 다시 보기"}</button>
      </div>
    </div>`;
  quiz = null;
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function syncSortButtons() {
  document.querySelectorAll("[data-category]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.category === activeSort);
  });
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2600);
}

function closeOnBackdrop(event) {
  if (event.target === event.currentTarget) event.currentTarget.close();
}

function handleQuizShellClick(event) {
  const startButton = event.target.closest("[data-start-quiz]");
  const startReviewButton = event.target.closest("[data-start-review]");
  const choiceButton = event.target.closest("[data-quiz-choice]");
  const nextButton = event.target.closest("[data-next-question]");
  const cardsButton = event.target.closest("[data-back-to-cards]");
  const showReviewButton = event.target.closest("[data-show-review]");
  const goQuizButton = event.target.closest("[data-go-quiz]");
  const reviewWordButton = event.target.closest("[data-review-word-id]");

  if (startButton) startQuiz(false);
  if (startReviewButton) startQuiz(true);
  if (choiceButton) answerQuiz(choiceButton.dataset.quizChoice);
  if (nextButton) nextQuestion();
  if (cardsButton) setMode("cards");
  if (showReviewButton) renderReviewPanel();
  if (goQuizButton) setMode("quiz");
  if (reviewWordButton) {
    activeSort = "oldest";
    syncSortButtons();
    renderCards();
    const words = getVisibleWords();
    activeStudyIndex = Math.max(0, words.findIndex((word) => word.id === reviewWordButton.dataset.reviewWordId));
    updateStudyDialog();
    elements.studyDialog.showModal();
  }
}

elements.cardGrid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-word-id]");
  if (card) openStudy(card.dataset.wordId);
});

elements.categoryFilter.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeSort = button.dataset.category;
  syncSortButtons();
  renderCards();
});

elements.cardsTab.addEventListener("click", () => setMode("cards"));
elements.quizTab.addEventListener("click", () => setMode("quiz"));
elements.reviewTab.addEventListener("click", () => setMode("review"));
elements.startDailyButton.addEventListener("click", startDailyStudy);
elements.openAddButton.addEventListener("click", () => openAddDialog());
elements.openSyncButton.addEventListener("click", openSyncDialog);
document.querySelectorAll("[data-open-add]").forEach((button) => button.addEventListener("click", () => openAddDialog()));
document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

elements.studyDialog.addEventListener("click", closeOnBackdrop);
elements.addDialog.addEventListener("click", closeOnBackdrop);
elements.syncDialog.addEventListener("click", closeOnBackdrop);
elements.studySpeakButton.addEventListener("click", () => {
  const word = getCurrentStudyWord();
  if (word) speak(word.english);
});
elements.learnButton.addEventListener("click", toggleLearned);
elements.editWordButton.addEventListener("click", openEditCurrentWord);
elements.previousWordButton.addEventListener("click", () => moveStudy(-1));
elements.nextWordButton.addEventListener("click", () => moveStudy(1));
elements.deleteWordButton.addEventListener("click", deleteCurrentWord);
elements.imageInput.addEventListener("change", handleImageSelection);
elements.englishInput.addEventListener("input", () => {
  clearTimeout(meaningLookupTimer);
  const english = elements.englishInput.value.trim().toLowerCase();
  if (/^[a-zA-Z][a-zA-Z -]*$/.test(english) && !elements.koreanInput.value.trim()) {
    meaningLookupTimer = setTimeout(fillMeaningFromEnglish, 700);
  }
});
elements.addWordForm.addEventListener("submit", saveWord);
elements.quizShell.addEventListener("click", handleQuizShellClick);
elements.reviewShell.addEventListener("click", handleQuizShellClick);
elements.copySyncCodeButton.addEventListener("click", copySyncCode);
elements.connectSyncCodeButton.addEventListener("click", connectSyncCode);
elements.syncNowButton.addEventListener("click", () => syncWithCloud({ announce: true }));
window.addEventListener("online", () => syncWithCloud());
window.addEventListener("offline", () => setSyncStatus("offline", "오프라인", "기기에 저장했고 온라인이 되면 다시 동기화해요."));

document.addEventListener("keydown", (event) => {
  if (!elements.studyDialog.open) return;
  if (event.key === "ArrowLeft") moveStudy(-1);
  if (event.key === "ArrowRight") moveStudy(1);
  if (event.key === " ") {
    event.preventDefault();
    const word = getCurrentStudyWord();
    if (word) speak(word.english);
  }
});

window.handleAndroidBack = () => {
  const openDialog = document.querySelector("dialog[open]");
  if (openDialog) {
    openDialog.close();
    return true;
  }
  return false;
};

if ("serviceWorker" in navigator && /^https?:$/.test(window.location.protocol)) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // The site remains usable without offline caching.
    });
  });
}

syncSortButtons();
renderCards();
renderQuizIntro();
renderReviewPanel();
initializeCloudSync();
