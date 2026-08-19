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
  learned: "kongkong-learned-words-v1",
};

const speakerIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M11 5 6.5 9H3v6h3.5l4.5 4V5ZM15 9.5c.8.7 1.2 1.5 1.2 2.5s-.4 1.8-1.2 2.5M17.8 6.8c1.6 1.4 2.4 3.1 2.4 5.2s-.8 3.8-2.4 5.2"/>
  </svg>`;

const elements = {
  learnedCount: document.querySelector("#learnedCount"),
  wordCount: document.querySelector("#wordCount"),
  cardGrid: document.querySelector("#cardGrid"),
  emptyState: document.querySelector("#emptyState"),
  cardsTab: document.querySelector("#cardsTab"),
  quizTab: document.querySelector("#quizTab"),
  cardsPanel: document.querySelector("#cardsPanel"),
  quizPanel: document.querySelector("#quizPanel"),
  quizShell: document.querySelector("#quizShell"),
  categoryFilter: document.querySelector("#categoryFilter"),
  studyDialog: document.querySelector("#studyDialog"),
  studyImage: document.querySelector("#studyImage"),
  studyWord: document.querySelector("#studyWord"),
  studyMeaning: document.querySelector("#studyMeaning"),
  studyPronunciation: document.querySelector("#studyPronunciation"),
  studySpeakButton: document.querySelector("#studySpeakButton"),
  learnButton: document.querySelector("#learnButton"),
  deleteWordButton: document.querySelector("#deleteWordButton"),
  customBadge: document.querySelector("#customBadge"),
  previousWordButton: document.querySelector("#previousWordButton"),
  nextWordButton: document.querySelector("#nextWordButton"),
  studyDots: document.querySelector("#studyDots"),
  addDialog: document.querySelector("#addDialog"),
  openAddButton: document.querySelector("#openAddButton"),
  addWordForm: document.querySelector("#addWordForm"),
  imageInput: document.querySelector("#imageInput"),
  imagePreview: document.querySelector("#imagePreview"),
  uploadPlaceholder: document.querySelector("#uploadPlaceholder"),
  formError: document.querySelector("#formError"),
  toast: document.querySelector("#toast"),
};

let customWords = readStorage(storageKeys.customWords, []);
let learnedWords = new Set(readStorage(storageKeys.learned, []));
let activeCategory = "all";
let activeStudyIndex = 0;
let selectedImage = "";
let toastTimer;
let quiz = null;

if (window.AndroidApp) {
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
    return true;
  } catch {
    showToast("저장 공간이 부족해요. 작은 사진으로 다시 시도해 주세요.");
    return false;
  }
}

function getAllWords() {
  return [...defaultWords, ...customWords];
}

function getVisibleWords() {
  const words = getAllWords();
  return activeCategory === "all" ? words : words.filter((word) => word.category === activeCategory);
}

function escapeHtml(value) {
  const node = document.createElement("span");
  node.textContent = value;
  return node.innerHTML;
}

function renderCards() {
  const words = getVisibleWords();
  elements.wordCount.textContent = getAllWords().length;
  elements.learnedCount.textContent = [...learnedWords].filter((id) => getAllWords().some((word) => word.id === id)).length;
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
}

function openStudy(wordId) {
  const words = getVisibleWords();
  activeStudyIndex = Math.max(0, words.findIndex((word) => word.id === wordId));
  updateStudyDialog();
  elements.studyDialog.showModal();
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
  elements.deleteWordButton.hidden = !word.custom;

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
      // The browser fallback below keeps voice playback working outside Android.
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
  const word = getVisibleWords()[activeStudyIndex];
  if (!word) return;

  if (learnedWords.has(word.id)) {
    learnedWords.delete(word.id);
    showToast("배운 단어에서 뺐어요.");
  } else {
    learnedWords.add(word.id);
    showToast("참 잘했어요! 별 하나를 모았어요 ★");
  }
  writeStorage(storageKeys.learned, [...learnedWords]);
  updateStudyDialog();
  renderCards();
}

function openAddDialog() {
  elements.addWordForm.reset();
  selectedImage = "";
  elements.imagePreview.src = "";
  elements.imagePreview.hidden = true;
  elements.uploadPlaceholder.hidden = false;
  elements.formError.textContent = "";
  elements.addDialog.showModal();
  requestAnimationFrame(() => document.querySelector("#englishInput").focus());
}

async function prepareImage(file) {
  const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
  if (!allowedTypes.includes(file.type)) throw new Error("JPG, PNG, WEBP 그림만 올릴 수 있어요.");
  if (file.size > 12 * 1024 * 1024) throw new Error("그림 파일은 12MB보다 작아야 해요.");

  const source = await fileToDataUrl(file);
  const image = await loadImage(source);
  const maxSize = 800;
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext("2d");
  context.fillStyle = "#fffdf7";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
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

function addWord(event) {
  event.preventDefault();
  const form = new FormData(elements.addWordForm);
  const english = String(form.get("english") || "").trim().toLowerCase();
  const korean = String(form.get("korean") || "").trim();
  const pronunciation = String(form.get("pronunciation") || "").trim();
  const category = String(form.get("category") || "things");

  if (!/^[a-zA-Z][a-zA-Z -]*$/.test(english)) {
    elements.formError.textContent = "영어 단어는 알파벳으로 적어 주세요.";
    return;
  }
  if (!korean) {
    elements.formError.textContent = "한글 뜻을 적어 주세요.";
    return;
  }
  if (!selectedImage) {
    elements.formError.textContent = "단어와 어울리는 그림을 골라 주세요.";
    return;
  }
  if (getAllWords().some((word) => word.english.toLowerCase() === english)) {
    elements.formError.textContent = "이미 등록된 영어 단어예요.";
    return;
  }

  const newWord = {
    id: `custom-${Date.now()}`,
    english,
    korean,
    pronunciation,
    category,
    image: selectedImage,
    custom: true,
  };

  const nextWords = [...customWords, newWord];
  if (!writeStorage(storageKeys.customWords, nextWords)) return;
  customWords = nextWords;
  activeCategory = "all";
  syncCategoryButtons();
  renderCards();
  elements.addDialog.close();
  showToast(`“${english}” 낱말카드를 만들었어요!`);
}

function deleteCurrentWord() {
  const word = getVisibleWords()[activeStudyIndex];
  if (!word?.custom) return;
  if (!window.confirm(`“${word.english}” 낱말카드를 삭제할까요?`)) return;

  customWords = customWords.filter((item) => item.id !== word.id);
  learnedWords.delete(word.id);
  writeStorage(storageKeys.customWords, customWords);
  writeStorage(storageKeys.learned, [...learnedWords]);
  elements.studyDialog.close();
  renderCards();
  showToast("낱말카드를 삭제했어요.");
}

function setMode(mode) {
  const showCards = mode === "cards";
  elements.cardsPanel.hidden = !showCards;
  elements.quizPanel.hidden = showCards;
  elements.cardsTab.classList.toggle("is-active", showCards);
  elements.quizTab.classList.toggle("is-active", !showCards);
  elements.cardsTab.setAttribute("aria-selected", String(showCards));
  elements.quizTab.setAttribute("aria-selected", String(!showCards));
  elements.categoryFilter.hidden = !showCards;
  if (!showCards && !quiz) renderQuizIntro();
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

function startQuiz() {
  const words = shuffle([...getAllWords()]);
  const questions = words.slice(0, Math.min(5, words.length));
  quiz = { questions, index: 0, score: 0, answered: false };
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const target = quiz.questions[quiz.index];
  const otherChoices = shuffle(getAllWords().filter((word) => word.id !== target.id)).slice(0, 3);
  const choices = shuffle([target, ...otherChoices]);
  const progress = ((quiz.index + 1) / quiz.questions.length) * 100;

  elements.quizShell.innerHTML = `
    <div class="quiz-play">
      <div class="quiz-topline">
        <div class="quiz-progress" aria-label="퀴즈 진행률"><span style="width: ${progress}%"></span></div>
        <span class="quiz-number">${quiz.index + 1} / ${quiz.questions.length}</span>
      </div>
      <h2 class="quiz-question">이 그림의 영어 단어는 무엇일까요?</h2>
      <div class="quiz-card"><img src="${target.image}" alt="${escapeHtml(target.korean)} 그림" /></div>
      <div class="quiz-options">
        ${choices
          .map(
            (choice) => `<button class="quiz-option" type="button" data-quiz-choice="${choice.id}">${escapeHtml(choice.english)}</button>`,
          )
          .join("")}
      </div>
      <div class="quiz-feedback" id="quizFeedback" aria-live="polite"></div>
    </div>`;
}

function answerQuiz(choiceId) {
  if (quiz.answered) return;
  quiz.answered = true;
  const target = quiz.questions[quiz.index];
  const isCorrect = choiceId === target.id;
  if (isCorrect) quiz.score += 1;

  document.querySelectorAll("[data-quiz-choice]").forEach((button) => {
    button.disabled = true;
    if (button.dataset.quizChoice === target.id) button.classList.add("is-correct");
    if (button.dataset.quizChoice === choiceId && !isCorrect) button.classList.add("is-wrong");
  });

  speak(target.english);
  const feedback = document.querySelector("#quizFeedback");
  feedback.innerHTML = `
    <div>
      <p>${isCorrect ? "정답이에요! 참 잘했어요 ★" : `괜찮아요! 정답은 “${escapeHtml(target.english)}”`}</p>
      <small>${escapeHtml(target.english)} · ${escapeHtml(target.korean)}</small>
    </div>
    <button class="button button-primary" type="button" data-next-question>${quiz.index + 1 === quiz.questions.length ? "결과 보기" : "다음 문제"}</button>`;
}

function nextQuestion() {
  quiz.index += 1;
  quiz.answered = false;
  if (quiz.index >= quiz.questions.length) {
    renderQuizComplete();
  } else {
    renderQuizQuestion();
  }
}

function renderQuizComplete() {
  const total = quiz.questions.length;
  const message = quiz.score === total ? "완벽해요! 영어 탐험가네요!" : quiz.score >= Math.ceil(total / 2) ? "멋져요! 한 번 더 하면 만점!" : "좋은 시작이에요! 카드를 다시 볼까요?";
  elements.quizShell.innerHTML = `
    <div class="quiz-complete">
      <div class="quiz-complete-inner">
        <div class="quiz-score-ring"><span>${quiz.score}/${total}</span></div>
        <h2>${message}</h2>
        <p>틀린 단어도 다시 보고 소리 내어 읽으면<br>금방 기억할 수 있어요.</p>
        <button class="button button-primary" type="button" data-start-quiz>한 번 더 풀기</button>
        <button class="button button-quiet" type="button" data-back-to-cards>카드 다시 보기</button>
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

function syncCategoryButtons() {
  document.querySelectorAll("[data-category]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.category === activeCategory);
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

elements.cardGrid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-word-id]");
  if (card) openStudy(card.dataset.wordId);
});

elements.categoryFilter.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  syncCategoryButtons();
  renderCards();
});

elements.cardsTab.addEventListener("click", () => setMode("cards"));
elements.quizTab.addEventListener("click", () => setMode("quiz"));
elements.openAddButton.addEventListener("click", openAddDialog);
document.querySelectorAll("[data-open-add]").forEach((button) => button.addEventListener("click", openAddDialog));
document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

elements.studyDialog.addEventListener("click", closeOnBackdrop);
elements.addDialog.addEventListener("click", closeOnBackdrop);
elements.studySpeakButton.addEventListener("click", () => {
  const word = getVisibleWords()[activeStudyIndex];
  if (word) speak(word.english);
});
elements.learnButton.addEventListener("click", toggleLearned);
elements.previousWordButton.addEventListener("click", () => moveStudy(-1));
elements.nextWordButton.addEventListener("click", () => moveStudy(1));
elements.deleteWordButton.addEventListener("click", deleteCurrentWord);
elements.imageInput.addEventListener("change", handleImageSelection);
elements.addWordForm.addEventListener("submit", addWord);

elements.quizShell.addEventListener("click", (event) => {
  const startButton = event.target.closest("[data-start-quiz]");
  const choiceButton = event.target.closest("[data-quiz-choice]");
  const nextButton = event.target.closest("[data-next-question]");
  const cardsButton = event.target.closest("[data-back-to-cards]");
  if (startButton) startQuiz();
  if (choiceButton) answerQuiz(choiceButton.dataset.quizChoice);
  if (nextButton) nextQuestion();
  if (cardsButton) setMode("cards");
});

document.addEventListener("keydown", (event) => {
  if (!elements.studyDialog.open) return;
  if (event.key === "ArrowLeft") moveStudy(-1);
  if (event.key === "ArrowRight") moveStudy(1);
  if (event.key === " ") {
    event.preventDefault();
    const word = getVisibleWords()[activeStudyIndex];
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
      // The site remains fully usable when service workers are unavailable.
    });
  });
}

renderCards();
renderQuizIntro();
