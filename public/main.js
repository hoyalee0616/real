const TARGET_BYTES = 2 * 1024 * 1024;

const elements = {
  modeBuilding: document.getElementById('mode-building'),
  modeCompress: document.getElementById('mode-compress'),
  modeTransparent: document.getElementById('mode-transparent'),
  modeUpscale: document.getElementById('mode-upscale'),
  modePdf: document.getElementById('mode-pdf'),
  heroSub: document.getElementById('hero-sub'),

  buildingPanel: document.getElementById('building-panel'),
  buildingQuery: document.getElementById('building-query'),
  buildingSuggest: document.getElementById('building-suggest'),
  buildingSearchButton: document.getElementById('building-search-btn'),
  listingAutofillStartBtn: document.getElementById('listing-autofill-start-btn'),
  buildingStatus: document.getElementById('building-status'),
  buildingResult: document.getElementById('building-result'),
  buildingTitle: document.getElementById('building-title'),
  buildingSubtitle: document.getElementById('building-subtitle'),
  buildingIssueLink: document.getElementById('building-issue-link'),
  buildingUse: document.getElementById('building-use'),
  buildingApprovalDate: document.getElementById('building-approval-date'),
  buildingFloorSummary: document.getElementById('building-floor-summary'),
  buildingParkingCount: document.getElementById('building-parking-count'),
  buildingOverviewBody: document.getElementById('building-overview-body'),
  buildingDongList: document.getElementById('building-dong-list'),
  buildingHoList: document.getElementById('building-ho-list'),
  buildingDongHoSummary: document.getElementById('building-dongho-summary'),
  buildingNearbyList: document.getElementById('building-nearby-list'),
  buildingTransitSummary: document.getElementById('building-transit-summary'),
  listingDescTransport: document.getElementById('listing-desc-transport'),
  listingDescEducation: document.getElementById('listing-desc-education'),
  listingDescAmenity: document.getElementById('listing-desc-amenity'),
  listingDescCopyAllBtn: document.getElementById('listing-desc-copy-all-btn'),
  listingDescPanel: document.getElementById('building-tab-description'),
  buildingMap: document.getElementById('building-map'),
  listingModal: document.getElementById('listing-modal'),
  listingModalClose: document.getElementById('listing-modal-close'),
  listingCancelBtn: document.getElementById('listing-cancel-btn'),
  listingSaveBtn: document.getElementById('listing-save-btn'),
  listingModalUnit: document.getElementById('listing-modal-unit'),
  listingPrice: document.getElementById('listing-price'),
  listingRoomCount: document.getElementById('listing-room-count'),
  listingBathCount: document.getElementById('listing-bath-count'),
  listingMaintenanceFee: document.getElementById('listing-maintenance-fee'),
  listingMoveInDate: document.getElementById('listing-move-in-date'),
  listingDescription: document.getElementById('listing-description'),

  imageUploader: document.getElementById('image-uploader'),
  fileInput: document.getElementById('file-input'),
  dropzone: document.getElementById('dropzone'),
  compressControls: document.getElementById('compress-controls'),
  transparentControls: document.getElementById('transparent-controls'),
  upscaleControls: document.getElementById('upscale-controls'),
  compressFormat: document.getElementById('compress-format'),
  transparentFormat: document.getElementById('transparent-format'),
  upscaleFormat: document.getElementById('upscale-format'),
  upscaleMethod: document.getElementById('upscale-method'),
  upscaleSharpen: document.getElementById('upscale-sharpen'),
  upscaleVignette: document.getElementById('upscale-vignette'),
  transparentMethod: document.getElementById('transparent-method'),
  transparentMode: document.getElementById('transparent-mode'),
  transparentColor: document.getElementById('transparent-color'),
  transparentTolerance: document.getElementById('transparent-tolerance'),
  compressButton: document.getElementById('compress-btn'),
  transparentButton: document.getElementById('transparent-btn'),
  upscaleButton: document.getElementById('upscale-btn'),
  imageBatchResults: document.getElementById('image-batch-results'),

  pdfUploader: document.getElementById('pdf-uploader'),
  pdfFile: document.getElementById('pdf-file'),
  pdfPage: document.getElementById('pdf-page'),
  pdfX: document.getElementById('pdf-x'),
  pdfY: document.getElementById('pdf-y'),
  pdfFontSize: document.getElementById('pdf-font-size'),
  pdfText: document.getElementById('pdf-text'),
  pdfAddButton: document.getElementById('pdf-add-btn'),
  pdfItems: document.getElementById('pdf-items'),
  pdfCanvas: document.getElementById('pdf-canvas'),
  pdfSelection: document.getElementById('pdf-selection'),
  pdfSignButton: document.getElementById('pdf-sign-btn'),

  message: document.getElementById('message'),
  result: document.getElementById('result'),
  originalMeta: document.getElementById('original-meta'),
  compressedMeta: document.getElementById('compressed-meta'),
  savedMeta: document.getElementById('saved-meta'),
  previewWrap: document.getElementById('preview-wrap'),
  preview: document.getElementById('preview'),
  compareWrap: document.getElementById('compare-wrap'),
  compareBefore: document.getElementById('compare-before'),
  compareAfter: document.getElementById('compare-after'),
  compareAfterClip: document.getElementById('compare-after-clip'),
  compareDivider: document.getElementById('compare-divider'),
  compareHandle: document.getElementById('compare-handle'),
  compareStage: document.getElementById('compare-stage'),
  compareBeforeMeta: document.getElementById('compare-before-meta'),
  compareAfterMeta: document.getElementById('compare-after-meta'),
  compareMethodLabel: document.getElementById('compare-method-label'),
  compareSizeLabel: document.getElementById('compare-size-label'),
  compareSlider: document.getElementById('compare-slider'),
  downloadLink: document.getElementById('download-link')
};

const state = {
  mode: 'compress',
  buildingMap: null,
  buildingMapCenter: null,
  buildingMapConfig: null,
  kakaoMapsReadyPromise: null,
  kakaoInfoWindow: null,
  buildingMarkers: [],
  buildingSuggestItems: [],
  buildingSuggestActiveIndex: -1,
  buildingSuggestTimer: null,
  buildingSuggestRequestSeq: 0,
  buildingVworldPnu: '',
  buildingVworldYear: null,
  buildingVworldAvailable: false,
  buildingSelectedDong: '',
  buildingSelectedPyeongKey: '',
  buildingHoFallbackList: [],
  listingTargetUnit: null,
  listingDraft: null,
  currentBuildingQuery: '',
  descriptionNeedsReload: false,
  descriptionReloadTried: false,
  descriptionReloading: false,
  imageFiles: [],
  previewUrl: null,
  compareBeforeUrl: null,
  compareAfterUrl: null,
  batchUrls: [],
  aiRemoveBackgroundFn: null,
  aiUpscalerFactory: null,
  aiUpscalerModel: null,

  pdfFile: null,
  pdfArrayBuffer: null,
  pdfPageCount: 0,
  pdfPreviewDoc: null,
  pdfScale: 1,
  pdfBoxWidth: null,
  pdfSelecting: false,
  pdfDragStart: null,
  pdfBaseImageData: null,
  pdfItems: []
};

function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(2)}MB`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function setMessage(text, isError = false) {
  elements.message.textContent = text;
  elements.message.classList.toggle('error', isError);
}

function setBuildingStatus(text, type = 'info') {
  if (!elements.buildingStatus) return;
  elements.buildingStatus.textContent = text || '';
  elements.buildingStatus.classList.remove('loading', 'error', 'success');
  if (type === 'loading' || type === 'error' || type === 'success') {
    elements.buildingStatus.classList.add(type);
  }
}

function outputExtension(type) {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  if (type === 'application/pdf') return 'pdf';
  return 'jpg';
}

function formatDistanceMeters(distance) {
  if (!Number.isFinite(distance)) return '-';
  if (distance < 1000) return `${distance}m`;
  return `${(distance / 1000).toFixed(2)}km`;
}

function formatNumberOrDash(value, suffix = '') {
  if (!Number.isFinite(Number(value))) return '-';
  return `${Number(value).toLocaleString('ko-KR')}${suffix}`;
}

function formatArea(value) {
  if (!Number.isFinite(Number(value))) return '-';
  const sqm = Number(value);
  const pyeong = sqm / 3.305785;
  return `${sqm.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}㎡ (${pyeong.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}평)`;
}

function renderTransitInfo(item, emptyText = '반경 내 없음') {
  if (!item || !Number.isFinite(Number(item.distanceMeters))) {
    return `<span class="facility-empty">${escapeHtml(emptyText)}</span>`;
  }
  const walk = Number.isFinite(Number(item.walkMinutes)) ? `도보 ${item.walkMinutes}분` : '도보 -';
  const drive = Number.isFinite(Number(item.driveMinutes)) ? `차량 ${item.driveMinutes}분` : '차량 -';
  return `<strong>${escapeHtml(item.name || '-')}</strong><span>${escapeHtml(formatDistanceMeters(item.distanceMeters))} · ${escapeHtml(walk)} · ${escapeHtml(drive)}</span>`;
}

function bulletLine(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  return `- ${t}`;
}

async function copyTextToClipboard(text) {
  const value = String(text || '');
  if (!value.trim()) return false;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }
  const ta = document.createElement('textarea');
  ta.value = value;
  ta.setAttribute('readonly', 'true');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  return ok;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getSourceBadgeMeta(source) {
  const token = String(source || '').toLowerCase();
  if (token === 'registry' || token === 'building-registry' || token === 'vworld') {
    return { label: '원본', className: 'source-original' };
  }
  return { label: '보강', className: 'source-fallback' };
}

function getSupplyBadgeMeta(item, hasRawSupply) {
  const token = String(item?.source || '').toLowerCase();
  if (!hasRawSupply) {
    return {
      sourceLabel: '공급 출처: 전용기반 추정',
      sourceClassName: 'source-fallback',
      confidenceLabel: '신뢰도: 낮음',
      confidenceClassName: 'source-confidence-low'
    };
  }
  if (token.includes('registry') && !token.includes('lh-supply') && !token.includes('complex-supply-map')) {
    return {
      sourceLabel: '공급 출처: 건축물대장 원본',
      sourceClassName: 'source-original',
      confidenceLabel: '신뢰도: 높음',
      confidenceClassName: 'source-confidence-high'
    };
  }
  if (token.includes('lh-supply')) {
    return {
      sourceLabel: '공급 출처: LH 보강',
      sourceClassName: 'source-fallback',
      confidenceLabel: '신뢰도: 중간',
      confidenceClassName: 'source-confidence-medium'
    };
  }
  if (token.includes('complex-supply-map')) {
    return {
      sourceLabel: '공급 출처: 단지 매핑',
      sourceClassName: 'source-fallback',
      confidenceLabel: '신뢰도: 중간',
      confidenceClassName: 'source-confidence-medium'
    };
  }
  return {
    sourceLabel: '공급 출처: 보강 원천',
    sourceClassName: 'source-fallback',
    confidenceLabel: '신뢰도: 중간',
    confidenceClassName: 'source-confidence-medium'
  };
}

function normalizeDongForApi(dongName) {
  const raw = String(dongName || '').trim();
  if (!raw) return '';
  const digits = raw.match(/\d+/);
  if (digits?.[0]) return digits[0];
  return raw.replace(/동$/u, '').trim();
}

function getPyeongFilterKeyFromArea(areaSquareMeter) {
  const area = Number(areaSquareMeter);
  if (!Number.isFinite(area) || area <= 0) return '';
  return (area / 3.3058).toFixed(1);
}

function buildPyeongChipData(pyeongTypes = []) {
  const list = Array.isArray(pyeongTypes) ? pyeongTypes : [];
  return list
    .map((item) => {
      const area = Number(item?.areaSqm);
      if (!Number.isFinite(area) || area <= 0) return null;
      const p = Number(item?.pyeong);
      const label = item?.label || `${(area / 3.3058).toFixed(1)}평형`;
      const matchKey = String(item?.matchKey || '').trim();
      return {
        key: matchKey || (area / 3.3058).toFixed(1),
        label,
        areaSqm: area,
        pyeong: Number.isFinite(p) ? p : Number((area / 3.3058).toFixed(1)),
        unitCount: Number(item?.unitCount || 0)
      };
    })
    .filter(Boolean);
}

function clearBuildingSuggestions() {
  state.buildingSuggestItems = [];
  state.buildingSuggestActiveIndex = -1;
  elements.buildingSuggest.hidden = true;
  elements.buildingSuggest.innerHTML = '';
}

function applyBuildingSuggestion(index, triggerSearch = true) {
  const item = state.buildingSuggestItems[index];
  if (!item) return;
  const nextValue = item.query || item.roadAddress || item.address || item.placeName || '';
  elements.buildingQuery.value = nextValue;
  clearBuildingSuggestions();
  if (triggerSearch) {
    void runBuildingSearch(nextValue);
  }
}

function renderBuildingSuggestions(items) {
  state.buildingSuggestItems = items;
  state.buildingSuggestActiveIndex = items.length ? 0 : -1;
  if (!items.length) {
    clearBuildingSuggestions();
    return;
  }
  elements.buildingSuggest.innerHTML = items.map((item, index) => {
    const active = index === state.buildingSuggestActiveIndex ? ' active' : '';
    const main = item.roadAddress || item.address || item.placeName || '';
    const name = item.placeName || '';
    const sub = item.address || '';
    return `<article class="building-suggest-item${active}" data-suggest-index="${index}">
      <div class="building-suggest-main">${escapeHtml(main)}</div>
      ${name ? `<div class="building-suggest-name">${escapeHtml(name)}</div>` : ''}
      ${sub ? `<div class="building-suggest-sub">${escapeHtml(sub)}</div>` : ''}
    </article>`;
  }).join('');
  elements.buildingSuggest.hidden = false;
}

function updateSuggestActiveIndex(nextIndex) {
  if (!state.buildingSuggestItems.length) return;
  const clamped = Math.max(0, Math.min(state.buildingSuggestItems.length - 1, nextIndex));
  state.buildingSuggestActiveIndex = clamped;
  elements.buildingSuggest.querySelectorAll('.building-suggest-item').forEach((el, idx) => {
    el.classList.toggle('active', idx === clamped);
  });
}

async function fetchBuildingSuggestions(query) {
  const q = String(query || '').trim();
  if (q.length < 2) {
    clearBuildingSuggestions();
    return;
  }
  const seq = ++state.buildingSuggestRequestSeq;
  try {
    const response = await fetch(`/api/location/suggest?q=${encodeURIComponent(q)}`);
    const payload = await response.json();
    if (seq !== state.buildingSuggestRequestSeq) return;
    if (!response.ok || !payload?.ok) {
      clearBuildingSuggestions();
      return;
    }
    renderBuildingSuggestions(payload.items || []);
  } catch (_error) {
    clearBuildingSuggestions();
  }
}

async function getClientConfig() {
  if (state.buildingMapConfig) return state.buildingMapConfig;
  const response = await fetch('/api/client-config');
  const payload = await response.json();
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || '클라이언트 설정을 불러오지 못했습니다.');
  }
  state.buildingMapConfig = payload;
  return payload;
}

function loadKakaoMapsScript(appKey) {
  return new Promise((resolve, reject) => {
    if (window.kakao?.maps) {
      window.kakao.maps.load(() => resolve(window.kakao.maps));
      return;
    }

    const existing = document.querySelector('script[data-kakao-maps-loader="1"]');
    if (existing) {
      existing.addEventListener('load', () => {
        if (!window.kakao?.maps) {
          reject(new Error('Kakao Maps API 초기화 실패'));
          return;
        }
        window.kakao.maps.load(() => resolve(window.kakao.maps));
      });
      existing.addEventListener('error', () => reject(new Error('Kakao Maps 스크립트 로딩 실패')));
      return;
    }

    const script = document.createElement('script');
    script.dataset.kakaoMapsLoader = '1';
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!window.kakao?.maps) {
        reject(new Error('Kakao Maps API 초기화 실패'));
        return;
      }
      window.kakao.maps.load(() => resolve(window.kakao.maps));
    };
    script.onerror = () => reject(new Error('Kakao Maps 스크립트 로딩 실패'));
    document.head.appendChild(script);
  });
}

async function ensureKakaoMapsLoaded() {
  if (window.kakao?.maps) return window.kakao.maps;
  if (!state.kakaoMapsReadyPromise) {
    state.kakaoMapsReadyPromise = (async () => {
      const config = await getClientConfig();
      const appKey = String(config.kakaoMapJsKey || '').trim();
      if (!appKey) {
        throw new Error('KAKAO_MAP_JS_KEY가 설정되지 않았습니다.');
      }
      return loadKakaoMapsScript(appKey);
    })();
  }
  return state.kakaoMapsReadyPromise;
}

function selectBuildingTab(tabName) {
  document.querySelectorAll('.building-tab').forEach((tabEl) => {
    if (!(tabEl instanceof HTMLButtonElement)) return;
    tabEl.classList.toggle('active', tabEl.dataset.buildingTab === tabName);
  });

  const panels = {
    overview: document.getElementById('building-tab-overview'),
    dongho: document.getElementById('building-tab-dongho'),
    transit: document.getElementById('building-tab-transit'),
    description: document.getElementById('building-tab-description'),
    map: document.getElementById('building-tab-map')
  };

  Object.entries(panels).forEach(([name, panel]) => {
    if (!panel) return;
    panel.classList.toggle('active', name === tabName);
  });

  if (tabName === 'map' && state.buildingMap) {
    setTimeout(() => {
      if (typeof state.buildingMap.relayout === 'function') {
        state.buildingMap.relayout();
      }
      if (state.buildingMapCenter) {
        state.buildingMap.setCenter(state.buildingMapCenter);
      }
    }, 10);
  }
}

function clearBuildingMapMarkers() {
  if (!state.buildingMap) return;
  state.buildingMarkers.forEach((marker) => {
    if (typeof marker.setMap === 'function') marker.setMap(null);
  });
  state.buildingMarkers = [];
}

async function renderBuildingMap(building, nearbyItems) {
  if (!elements.buildingMap) return;
  const maps = await ensureKakaoMapsLoaded();

  const lat = Number(building.lat);
  const lng = Number(building.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const center = new maps.LatLng(lat, lng);
  state.buildingMapCenter = center;

  if (!state.buildingMap) {
    state.buildingMap = new maps.Map(elements.buildingMap, {
      center,
      level: 4
    });
    state.kakaoInfoWindow = new maps.InfoWindow({ removable: true });
  }

  state.buildingMap.setCenter(center);
  state.buildingMap.setLevel(4);
  clearBuildingMapMarkers();

  const mainMarker = new maps.Marker({ position: center, map: state.buildingMap });
  maps.event.addListener(mainMarker, 'click', () => {
    state.kakaoInfoWindow?.setContent(`<div style="padding:8px 10px;font-size:12px;"><strong>${escapeHtml(building.name || '검색 건물')}</strong><br>${escapeHtml(building.roadAddress || building.address || '')}</div>`);
    state.kakaoInfoWindow?.open(state.buildingMap, mainMarker);
  });
  state.buildingMarkers.push(mainMarker);

  const bounds = new maps.LatLngBounds();
  bounds.extend(center);

  nearbyItems.slice(0, 30).forEach((item) => {
    const itemLat = Number(item.lat);
    const itemLng = Number(item.lng);
    if (!Number.isFinite(itemLat) || !Number.isFinite(itemLng)) return;
    const pos = new maps.LatLng(itemLat, itemLng);
    const marker = new maps.Marker({ map: state.buildingMap, position: pos });
    maps.event.addListener(marker, 'click', () => {
      state.kakaoInfoWindow?.setContent(
        `<div style="padding:8px 10px;font-size:12px;"><strong>${escapeHtml(item.name)}</strong><br>${escapeHtml(item.category)} · ${escapeHtml(formatDistanceMeters(item.distance))}</div>`
      );
      state.kakaoInfoWindow?.open(state.buildingMap, marker);
    });
    state.buildingMarkers.push(marker);
    bounds.extend(pos);
  });

  if (state.buildingMarkers.length > 1 && typeof state.buildingMap.setBounds === 'function') {
    state.buildingMap.setBounds(bounds);
  }
}

function isRoadInfoMissing(roadAccess = {}) {
  const d = Number(roadAccess?.contactDistanceMeters);
  const surface = String(roadAccess?.surfaceType || '').trim();
  const ease = String(roadAccess?.ease || '').trim();
  return !Number.isFinite(d) && (!surface || surface === '정보없음') && (!ease || ease === '정보없음');
}

function renderListingDescriptionTemplate(payload) {
  if (!elements.listingDescTransport || !elements.listingDescEducation || !elements.listingDescAmenity) {
    return;
  }
  const summary = payload?.registry?.summary || {};
  const transit = payload?.transit || {};
  const nearbyItems = Array.isArray(payload?.nearbyItems) ? payload.nearbyItems : [];
  const descriptionHints = payload?.descriptionHints || {};

  const subway = transit.subway || {};
  const bus = transit.bus || {};
  const subwayDistance = Number(subway.distanceMeters);
  const busDistance = Number(bus.distanceMeters);
  const subwayLine = subway.name && subway.name !== '-'
    ? `지하철: ${subway.name} · ${formatDistanceMeters(subwayDistance)} · 도보 ${subway.walkMinutes || '-'}분 · 차량 ${subway.driveMinutes || '-'}분`
    : '지하철: 반경 내 확인 필요';
  const busLine = bus.name && bus.name !== '-'
    ? `버스정류장: ${bus.name} · ${formatDistanceMeters(busDistance)} · 도보 ${bus.walkMinutes || '-'}분 · 차량 ${bus.driveMinutes || '-'}분`
    : '버스정류장: 반경 내 확인 필요';
  const stationBalance = Number.isFinite(subwayDistance) && Number.isFinite(busDistance)
    ? `역/정류장 접근 균형: 지하철 ${formatDistanceMeters(subwayDistance)}, 버스 ${formatDistanceMeters(busDistance)}`
    : '';
  const transferHint = subway.name && subway.name !== '-' && bus.name && bus.name !== '-'
    ? `대중교통 환승 동선: ${subway.name} ↔ ${bus.name} 축 중심으로 안내 가능`
    : '';
  const transportLines = [
    bulletLine(subwayLine),
    bulletLine(busLine),
    bulletLine(stationBalance),
    bulletLine(transferHint),
    bulletLine(`주차 여건: 총 주차 ${formatNumberOrDash(summary.parkingCount, '대')}`)
  ].filter(Boolean);

  const schools = transit.schools || {};
  const nearestSchoolNames = [
    schools.elementary?.name,
    schools.middle?.name,
    schools.high?.name
  ].map((v) => String(v || '').trim()).filter((v) => v && v !== '-');

  const hintSchoolNames = Array.isArray(descriptionHints?.schoolsAround)
    ? descriptionHints.schoolsAround.map((v) => String(v || '').trim()).filter(Boolean)
    : [];
  const nearbySchoolNames = [...new Set(
    nearbyItems
      .filter((item) => /학교/.test(String(item?.name || '')) || /school/i.test(String(item?.category || '')))
      .map((item) => String(item.name || '').trim())
      .filter(Boolean)
  )]
    .concat(hintSchoolNames)
    .filter((name) => !nearestSchoolNames.includes(name))
    .slice(0, 3);

  const eduLines = [
    bulletLine(`가까운 초등학교: ${String(schools.elementary?.name || '-').trim() || '-'}`),
    bulletLine(`가까운 중학교: ${String(schools.middle?.name || '-').trim() || '-'}`),
    bulletLine(`가까운 고등학교: ${String(schools.high?.name || '-').trim() || '-'}`),
    bulletLine(`주변 학교: ${nearbySchoolNames.length ? nearbySchoolNames.join(', ') : '확인 필요'}`)
  ].filter(Boolean);

  const pickByKeyword = (keywords = [], limit = 3) => {
    const rows = nearbyItems
      .filter((item) => {
        const text = `${String(item?.name || '')} ${String(item?.category || '')}`;
        return keywords.some((k) => text.includes(k));
      })
      .map((item) => String(item?.name || '').trim())
      .filter(Boolean);
    return [...new Set(rows)].slice(0, limit);
  };

  const fromHintOrLocal = (hintList, fallbackList) => {
    const hint = Array.isArray(hintList) ? hintList.map((v) => String(v || '').trim()).filter(Boolean) : [];
    const merged = [...new Set([...hint, ...fallbackList])];
    return merged.slice(0, 3);
  };

  const mountainNames = fromHintOrLocal(descriptionHints?.mountainPark, pickByKeyword(['산', '공원', '수목원'], 3));
  const deptNames = fromHintOrLocal(descriptionHints?.departmentStore, pickByKeyword(['백화점'], 3));
  const martNames = fromHintOrLocal(descriptionHints?.largeMart, pickByKeyword(['마트', '코스트코', '이마트', '홈플러스', '롯데마트'], 3));
  const libraryNames = fromHintOrLocal(descriptionHints?.library, pickByKeyword(['도서관'], 3));
  const hospitalNames = fromHintOrLocal(descriptionHints?.hospital, pickByKeyword(['병원', '의료원'], 3));

  const amenityLines = [
    bulletLine(`산/공원: ${mountainNames.length ? mountainNames.join(', ') : '확인 필요'}`),
    bulletLine(`백화점: ${deptNames.length ? deptNames.join(', ') : '확인 필요'}`),
    bulletLine(`대형마트: ${martNames.length ? martNames.join(', ') : '확인 필요'}`),
    bulletLine(`도서관: ${libraryNames.length ? libraryNames.join(', ') : '확인 필요'}`),
    bulletLine(`병원: ${hospitalNames.length ? hospitalNames.join(', ') : '확인 필요'}`)
  ].filter(Boolean);

  elements.listingDescTransport.value = transportLines.join('\n');
  elements.listingDescEducation.value = eduLines.join('\n');
  elements.listingDescAmenity.value = amenityLines.join('\n');
}

async function reloadDescriptionDataIfNeeded() {
  if (!state.descriptionNeedsReload) return;
  if (state.descriptionReloadTried) return;
  if (state.descriptionReloading) return;
  const query = String(state.currentBuildingQuery || elements.buildingQuery?.value || '').trim();
  if (!query) return;

  state.descriptionReloading = true;
  state.descriptionReloadTried = true;
  setBuildingStatus('매물설명 보강 정보 재조회 중...', 'loading');
  try {
    const response = await fetch(`/api/location/search?q=${encodeURIComponent(query)}&detail=1`);
    const payload = await response.json();
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || `재조회 실패 (HTTP ${response.status})`);
    }
    renderBuildingSearchResult(payload);
    setBuildingStatus('매물설명 보강 정보 재조회 완료', 'success');
  } catch (error) {
    setBuildingStatus(`매물설명 재조회 실패: ${error.message}`, 'error');
  } finally {
    state.descriptionReloading = false;
  }
}

async function refreshDescriptionSection(sectionName = 'all') {
  const query = String(state.currentBuildingQuery || elements.buildingQuery?.value || '').trim();
  if (!query) {
    setMessage('먼저 주소를 조회해 주세요.', true);
    return;
  }
  setBuildingStatus('매물설명 항목 다시 조회 중...', 'loading');
  try {
    const response = await fetch(`/api/location/search?q=${encodeURIComponent(query)}&detail=1`);
    const payload = await response.json();
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || `재조회 실패 (HTTP ${response.status})`);
    }
    renderListingDescriptionTemplate(payload);
    const labels = {
      transport: '교통',
      education: '교육환경',
      amenity: '자연환경/편의시설',
      all: '전체'
    };
    setBuildingStatus(`${labels[sectionName] || '항목'} 다시 조회 완료`, 'success');
    setMessage(`${labels[sectionName] || '항목'} 설명을 최신 정보로 갱신했습니다.`);
  } catch (error) {
    setBuildingStatus(`항목 재조회 실패: ${error.message}`, 'error');
    setMessage(`항목 재조회 실패: ${error.message}`, true);
  }
}

function renderBuildingSearchResult(payload) {
  const building = payload?.building || {};
  const registry = payload?.registry || {};
  const rebAptId = payload?.rebAptId || {};
  const vworldAptPrice = payload?.vworldAptPrice || {};
  const localCsvAptPrice = payload?.localCsvAptPrice || {};
  const housingPipeline = payload?.housingPipeline || {};
  const registryLinkage = payload?.registryLinkage || {};
  const summary = registry?.summary || {};
  const roadAccess = payload?.roadAccess || {};
  const transit = payload?.transit || {};
  const nearbyItems = payload?.nearbyItems || [];
  const provider = payload?.provider || '-';
  state.descriptionNeedsReload = isRoadInfoMissing(roadAccess);
  const pyeongTypes = buildPyeongChipData(payload?.pyeongTypes || []);
  const pyeongSource = String(payload?.pyeongSource || '-');
  state.buildingVworldPnu = String(vworldAptPrice?.pnu || '');
  state.buildingVworldYear = Number.isFinite(Number(vworldAptPrice?.year)) ? Number(vworldAptPrice.year) : null;
  state.buildingVworldAvailable = Boolean(vworldAptPrice?.available);
  state.buildingSelectedDong = '';
  state.buildingSelectedPyeongKey = '';

  const title = building.fullAddress || building.roadAddress || building.address || building.name || '-';
  const subtitle = building.name || building.address || '-';
  elements.buildingTitle.textContent = title;
  elements.buildingSubtitle.textContent = subtitle;
  elements.buildingUse.textContent = summary.mainPurpose || building.use || building.category || '미지정';
  elements.buildingApprovalDate.textContent = summary.useApprovalDate || '-';
  elements.buildingFloorSummary.textContent = Number.isFinite(Number(summary.groundFloors)) || Number.isFinite(Number(summary.undergroundFloors))
    ? `지상 ${formatNumberOrDash(summary.groundFloors, '층')} / 지하 ${formatNumberOrDash(summary.undergroundFloors, '층')}`
    : '-';
  elements.buildingParkingCount.textContent = formatNumberOrDash(summary.parkingCount, '대');
  elements.buildingResult.hidden = false;

  const issueQuery = encodeURIComponent(building.fullAddress || building.roadAddress || building.address || '');
  elements.buildingIssueLink.href = `https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=15000000098&srchWord=${issueQuery}`;

  const rows = [
    ['건물명', building.name || '미지정'],
    ['도로명주소', building.roadAddress || '-'],
    ['지번주소', building.address || '-'],
    ['건물유형', building.category || '-'],
    ['주용도', summary.mainPurpose || building.use || '-'],
    ['구조', summary.structure || '-'],
    ['사용승인일', summary.useApprovalDate || '-'],
    ['지상층수', formatNumberOrDash(summary.groundFloors, '층')],
    ['지하층수', formatNumberOrDash(summary.undergroundFloors, '층')],
    ['높이', formatNumberOrDash(summary.heightMeters, 'm')],
    ['승용승강기', formatNumberOrDash(summary.passengerElevatorCount, '대')],
    ['주차대수', formatNumberOrDash(summary.parkingCount, '대')],
    ['건축면적', formatArea(summary.buildingArea)],
    ['연면적', formatArea(summary.totalFloorArea)],
    ['관할지역', building.region || '-'],
    ['데이터 제공처', provider],
    ['주변시설 수', `${nearbyItems.length}개`],
    ['좌표', Number.isFinite(Number(building.lat)) && Number.isFinite(Number(building.lng))
      ? `${Number(building.lat).toFixed(6)}, ${Number(building.lng).toFixed(6)}`
      : '-'],
    ['건축물대장 상태', registry.available ? '조회 성공' : `조회 불가 (${registry.reason || 'API 키 확인'})`],
    ['REB 단지식별 상태', rebAptId.available
      ? `조회 성공 (${rebAptId?.complex?.complexName || '-'})`
      : `조회 불가 (${rebAptId.reason || '매칭 없음'})`],
    ['REB 단지고유번호', rebAptId?.complex?.complexPk || '-'],
    ['REB 동 수', formatNumberOrDash(rebAptId?.complex?.dongCount, '개')],
    ['REB 세대수', formatNumberOrDash(rebAptId?.complex?.unitCount, '세대')],
    ['VWorld 공동주택가격 상태', vworldAptPrice.available
      ? `조회 성공 (${formatNumberOrDash(vworldAptPrice.hoCandidates?.length || 0, '건')}, 기준연도 ${vworldAptPrice.year || '-'})`
      : `조회 불가 (${vworldAptPrice.reason || '매칭 없음'})`],
    ['VWorld PNU', vworldAptPrice.pnu || '-'],
    ['로컬 CSV 상태', localCsvAptPrice.available
      ? `조회 성공 (${formatNumberOrDash(localCsvAptPrice.hoCandidates?.length || 0, '건')})`
      : `조회 불가 (${localCsvAptPrice.reason || '매칭 없음'})`],
    ['로컬 CSV 파일', localCsvAptPrice.filePath || '-'],
    ['평형 원천', pyeongSource],
    ['평형정보', pyeongTypes.length
      ? `<div class="pyeong-chip-list">${pyeongTypes.map((item) => {
        const supply = Number(item.areaSqm);
        const supplyLabel = Number.isFinite(supply)
          ? `공급 ${supply.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}㎡`
          : '공급 -';
        return `<button type="button" class="pyeong-chip" data-pyeong-key="${escapeHtml(item.key)}">${escapeHtml(item.label)} (${escapeHtml(supplyLabel)}) (${escapeHtml(String(item.unitCount))}세대)</button>`;
      }).join('')}</div>`
      : '-'],
    ['건축물대장 디버그', registry?.debug
      ? `title:${registry.debug.titleCount}, recap:${registry.debug.recapCount}, floor:${registry.debug.floorCount}, exclusive:${registry.debug.exclusiveCount}`
      : '-'],
    ['동/호 보강 소스', housingPipeline?.source || '-'],
    ['등기 연계 가능', registryLinkage?.usableForRegistryWorkflow ? '가능' : '제한'],
    ['등기 연계 신뢰도', registryLinkage?.confidence || '-'],
    ['등기 연계 원천', registryLinkage?.sourceType || '-'],
    ['필지 키', registryLinkage?.parcelKey
      ? `${registryLinkage.parcelKey.sigunguCd}-${registryLinkage.parcelKey.bjdongCd}-${registryLinkage.parcelKey.platGbCd}-${registryLinkage.parcelKey.bun}-${registryLinkage.parcelKey.ji}`
      : '-'],
    ['등기 연계 메모', registryLinkage?.note || '-'],
    ['상세정보 링크', building.placeUrl ? `<a href="${escapeHtml(building.placeUrl)}" target="_blank" rel="noreferrer">바로가기</a>` : '-']
  ];

  elements.buildingOverviewBody.innerHTML = rows
    .map(([label, value]) => {
      const safeValue = String(value).startsWith('<')
        ? value
        : escapeHtml(value);
      return `<tr><th>${escapeHtml(label)}</th><td>${safeValue}</td></tr>`;
    })
    .join('');

  const dongInfoPrimary = registry?.dongInfo || [];
  const hoInfoPrimary = registry?.hoInfo || [];
  const dongInfo = (housingPipeline?.dongCandidates || []).length
    ? (housingPipeline?.dongCandidates || [])
    : dongInfoPrimary;
  const hoInfo = (housingPipeline?.hoCandidates || []).length
    ? (housingPipeline?.hoCandidates || [])
    : hoInfoPrimary;
  state.buildingHoFallbackList = Array.isArray(hoInfo) ? [...hoInfo] : [];
  const dongHoNote = registryLinkage?.note || housingPipeline?.note || registry?.reason || '(해당 주소에서 동/호 데이터 미제공)';
  const isVworldSource = String(housingPipeline?.source || '') === 'vworld-apt-price';
  const usesOriginalSource = Boolean(dongInfoPrimary.length || hoInfoPrimary.length || isVworldSource);
  const sourceBadge = getSourceBadgeMeta(usesOriginalSource ? (isVworldSource ? 'vworld' : 'registry') : 'rtms');
  const originalCount = hoInfo.filter((item) => {
    const s = String(item?.source || '').toLowerCase();
    return s === 'registry' || s === 'vworld';
  }).length;
  const fallbackCount = hoInfo.length - originalCount;
  if (elements.buildingDongHoSummary) {
    elements.buildingDongHoSummary.innerHTML = `
      <span class="building-source-chip source-original">원본: 건축물대장</span>
      <span class="building-source-chip source-fallback">보강: 실거래/추정</span>
      <span class="building-source-note">현재 결과: ${escapeHtml(sourceBadge.label)} 데이터 중심 · 원본 ${escapeHtml(String(originalCount))}건 / 보강 ${escapeHtml(String(Math.max(0, fallbackCount)))}건</span>
    `;
  }

  elements.buildingDongList.innerHTML = dongInfo.length
    ? dongInfo.map((item) => {
      const floorRange = item.minFloor !== null && item.maxFloor !== null
        ? `${item.minFloor}~${item.maxFloor}층`
        : '-';
      const badge = getSourceBadgeMeta(item.source || (usesOriginalSource ? 'registry' : 'rtms'));
      const dongName = String(item.dongName || '').trim();
      return `<button type="button" class="building-simple-item building-dong-item" data-dong-name="${escapeHtml(dongName)}"><div class="building-item-head"><strong>${escapeHtml(item.dongName)}</strong><span class="building-source-chip ${badge.className}">${badge.label}</span></div><br>층 구성: ${escapeHtml(floorRange)} · 레코드 ${escapeHtml(String(item.floorCount))}건</button>`;
    }).join('')
    : `<p class="hint">동 정보가 없습니다. ${escapeHtml(dongHoNote)}</p>`;

  renderBuildingHoList(hoInfo, `호 정보가 없습니다. ${dongHoNote}`);

  const bus = transit.bus || {};
  const subway = transit.subway || {};
  const parking = transit.parking || {};
  const schools = transit.schools || {};
  const indoorParkingCount = formatNumberOrDash(summary.parkingCount, '대');

  elements.buildingTransitSummary.innerHTML = `
    <div class="facility-board">
      <section class="facility-row">
        <div class="facility-category">대중교통</div>
        <div class="facility-content">
          <div class="facility-line">
            <div class="facility-key">버스</div>
            <div class="facility-value">${renderTransitInfo(bus, '반경 내 없음')}</div>
          </div>
          <div class="facility-line">
            <div class="facility-key">지하철</div>
            <div class="facility-value">${renderTransitInfo(subway, '반경 내 없음')}</div>
          </div>
        </div>
      </section>
      <section class="facility-row">
        <div class="facility-category">주차장</div>
        <div class="facility-content">
          <div class="facility-line">
            <div class="facility-key">전용주차</div>
            <div class="facility-value"><strong>${escapeHtml(indoorParkingCount)}</strong></div>
          </div>
          <div class="facility-line">
            <div class="facility-key">인근주차장</div>
            <div class="facility-value">${renderTransitInfo(parking, '반경 내 없음')}</div>
          </div>
        </div>
      </section>
      <section class="facility-row">
        <div class="facility-category">교육시설</div>
        <div class="facility-content">
          <div class="facility-line">
            <div class="facility-key">초등학교</div>
            <div class="facility-value">${renderTransitInfo(schools.elementary, '반경 내 없음')}</div>
          </div>
          <div class="facility-line">
            <div class="facility-key">중학교</div>
            <div class="facility-value">${renderTransitInfo(schools.middle, '반경 내 없음')}</div>
          </div>
          <div class="facility-line">
            <div class="facility-key">고등학교</div>
            <div class="facility-value">${renderTransitInfo(schools.high, '반경 내 없음')}</div>
          </div>
        </div>
      </section>
    </div>
  `;

  renderListingDescriptionTemplate(payload);

  if (elements.buildingNearbyList) {
    if (!nearbyItems.length) {
      elements.buildingNearbyList.innerHTML = '<p class="hint">주변시설이 검색되지 않았습니다.</p>';
    } else {
      elements.buildingNearbyList.innerHTML = nearbyItems.map((item) => {
        const walk = Number.isFinite(item.walkMinutes) ? `도보 ${item.walkMinutes}분` : '도보 -';
        const drive = Number.isFinite(item.driveMinutes) ? `차량 ${item.driveMinutes}분` : '차량 -';
        const address = item.roadAddress || item.address || '-';
        return `<article class="nearby-item">
          <h3>${escapeHtml(item.name)}</h3>
          <div class="nearby-meta">${escapeHtml(item.category)} · ${escapeHtml(formatDistanceMeters(item.distance))}</div>
          <div class="nearby-meta">${escapeHtml(address)}</div>
          <div class="nearby-meta">${walk} · ${drive}</div>
        </article>`;
      }).join('');
    }
  }

  void renderBuildingMap(building, nearbyItems).catch((error) => {
    setMessage(`지도 로딩 실패: ${error.message}`, true);
  });
}

async function runBuildingSearch(forcedQuery = '') {
  const query = String(forcedQuery || elements.buildingQuery.value || '').trim();
  if (!query) {
    setMessage('주소를 입력해 주세요.', true);
    setBuildingStatus('주소를 입력해 주세요.', 'error');
    return;
  }

  elements.buildingSearchButton.disabled = true;
  state.currentBuildingQuery = query;
  state.descriptionReloadTried = false;
  state.descriptionReloading = false;
  setMessage('주소/건물 정보를 조회 중입니다...');
  setBuildingStatus('조회중입니다...', 'loading');

  try {
    const response = await fetch(`/api/location/search?q=${encodeURIComponent(query)}&detail=1`);
    let payload = null;
    try {
      payload = await response.json();
    } catch (_jsonError) {
      throw new Error(`서버 응답 파싱 실패 (HTTP ${response.status})`);
    }
    if (!response.ok || !payload?.ok) {
      const serverError = payload?.error || payload?.detail?.msg || payload?.detail?.error || '';
      throw new Error(serverError || `검색에 실패했습니다. (HTTP ${response.status})`);
    }
    renderBuildingSearchResult(payload);
    clearBuildingSuggestions();
    setMessage(`완료: "${query}" 조회 결과를 불러왔습니다.`);
    if (payload?.registry && payload.registry.available === false) {
      setBuildingStatus(`건축물대장 조회 실패: ${payload.registry.reason || '원인 미상'}`, 'error');
    } else {
      setBuildingStatus(`조회 완료: "${query}"`, 'success');
    }
  } catch (error) {
    elements.buildingResult.hidden = true;
    setMessage(`주소 검색 실패: ${error.message}`, true);
    setBuildingStatus(`조회 실패: ${error.message}`, 'error');
  } finally {
    elements.buildingSearchButton.disabled = false;
  }
}

function renderBuildingHoList(items, emptyText) {
  const list = Array.isArray(items) ? items : [];
  const selectedKey = String(state.buildingSelectedPyeongKey || '');
  const filtered = selectedKey
    ? list.filter((item) => getPyeongFilterKeyFromArea(item.areaSquareMeter) === selectedKey)
    : list;

  const uniqueMap = new Map();
  filtered.forEach((item) => {
    const dong = String(item?.dongName || '').trim() || '동 미상';
    const ho = String(item?.hoName || '').trim();
    if (!ho) return;
    const key = `${dong}|${ho}`;
    if (!uniqueMap.has(key)) uniqueMap.set(key, { ...item, dongName: dong, hoName: ho });
  });
  const uniqueRows = [...uniqueMap.values()].sort((a, b) => {
    const dongA = String(a?.dongName || '');
    const dongB = String(b?.dongName || '');
    const dongNumA = Number((dongA.match(/\d+/) || [])[0]);
    const dongNumB = Number((dongB.match(/\d+/) || [])[0]);
    if (Number.isFinite(dongNumA) && Number.isFinite(dongNumB) && dongNumA !== dongNumB) return dongNumA - dongNumB;
    const dongCmp = dongA.localeCompare(dongB, 'ko');
    if (dongCmp !== 0) return dongCmp;
    const hoA = String(a?.hoName || '');
    const hoB = String(b?.hoName || '');
    const hoNumA = Number((hoA.match(/\d+/) || [])[0]);
    const hoNumB = Number((hoB.match(/\d+/) || [])[0]);
    if (Number.isFinite(hoNumA) && Number.isFinite(hoNumB) && hoNumA !== hoNumB) return hoNumA - hoNumB;
    return hoA.localeCompare(hoB, 'ko');
  });

  if (!uniqueRows.length) {
    elements.buildingHoList.innerHTML = `<p class="hint">${escapeHtml(emptyText || '호 정보가 없습니다.')}</p>`;
    return;
  }
  elements.buildingHoList.innerHTML = uniqueRows.slice(0, 1000).map((item) => {
    const badge = getSourceBadgeMeta(item.source || 'fallback');
    const hasRawSupply = Number.isFinite(Number(item.supplyAreaSquareMeter ?? item.supplyArea));
    const pyeongText = item.pyeongLabel
      ? String(item.pyeongLabel)
      : (Number.isFinite(Number(item.areaSquareMeter))
        ? `${(Number(item.areaSquareMeter) / 3.3058).toFixed(1)}평`
        : '');
    const exclusiveSqm = Number(item.exclusiveAreaSquareMeter ?? item.areaSquareMeter);
    const supplySqm = Number(item.supplyAreaSquareMeter ?? item.supplyArea ?? NaN);
    const supplyBadge = getSupplyBadgeMeta(item, hasRawSupply);
    const exclusiveText = Number.isFinite(exclusiveSqm)
      ? `전용 ${exclusiveSqm.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}㎡`
      : '전용 -';
    const supplyText = Number.isFinite(supplySqm)
      ? `공급 ${supplySqm.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}㎡`
      : '공급 -';
    const suffixParts = [pyeongText, supplyText, exclusiveText].filter(Boolean).join(', ');
    const suffix = suffixParts ? ` (${escapeHtml(suffixParts)})` : '';
    return `<div class="building-simple-item"><div class="building-item-head"><strong>${escapeHtml(item.dongName)} ${escapeHtml(item.hoName)}${suffix}</strong><span class="building-chip-group"><span class="building-source-chip ${badge.className}">${badge.label}</span><span class="building-source-chip ${supplyBadge.sourceClassName}">${escapeHtml(supplyBadge.sourceLabel)}</span><span class="building-source-chip ${supplyBadge.confidenceClassName}">${escapeHtml(supplyBadge.confidenceLabel)}</span></span></div></div>`;
  }).join('');
}

function closeListingModal() {
  if (!elements.listingModal) return;
  elements.listingModal.hidden = true;
  document.body.style.overflow = '';
}

function getActiveChipValue(groupName) {
  const active = document.querySelector(`[data-chip-group="${groupName}"] .listing-chip.active`);
  return String(active?.textContent || '').trim();
}

function encodeAutofillPayload(payload) {
  const json = JSON.stringify(payload || {});
  return btoa(unescape(encodeURIComponent(json)));
}

function updateAutofillStartButton() {
  if (!elements.listingAutofillStartBtn) return;
  elements.listingAutofillStartBtn.disabled = !state.listingDraft;
}

function openListingModal(unit = {}) {
  if (!elements.listingModal) return;
  state.listingTargetUnit = unit;
  const dongName = String(unit?.dongName || '').trim() || '동 미상';
  const hoName = String(unit?.hoName || '').trim() || '-';
  const pyeongLabel = String(unit?.pyeongLabel || '').trim();
  const supply = Number(unit?.supplySqm);
  const exclusive = Number(unit?.exclusiveSqm);
  const summaryParts = [];
  if (pyeongLabel) summaryParts.push(pyeongLabel);
  summaryParts.push(`공급 ${Number.isFinite(supply) ? `${supply.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}㎡` : '-'}`);
  summaryParts.push(`전용 ${Number.isFinite(exclusive) ? `${exclusive.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}㎡` : '-'}`);
  if (elements.listingModalUnit) {
    elements.listingModalUnit.textContent = `${dongName} ${hoName} (${summaryParts.join(', ')})`;
  }
  elements.listingModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

async function loadVworldDongHoList(dongName) {
  const pnu = String(state.buildingVworldPnu || '').trim();
  const stdrYear = Number(state.buildingVworldYear || 0);
  const dongNm = normalizeDongForApi(dongName);
  if (!pnu || !dongNm) return;
  setBuildingStatus(`"${dongName}" 동 호수(공시가격) 조회 중...`, 'loading');
  const url = `/api/vworld/apart-price/hos?pnu=${encodeURIComponent(pnu)}&stdrYear=${encodeURIComponent(String(stdrYear || ''))}&dongNm=${encodeURIComponent(dongNm)}`;
  try {
    const response = await fetch(url);
    const payload = await response.json();
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || 'VWorld 조회 실패');
    }
    state.buildingHoFallbackList = Array.isArray(payload.rows) ? [...payload.rows] : [];
    renderBuildingHoList(state.buildingHoFallbackList, `선택한 동(${dongName})에서 공시가격 호수 데이터를 찾지 못했습니다.`);
    setBuildingStatus(`"${dongName}" 동 공시가격 호수 ${payload?.count || 0}건`, 'success');
  } catch (error) {
    setBuildingStatus(`VWorld 동별 조회 실패: ${error.message}`, 'error');
  }
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((c) => `${c}${c}`).join('')
    : normalized;

  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16)
  };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('이미지 파일 형식이 올바르지 않습니다.'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('결과 파일 생성에 실패했습니다.'));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

function buildCanvasFromImage(image) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { canvas, ctx };
}

function sampleCornerColor(ctx, width, height) {
  const points = [
    [0, 0],
    [Math.max(width - 1, 0), 0],
    [0, Math.max(height - 1, 0)],
    [Math.max(width - 1, 0), Math.max(height - 1, 0)]
  ];
  const total = { r: 0, g: 0, b: 0 };

  points.forEach(([x, y]) => {
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    total.r += pixel[0];
    total.g += pixel[1];
    total.b += pixel[2];
  });

  return {
    r: Math.round(total.r / points.length),
    g: Math.round(total.g / points.length),
    b: Math.round(total.b / points.length)
  };
}

function applyBackgroundTransparency(ctx, width, height, color, tolerance) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  let transparentCount = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    const dr = pixels[i] - color.r;
    const dg = pixels[i + 1] - color.g;
    const db = pixels[i + 2] - color.b;
    const distance = Math.sqrt((dr * dr) + (dg * dg) + (db * db));

    if (distance <= tolerance) {
      pixels[i + 3] = 0;
      transparentCount += 1;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return transparentCount;
}

function resolveCompressOutputType(inputType) {
  const selected = elements.compressFormat.value;
  if (selected !== 'auto') return selected;
  if (inputType === 'image/png' || inputType === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

function resolveUpscaleOutputType(inputType) {
  const selected = elements.upscaleFormat.value;
  if (selected !== 'auto') return selected;
  if (inputType === 'image/png') return 'image/png';
  if (inputType === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

async function compressUnder2MB(image, outputType) {
  const { canvas } = buildCanvasFromImage(image);

  if (outputType === 'image/png') {
    const blob = await canvasToBlob(canvas, outputType, 1);
    if (blob.size < TARGET_BYTES) return blob;
    throw new Error('PNG 포맷으로는 2MB 미만이 어려울 수 있습니다. WEBP/JPEG를 사용하세요.');
  }

  let low = 0.2;
  let high = 0.95;
  let best = null;

  for (let i = 0; i < 10; i += 1) {
    const quality = (low + high) / 2;
    const blob = await canvasToBlob(canvas, outputType, quality);

    if (blob.size < TARGET_BYTES) {
      best = blob;
      low = quality;
    } else {
      high = quality;
    }
  }

  if (best) return best;

  const fallback = await canvasToBlob(canvas, outputType, 0.15);
  if (fallback.size < TARGET_BYTES) return fallback;

  throw new Error('2MB 미만으로 줄일 수 없습니다.');
}

async function upscaleImage2x(image, outputType, enhanceOptions) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth * 2;
  canvas.height = image.naturalHeight * 2;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  applyUnsharpMask(ctx, canvas.width, canvas.height, Math.max(0, enhanceOptions.sharpen * 0.65));
  applyVignette(ctx, canvas.width, canvas.height, enhanceOptions.vignette);

  if (outputType === 'image/png') return canvasToBlob(canvas, outputType, 1);
  return canvasToBlob(canvas, outputType, 0.98);
}

function clamp255(v) {
  return v < 0 ? 0 : (v > 255 ? 255 : v);
}

function applyUnsharpMask(ctx, width, height, amount = 0.7) {
  const original = ctx.getImageData(0, 0, width, height);
  const src = original.data;
  const blurred = new Uint8ClampedArray(src.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let yy = -1; yy <= 1; yy += 1) {
        const py = y + yy;
        if (py < 0 || py >= height) continue;
        for (let xx = -1; xx <= 1; xx += 1) {
          const px = x + xx;
          if (px < 0 || px >= width) continue;
          const idx = (py * width + px) * 4;
          r += src[idx];
          g += src[idx + 1];
          b += src[idx + 2];
          a += src[idx + 3];
          count += 1;
        }
      }
      const outIdx = (y * width + x) * 4;
      blurred[outIdx] = Math.round(r / count);
      blurred[outIdx + 1] = Math.round(g / count);
      blurred[outIdx + 2] = Math.round(b / count);
      blurred[outIdx + 3] = Math.round(a / count);
    }
  }

  for (let i = 0; i < src.length; i += 4) {
    src[i] = clamp255(src[i] + amount * (src[i] - blurred[i]));
    src[i + 1] = clamp255(src[i + 1] + amount * (src[i + 1] - blurred[i + 1]));
    src[i + 2] = clamp255(src[i + 2] + amount * (src[i + 2] - blurred[i + 2]));
  }

  ctx.putImageData(original, 0, 0);
}

function applyVignette(ctx, width, height, strength = 0.18) {
  if (!strength || strength <= 0) return;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.sqrt((cx * cx) + (cy * cy));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt((dx * dx) + (dy * dy)) / maxDist;
      const falloff = d * d;
      const mult = 1 - (strength * falloff);
      data[idx] = clamp255(Math.round(data[idx] * mult));
      data[idx + 1] = clamp255(Math.round(data[idx + 1] * mult));
      data[idx + 2] = clamp255(Math.round(data[idx + 2] * mult));
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

async function getAiUpscaler() {
  if (state.aiUpscalerFactory && state.aiUpscalerModel) {
    return { Upscaler: state.aiUpscalerFactory, model: state.aiUpscalerModel };
  }

  const [upscalerMod, modelMod] = await Promise.all([
    import('https://cdn.jsdelivr.net/npm/upscaler@1.0.0/+esm'),
    import('https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-slim@1.0.0/+esm')
  ]);
  const Upscaler = upscalerMod.default || upscalerMod.Upscaler;
  const model = modelMod.default || modelMod;
  if (!Upscaler || !model) {
    throw new Error('AI 업스케일 모듈 로딩 실패');
  }

  state.aiUpscalerFactory = Upscaler;
  state.aiUpscalerModel = model;
  return { Upscaler, model };
}

async function upscaleImage2xWithAI(image, outputType, enhanceOptions) {
  const { Upscaler, model } = await getAiUpscaler();
  const upscaler = new Upscaler({ model });
  try {
    const upscaledCanvas = await upscaler.upscale(image, {
      output: 'canvas',
      patchSize: 128,
      padding: 2
    });
    const canvas = upscaledCanvas instanceof HTMLCanvasElement ? upscaledCanvas : null;
    if (!canvas) throw new Error('AI 업스케일 결과를 캔버스로 받지 못했습니다.');
    const ctx = canvas.getContext('2d');
    applyUnsharpMask(ctx, canvas.width, canvas.height, Math.max(0, enhanceOptions.sharpen * 0.45));
    applyVignette(ctx, canvas.width, canvas.height, enhanceOptions.vignette);
    if (outputType === 'image/png') return canvasToBlob(canvas, outputType, 1);
    return canvasToBlob(canvas, outputType, 0.98);
  } finally {
    if (typeof upscaler.dispose === 'function') await upscaler.dispose();
  }
}

async function removeBackgroundAlpha(image) {
  const { canvas, ctx } = buildCanvasFromImage(image);
  const color = elements.transparentMode.value === 'auto'
    ? sampleCornerColor(ctx, canvas.width, canvas.height)
    : hexToRgb(elements.transparentColor.value || '#ffffff');
  const tolerance = Number(elements.transparentTolerance.value || 45);
  const outputType = elements.transparentFormat.value;

  const transparentPixels = applyBackgroundTransparency(ctx, canvas.width, canvas.height, color, tolerance);
  const blob = outputType === 'image/webp'
    ? await canvasToBlob(canvas, outputType, 0.95)
    : await canvasToBlob(canvas, outputType, 1);

  return { blob, outputType, transparentPixels };
}

async function getAiBackgroundRemover() {
  if (state.aiRemoveBackgroundFn) return state.aiRemoveBackgroundFn;
  const mod = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal/+esm');
  const fn = mod.removeBackground || mod.default?.removeBackground;
  if (!fn) throw new Error('AI 배경 제거 모듈 로딩에 실패했습니다.');
  state.aiRemoveBackgroundFn = fn;
  return fn;
}

async function removeBackgroundWithAI(file) {
  const outputType = elements.transparentFormat.value;
  const removeBackground = await getAiBackgroundRemover();
  const modelCandidates = ['large', 'medium'];
  let lastError = null;

  for (const model of modelCandidates) {
    try {
      const rawBlob = await removeBackground(file, {
        model,
        output: {
          format: outputType,
          quality: 1,
          type: 'foreground'
        }
      });
      const refinedBlob = await refineAiMask(rawBlob, outputType);
      return { blob: refinedBlob, outputType };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('AI 배경 제거에 실패했습니다.');
}

function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('AI 결과 이미지를 읽지 못했습니다.'));
    };
    img.src = url;
  });
}

async function refineAiMask(blob, outputType) {
  const image = await loadImageFromBlob(blob);
  const { canvas, ctx } = buildCanvasFromImage(image);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const width = canvas.width;
  const height = canvas.height;

  // Edge cleanup: remove tiny speckles and reduce bright fringe on semi-transparent pixels.
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = (y * width + x) * 4;
      let a = data[idx + 3];
      if (a < 6) {
        data[idx + 3] = 0;
        continue;
      }
      if (a > 249) {
        data[idx + 3] = 255;
        continue;
      }

      let strongNeighbors = 0;
      for (let yy = -1; yy <= 1; yy += 1) {
        for (let xx = -1; xx <= 1; xx += 1) {
          if (xx === 0 && yy === 0) continue;
          const nIdx = ((y + yy) * width + (x + xx)) * 4;
          if (data[nIdx + 3] > 40) strongNeighbors += 1;
        }
      }

      if (a < 18 && strongNeighbors <= 1) {
        data[idx + 3] = 0;
        continue;
      }

      const alphaFactor = Math.min(1, a / 220);
      data[idx] = Math.round(data[idx] * alphaFactor);
      data[idx + 1] = Math.round(data[idx + 1] * alphaFactor);
      data[idx + 2] = Math.round(data[idx + 2] * alphaFactor);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return outputType === 'image/webp'
    ? canvasToBlob(canvas, outputType, 1)
    : canvasToBlob(canvas, outputType, 1);
}

function renderResult(fileSize, fromLabel, blob, toLabel, outputType, opts = {}) {
  const ratio = ((1 - blob.size / fileSize) * 100).toFixed(1);
  const objectUrl = URL.createObjectURL(blob);
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  state.previewUrl = objectUrl;

  elements.result.hidden = false;
  elements.originalMeta.textContent = fromLabel;
  elements.compressedMeta.textContent = toLabel;
  elements.savedMeta.textContent = Number.isFinite(Number(ratio))
    ? (blob.size <= fileSize ? `${ratio}% 감소` : `${Math.abs(Number(ratio)).toFixed(1)}% 증가`)
    : '-';

  elements.compareWrap.hidden = true;
  elements.previewWrap.hidden = !opts.showPreview;
  if (opts.showPreview) elements.preview.src = objectUrl;

  elements.downloadLink.href = objectUrl;
  elements.downloadLink.download = opts.downloadName || `result.${outputExtension(outputType)}`;
}

async function createPixelated2xBlob(file, outputType = 'image/png') {
  const image = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth * 2;
  canvas.height = image.naturalHeight * 2;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvasToBlob(canvas, outputType, 1);
}

async function renderUpscaleCompare(beforeFile, afterBlob, meta) {
  if (state.compareBeforeUrl) URL.revokeObjectURL(state.compareBeforeUrl);
  if (state.compareAfterUrl) URL.revokeObjectURL(state.compareAfterUrl);
  const before2x = await createPixelated2xBlob(beforeFile, 'image/png');
  state.compareBeforeUrl = URL.createObjectURL(before2x);
  state.compareAfterUrl = URL.createObjectURL(afterBlob);

  elements.compareBefore.src = state.compareBeforeUrl;
  elements.compareAfter.src = state.compareAfterUrl;
  elements.compareBeforeMeta.textContent = `전 ${meta.beforeWidth}x${meta.beforeHeight}`;
  elements.compareAfterMeta.textContent = `후 ${meta.afterWidth}x${meta.afterHeight}`;
  elements.compareMethodLabel.textContent = meta.methodLabel;
  elements.compareSizeLabel.textContent = `${meta.beforeWidth}x${meta.beforeHeight} → ${meta.afterWidth}x${meta.afterHeight}`;
  elements.compareSlider.value = '50';
  updateCompareSlider();
  elements.previewWrap.hidden = true;
  elements.compareWrap.hidden = false;
}

function updateCompareSlider() {
  const ratio = Number(elements.compareSlider.value || 50);
  elements.compareAfterClip.style.width = `${ratio}%`;
  elements.compareDivider.style.left = `${ratio}%`;
  elements.compareHandle.style.left = `${ratio}%`;
}

function bindCompareDrag() {
  let dragging = false;

  const move = (clientX) => {
    const rect = elements.compareStage.getBoundingClientRect();
    const px = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const ratio = (px / rect.width) * 100;
    elements.compareSlider.value = String(Math.round(ratio));
    updateCompareSlider();
  };

  const onPointerMove = (event) => {
    if (!dragging) return;
    move(event.clientX);
  };

  const onPointerUp = () => {
    dragging = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };

  const start = (event) => {
    dragging = true;
    move(event.clientX);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  elements.compareHandle.addEventListener('pointerdown', start);
  elements.compareStage.addEventListener('pointerdown', start);
}

function clearBatchDownloadList() {
  state.batchUrls.forEach((url) => URL.revokeObjectURL(url));
  state.batchUrls = [];
  elements.imageBatchResults.innerHTML = '';
}

function renderBatchDownloadList(items) {
  if (!items.length) {
    elements.imageBatchResults.innerHTML = '';
    return;
  }

  elements.imageBatchResults.innerHTML = items.map((item) => {
    const url = URL.createObjectURL(item.blob);
    state.batchUrls.push(url);
    return `<div class="pdf-item"><span>${item.name} (${formatBytes(item.blob.size)})</span><a class="btn btn-mini" href="${url}" download="${item.name}">다운로드</a></div>`;
  }).join('');
}

function ensurePdfJsReady() {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) {
    throw new Error('PDF 미리보기 라이브러리 로딩 실패: 새로고침 후 다시 시도해 주세요.');
  }

  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  return pdfjsLib;
}

function updatePdfActionState() {
  const hasText = Boolean((elements.pdfText.value || '').trim());
  elements.pdfAddButton.disabled = !(state.pdfFile && hasText);
  elements.pdfSignButton.disabled = !(state.pdfFile && state.pdfItems.length > 0);
}

function renderPdfItemsList() {
  if (!state.pdfItems.length) {
    elements.pdfItems.innerHTML = '<p class="hint">추가된 텍스트 박스가 없습니다.</p>';
    return;
  }

  elements.pdfItems.innerHTML = state.pdfItems.map((item, index) => {
    const preview = item.text.length > 24 ? `${item.text.slice(0, 24)}...` : item.text;
    return `<div class="pdf-item" data-id="${item.id}">
      <span>${index + 1}. p${item.page} (${item.x}, ${item.y}) ${preview.replace(/</g, '&lt;')}</span>
      <button class="btn btn-mini" type="button" data-remove-id="${item.id}">삭제</button>
    </div>`;
  }).join('');
}

function clearPdfSelection() {
  state.pdfBoxWidth = null;
  state.pdfSelecting = false;
  state.pdfDragStart = null;
  elements.pdfSelection.hidden = true;
}

function splitLinesForWidth(ctx, line, maxWidth) {
  if (!maxWidth || maxWidth <= 0) return [line];
  const words = line.split(/\s+/);
  const out = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (!current || ctx.measureText(next).width <= maxWidth) {
      current = next;
      return;
    }
    out.push(current);
    current = word;
  });

  if (current) out.push(current);
  return out.length ? out : [''];
}

function drawTextAt(ctx, text, x, y, fontSize, maxWidth, color = '#111111') {
  const lineHeight = fontSize * 1.2;
  ctx.save();
  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';

  let drawY = y;
  text.split('\n').forEach((rawLine) => {
    const lines = splitLinesForWidth(ctx, rawLine, maxWidth);
    lines.forEach((line) => {
      ctx.fillText(line, x, drawY);
      drawY += lineHeight;
    });
  });
  ctx.restore();
}

function drawPdfTextOverlay() {
  if (!state.pdfBaseImageData) return;

  const canvas = elements.pdfCanvas;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(state.pdfBaseImageData, 0, 0);

  const pageNumber = Number(elements.pdfPage.value || 1);
  state.pdfItems
    .filter((item) => item.page === pageNumber)
    .forEach((item) => {
      drawTextAt(
        ctx,
        item.text,
        item.x * state.pdfScale,
        canvas.height - (item.y * state.pdfScale),
        item.fontSize * state.pdfScale,
        item.maxWidth ? item.maxWidth * state.pdfScale : null,
        '#111111'
      );
    });

  const draftText = (elements.pdfText.value || '').trim();
  if (!draftText) return;

  drawTextAt(
    ctx,
    draftText,
    Number(elements.pdfX.value || 0) * state.pdfScale,
    canvas.height - (Number(elements.pdfY.value || 0) * state.pdfScale),
    Math.max(8, Number(elements.pdfFontSize.value || 18)) * state.pdfScale,
    state.pdfBoxWidth ? state.pdfBoxWidth * state.pdfScale : null
  );
}

function updateSelectionVisual(left, top, width, height) {
  elements.pdfSelection.hidden = false;
  elements.pdfSelection.style.left = `${left}px`;
  elements.pdfSelection.style.top = `${top}px`;
  elements.pdfSelection.style.width = `${width}px`;
  elements.pdfSelection.style.height = `${height}px`;
}

function getCanvasPoint(event) {
  const rect = elements.pdfCanvas.getBoundingClientRect();
  const scaleX = elements.pdfCanvas.width / rect.width;
  const scaleY = elements.pdfCanvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  return {
    x: Math.max(0, Math.min(elements.pdfCanvas.width, x)),
    y: Math.max(0, Math.min(elements.pdfCanvas.height, y))
  };
}

async function renderPdfPage(pageNumber, options = {}) {
  if (!state.pdfArrayBuffer) return;

  const pdfjsLib = ensurePdfJsReady();
  if (!state.pdfPreviewDoc) {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(state.pdfArrayBuffer.slice(0))
    });
    state.pdfPreviewDoc = await loadingTask.promise;
  }

  const validPage = Math.max(1, Math.min(pageNumber, state.pdfPreviewDoc.numPages));
  elements.pdfPage.value = String(validPage);

  const page = await state.pdfPreviewDoc.getPage(validPage);
  const viewport = page.getViewport({ scale: state.pdfScale });
  const canvas = elements.pdfCanvas;
  const ctx = canvas.getContext('2d');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({ canvasContext: ctx, viewport }).promise;
  state.pdfBaseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (!options.keepSelection) clearPdfSelection();
  drawPdfTextOverlay();
}

async function loadPdfMeta(file) {
  const { PDFDocument } = window.PDFLib || {};
  if (!PDFDocument) throw new Error('PDF 기능 로딩 실패: 페이지를 새로고침해 주세요.');

  const arrayBuffer = await file.arrayBuffer();
  const doc = await PDFDocument.load(new Uint8Array(arrayBuffer.slice(0)));
  return { pages: doc.getPageCount(), arrayBuffer };
}

async function writeTextToPdf() {
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib || {};
  if (!PDFDocument) throw new Error('PDF 기능 로딩 실패: 페이지를 새로고침해 주세요.');
  if (!state.pdfArrayBuffer || !state.pdfFile) throw new Error('PDF 파일을 선택해 주세요.');

  const pdfDoc = await PDFDocument.load(new Uint8Array(state.pdfArrayBuffer.slice(0)));
  const pageCount = pdfDoc.getPageCount();
  if (!state.pdfItems.length) throw new Error('텍스트 박스를 먼저 추가해 주세요.');
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  state.pdfItems.forEach((item) => {
    if (!Number.isInteger(item.page) || item.page < 1 || item.page > pageCount) return;
    const page = pdfDoc.getPage(item.page - 1);
    const drawOptions = {
      x: item.x,
      y: item.y,
      size: item.fontSize,
      font,
      color: rgb(0, 0, 0),
      lineHeight: item.fontSize * 1.2
    };

    if (item.maxWidth && Number.isFinite(item.maxWidth) && item.maxWidth > 0) {
      drawOptions.maxWidth = item.maxWidth;
    }
    page.drawText(item.text, drawOptions);
  });

  const output = await pdfDoc.save();
  return {
    blob: new Blob([output], { type: 'application/pdf' }),
    pages: pageCount
  };
}

function onImageFilesSelected(files) {
  const list = Array.from(files || []);
  if (!list.length) return;
  if (list.some((file) => !file.type.startsWith('image/'))) {
    setMessage('이미지 파일만 업로드할 수 있습니다.', true);
    return;
  }

  state.imageFiles = list;
  elements.result.hidden = true;
  clearBatchDownloadList();
  elements.compressButton.disabled = false;
  elements.transparentButton.disabled = false;
  elements.upscaleButton.disabled = false;
  const totalBytes = list.reduce((sum, file) => sum + file.size, 0);
  setMessage(`${list.length}개 선택됨 (${formatBytes(totalBytes)})`);
}

async function onPdfFileSelected(file) {
  state.pdfFile = null;
  state.pdfArrayBuffer = null;
  state.pdfPageCount = 0;
  state.pdfPreviewDoc = null;
  state.pdfBaseImageData = null;
  state.pdfItems = [];
  elements.pdfSignButton.disabled = true;
  clearPdfSelection();
  renderPdfItemsList();

  const ctx = elements.pdfCanvas.getContext('2d');
  ctx.clearRect(0, 0, elements.pdfCanvas.width, elements.pdfCanvas.height);

  if (!file) return;

  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    setMessage('PDF 파일만 업로드할 수 있습니다.', true);
    return;
  }

  try {
    const meta = await loadPdfMeta(file);
    state.pdfFile = file;
    state.pdfArrayBuffer = meta.arrayBuffer;
    state.pdfPageCount = meta.pages;

    elements.pdfPage.max = String(meta.pages);
    elements.pdfPage.value = '1';

    await renderPdfPage(1);
    renderPdfItemsList();
    updatePdfActionState();
    setMessage(`PDF 선택됨: ${file.name} (${meta.pages}페이지)`);
  } catch (error) {
    setMessage(`PDF 읽기 실패: ${error.message}`, true);
  }
}

function setMode(nextMode) {
  state.mode = nextMode;

  elements.modeBuilding.classList.toggle('active', nextMode === 'building');
  elements.modeCompress.classList.toggle('active', nextMode === 'compress');
  elements.modeTransparent.classList.toggle('active', nextMode === 'transparent');
  elements.modeUpscale.classList.toggle('active', nextMode === 'upscale');
  elements.modePdf.classList.toggle('active', nextMode === 'pdf');

  const isBuilding = nextMode === 'building';
  const isPdf = nextMode === 'pdf';
  const isCompress = nextMode === 'compress';
  const isTransparent = nextMode === 'transparent';
  const isUpscale = nextMode === 'upscale';

  elements.buildingPanel.hidden = !isBuilding;
  elements.imageUploader.hidden = isPdf;
  elements.pdfUploader.hidden = !isPdf;
  elements.message.hidden = nextMode === 'building';
  elements.compressControls.hidden = !isCompress;
  elements.transparentControls.hidden = !isTransparent;
  elements.upscaleControls.hidden = !isUpscale;

  if (isBuilding) {
    elements.imageUploader.hidden = true;
    elements.pdfUploader.hidden = true;
    elements.message.hidden = true;
    elements.imageBatchResults.hidden = true;
    elements.result.hidden = true;
    elements.imageBatchResults.innerHTML = '';
    elements.heroSub.textContent = '주소 또는 아파트명을 검색하면 실제 주소로 정규화 후 건축물 정보와 주변시설을 조회합니다.';
    setMessage('조회할 주소/아파트명을 입력해 주세요.');
    setBuildingStatus('조회할 주소/아파트명을 입력해 주세요.');
    return;
  }

  if (isCompress) {
    elements.heroSub.textContent = '원본 해상도(가로/세로)는 그대로 유지하고, 파일 크기만 2MB 미만으로 압축합니다.';
    setMessage('이미지를 선택하면 압축 준비가 됩니다.');
    return;
  }

  if (isTransparent) {
    elements.heroSub.textContent = '이미지를 넣으면 배경색 영역을 알파 처리해서 투명 배경 파일로 만듭니다.';
    setMessage('이미지를 선택하면 배경 투명화 준비가 됩니다.');
    return;
  }

  if (isUpscale) {
    elements.heroSub.textContent = 'AI 또는 고급 선명화 기반으로 이미지 해상도(가로/세로)를 2배 확대해 더 선명한 결과를 생성합니다.';
    setMessage('이미지를 선택하면 2배 업스케일 준비가 됩니다.');
    return;
  }

  elements.heroSub.textContent = 'PDF를 열고 영역을 드래그로 선택한 뒤 텍스트를 입력하면 선택한 위치/폭으로 바로 삽입할 수 있습니다.';
  setMessage('PDF 파일을 선택해 주세요.');
}

async function runCompress() {
  if (!state.imageFiles.length) return;
  elements.compressButton.disabled = true;
  elements.transparentButton.disabled = true;
  elements.upscaleButton.disabled = true;
  clearBatchDownloadList();
  setMessage(`압축 중입니다... (0/${state.imageFiles.length})`);

  try {
    const outputs = [];

    for (let i = 0; i < state.imageFiles.length; i += 1) {
      const file = state.imageFiles[i];
      setMessage(`압축 중입니다... (${i + 1}/${state.imageFiles.length}) ${file.name}`);
      const image = await loadImage(file);
      const outputType = resolveCompressOutputType(file.type);
      const blob = await compressUnder2MB(image, outputType);
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const downloadName = `${baseName}-under-2mb.${outputExtension(outputType)}`;
      outputs.push({ name: downloadName, blob, file, image, outputType });
    }

    const first = outputs[0];
    const fromLabel = `${formatBytes(first.file.size)} / ${first.image.naturalWidth}x${first.image.naturalHeight}`;
    const toLabel = `${formatBytes(first.blob.size)} / ${first.image.naturalWidth}x${first.image.naturalHeight}`;
    renderResult(first.file.size, fromLabel, first.blob, toLabel, first.outputType, {
      showPreview: true,
      downloadName: first.name
    });
    renderBatchDownloadList(outputs.map(({ name, blob }) => ({ name, blob })));
    setMessage(`완료: ${outputs.length}개 이미지 압축 성공`);
  } catch (error) {
    elements.result.hidden = true;
    setMessage(error.message, true);
  } finally {
    elements.compressButton.disabled = false;
    elements.transparentButton.disabled = false;
    elements.upscaleButton.disabled = false;
  }
}

async function runTransparency() {
  if (!state.imageFiles.length) return;
  elements.transparentButton.disabled = true;
  elements.compressButton.disabled = true;
  elements.upscaleButton.disabled = true;
  clearBatchDownloadList();
  setMessage(`배경 투명화 처리 중입니다... (0/${state.imageFiles.length})`);

  try {
    const method = elements.transparentMethod.value;
    const outputs = [];
    let totalTransparentPixels = 0;

    if (method === 'ai') {
      setMessage('고품질 AI 배경 제거 중입니다... (처음 1회 모델 다운로드가 있으며, 이미지는 서버에 업로드되지 않습니다)');
    }

    for (let i = 0; i < state.imageFiles.length; i += 1) {
      const file = state.imageFiles[i];
      setMessage(`배경 투명화 처리 중입니다... (${i + 1}/${state.imageFiles.length}) ${file.name}`);
      let blob;
      let outputType;
      let image;

      if (method === 'ai') {
        const aiResult = await removeBackgroundWithAI(file);
        blob = aiResult.blob;
        outputType = aiResult.outputType;
        image = await loadImage(file);
      } else {
        image = await loadImage(file);
        const colorResult = await removeBackgroundAlpha(image);
        blob = colorResult.blob;
        outputType = colorResult.outputType;
        totalTransparentPixels += colorResult.transparentPixels;
      }

      const baseName = file.name.replace(/\.[^/.]+$/, '');
      outputs.push({
        name: `${baseName}-transparent.${outputExtension(outputType)}`,
        blob,
        file,
        image,
        outputType
      });
    }

    const first = outputs[0];
    const fromLabel = `${formatBytes(first.file.size)} / ${first.image.naturalWidth}x${first.image.naturalHeight}`;
    const toLabel = `${formatBytes(first.blob.size)} / ${first.image.naturalWidth}x${first.image.naturalHeight}`;
    renderResult(first.file.size, fromLabel, first.blob, toLabel, first.outputType, {
      showPreview: true,
      downloadName: first.name
    });
    renderBatchDownloadList(outputs.map(({ name, blob }) => ({ name, blob })));

    if (method === 'ai') {
      setMessage(`완료: AI 배경 제거 ${outputs.length}개 처리 성공`);
      return;
    }

    if (totalTransparentPixels === 0) {
      setMessage('완료: 처리되었지만 투명화된 픽셀이 거의 없습니다. 강도를 높여보세요.');
      return;
    }

    setMessage(`완료: 배경 투명화 ${outputs.length}개 처리 (${totalTransparentPixels.toLocaleString('ko-KR')}px)`);
  } catch (error) {
    elements.result.hidden = true;
    setMessage(`배경 제거 실패: ${error.message}`, true);
  } finally {
    elements.transparentButton.disabled = false;
    elements.compressButton.disabled = false;
    elements.upscaleButton.disabled = false;
  }
}

async function runUpscale() {
  if (!state.imageFiles.length) return;
  elements.upscaleButton.disabled = true;
  elements.compressButton.disabled = true;
  elements.transparentButton.disabled = true;
  clearBatchDownloadList();
  setMessage(`업스케일 처리 중입니다... (0/${state.imageFiles.length})`);

  try {
    const outputs = [];
    const method = elements.upscaleMethod.value;
    const enhanceOptions = {
      sharpen: Number(elements.upscaleSharpen.value || 1.2),
      vignette: Number(elements.upscaleVignette.value || 0.18)
    };
    let aiFallbackCount = 0;
    for (let i = 0; i < state.imageFiles.length; i += 1) {
      const file = state.imageFiles[i];
      setMessage(`업스케일 처리 중입니다... (${i + 1}/${state.imageFiles.length}) ${file.name}`);
      const image = await loadImage(file);
      const outputType = resolveUpscaleOutputType(file.type);
      let blob;
      if (method === 'ai') {
        try {
          blob = await upscaleImage2xWithAI(image, outputType, enhanceOptions);
        } catch (_error) {
          aiFallbackCount += 1;
          blob = await upscaleImage2x(image, outputType, enhanceOptions);
        }
      } else {
        blob = await upscaleImage2x(image, outputType, enhanceOptions);
      }
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      outputs.push({
        name: `${baseName}-2x.${outputExtension(outputType)}`,
        blob,
        file,
        image,
        outputType
      });
    }

    const first = outputs[0];
    const fromLabel = `${formatBytes(first.file.size)} / ${first.image.naturalWidth}x${first.image.naturalHeight}`;
    const toLabel = `${formatBytes(first.blob.size)} / ${first.image.naturalWidth * 2}x${first.image.naturalHeight * 2}`;
    renderResult(first.file.size, fromLabel, first.blob, toLabel, first.outputType, {
      showPreview: true,
      downloadName: first.name
    });
    await renderUpscaleCompare(first.file, first.blob, {
      beforeWidth: first.image.naturalWidth,
      beforeHeight: first.image.naturalHeight,
      afterWidth: first.image.naturalWidth * 2,
      afterHeight: first.image.naturalHeight * 2,
      methodLabel: method === 'ai' ? 'AI Upscale' : 'Sharp Upscale'
    });
    renderBatchDownloadList(outputs.map(({ name, blob }) => ({ name, blob })));
    if (method === 'ai' && aiFallbackCount > 0) {
      setMessage(`완료: ${outputs.length}개 업스케일 성공 (AI 일부 실패 ${aiFallbackCount}개는 고급 선명화로 처리)`);
    } else if (method === 'ai') {
      setMessage(`완료: ${outputs.length}개 AI 업스케일 성공`);
    } else {
      setMessage(`완료: ${outputs.length}개 고급 선명화 업스케일 성공`);
    }
  } catch (error) {
    elements.result.hidden = true;
    setMessage(`업스케일 실패: ${error.message}`, true);
  } finally {
    elements.upscaleButton.disabled = false;
    elements.compressButton.disabled = false;
    elements.transparentButton.disabled = false;
  }
}

async function runPdfTextInsert() {
  if (!state.pdfFile || !state.pdfArrayBuffer) return;

  elements.pdfSignButton.disabled = true;
  setMessage('PDF에 텍스트 넣는 중입니다...');

  try {
    const { blob, pages } = await writeTextToPdf();
    const fromLabel = `${formatBytes(state.pdfFile.size)} / ${pages}페이지`;
    const toLabel = `${formatBytes(blob.size)} / ${pages}페이지`;
    const baseName = state.pdfFile.name.replace(/\.[^/.]+$/, '');

    renderResult(state.pdfFile.size, fromLabel, blob, toLabel, 'application/pdf', {
      showPreview: false,
      downloadName: `${baseName}-text.pdf`
    });
    setMessage('완료: 텍스트가 삽입된 PDF 생성 성공');
  } catch (error) {
    elements.result.hidden = true;
    setMessage(error.message, true);
  } finally {
    updatePdfActionState();
  }
}

function addPdfTextItem() {
  if (!state.pdfFile) return;
  const text = (elements.pdfText.value || '').trim();
  if (!text) {
    setMessage('추가할 텍스트를 입력해 주세요.', true);
    return;
  }

  const page = Number(elements.pdfPage.value || 1);
  const x = Number(elements.pdfX.value || 60);
  const y = Number(elements.pdfY.value || 60);
  const fontSize = Number(elements.pdfFontSize.value || 18);
  if (!Number.isInteger(page) || page < 1 || page > state.pdfPageCount) {
    setMessage('페이지 번호를 확인해 주세요.', true);
    return;
  }
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(fontSize) || fontSize <= 0) {
    setMessage('좌표/글자 크기 값을 확인해 주세요.', true);
    return;
  }

  state.pdfItems.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    page,
    text,
    x,
    y,
    fontSize,
    maxWidth: state.pdfBoxWidth
  });

  elements.pdfText.value = '';
  renderPdfItemsList();
  updatePdfActionState();
  drawPdfTextOverlay();
  setMessage(`텍스트 박스 추가됨 (${state.pdfItems.length}개)`);
}

function syncTransparentControls() {
  const isColorMode = elements.transparentMethod.value === 'color';
  elements.transparentMode.disabled = !isColorMode;
  elements.transparentColor.disabled = !isColorMode || elements.transparentMode.value === 'auto';
  elements.transparentTolerance.disabled = !isColorMode;
}

elements.modeBuilding.addEventListener('click', () => setMode('building'));
elements.modeCompress.addEventListener('click', () => setMode('compress'));
elements.modeTransparent.addEventListener('click', () => setMode('transparent'));
elements.modeUpscale.addEventListener('click', () => setMode('upscale'));
elements.modePdf.addEventListener('click', () => setMode('pdf'));

elements.buildingSearchButton.addEventListener('click', () => {
  void runBuildingSearch();
});

elements.buildingDongList.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest('[data-dong-name]') : null;
  if (!target) return;
  const dongName = String(target.getAttribute('data-dong-name') || '').trim();
  if (!dongName) return;
  state.buildingSelectedDong = dongName;
  if (state.buildingVworldAvailable && state.buildingVworldPnu) {
    void loadVworldDongHoList(dongName);
    return;
  }
  const filtered = (state.buildingHoFallbackList || []).filter((item) => String(item?.dongName || '').trim() === dongName);
  renderBuildingHoList(filtered, `선택한 동(${dongName})의 호수 원본 데이터가 없습니다.`);
  setBuildingStatus(`"${dongName}" 동 선택됨`, 'success');
});

elements.buildingHoList.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest('[data-open-listing-modal]') : null;
  if (!target) return;
  const dongName = String(target.getAttribute('data-dong-name') || '').trim();
  const hoName = String(target.getAttribute('data-ho-name') || '').trim();
  const pyeongLabel = String(target.getAttribute('data-pyeong-label') || '').trim();
  const supplySqm = Number(target.getAttribute('data-supply-sqm') || NaN);
  const exclusiveSqm = Number(target.getAttribute('data-exclusive-sqm') || NaN);
  openListingModal({
    dongName,
    hoName,
    pyeongLabel,
    supplySqm,
    exclusiveSqm
  });
});

elements.buildingOverviewBody.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest('[data-pyeong-key]') : null;
  if (!target) return;
  const key = String(target.getAttribute('data-pyeong-key') || '').trim();
  if (!key) return;
  if (state.buildingSelectedPyeongKey === key) {
    state.buildingSelectedPyeongKey = '';
  } else {
    state.buildingSelectedPyeongKey = key;
  }
  elements.buildingOverviewBody.querySelectorAll('[data-pyeong-key]').forEach((el) => {
    el.classList.toggle('active', String(el.getAttribute('data-pyeong-key') || '') === state.buildingSelectedPyeongKey);
  });
  renderBuildingHoList(state.buildingHoFallbackList || [], '선택한 평형에 매핑된 동/호수가 없습니다.');
});

if (elements.listingDescPanel) {
  elements.listingDescPanel.addEventListener('click', async (event) => {
    const refreshTarget = event.target instanceof Element ? event.target.closest('[data-refresh-desc]') : null;
    if (refreshTarget) {
      const section = String(refreshTarget.getAttribute('data-refresh-desc') || 'all').trim();
      void refreshDescriptionSection(section || 'all');
      return;
    }
    const target = event.target instanceof Element ? event.target.closest('[data-copy-target]') : null;
    if (!target) return;
    const targetId = String(target.getAttribute('data-copy-target') || '').trim();
    if (!targetId) return;
    const field = document.getElementById(targetId);
    if (!(field instanceof HTMLTextAreaElement)) return;
    const ok = await copyTextToClipboard(field.value).catch(() => false);
    setMessage(ok ? '설명 문구를 복사했습니다.' : '복사에 실패했습니다.', !ok);
  });
}

if (elements.listingDescCopyAllBtn) {
  elements.listingDescCopyAllBtn.addEventListener('click', async () => {
    const blocks = [
      ['교통', elements.listingDescTransport?.value || ''],
      ['교육환경', elements.listingDescEducation?.value || ''],
      ['자연환경/편의시설', elements.listingDescAmenity?.value || '']
    ]
      .map(([title, body]) => `■ ${title}\n${String(body || '').trim()}`)
      .join('\n\n');
    const ok = await copyTextToClipboard(blocks).catch(() => false);
    setMessage(ok ? '매물설명 전체를 복사했습니다.' : '복사에 실패했습니다.', !ok);
  });
}

elements.buildingQuery.addEventListener('input', () => {
  if (state.buildingSuggestTimer) clearTimeout(state.buildingSuggestTimer);
  state.buildingSuggestTimer = setTimeout(() => {
    void fetchBuildingSuggestions(elements.buildingQuery.value);
  }, 180);
});

elements.buildingQuery.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    updateSuggestActiveIndex(state.buildingSuggestActiveIndex + 1);
    return;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    updateSuggestActiveIndex(state.buildingSuggestActiveIndex - 1);
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    if (!elements.buildingSuggest.hidden && state.buildingSuggestActiveIndex >= 0) {
      applyBuildingSuggestion(state.buildingSuggestActiveIndex, true);
      return;
    }
    void runBuildingSearch();
  }
});

elements.buildingSuggest.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const row = target.closest('[data-suggest-index]');
  if (!(row instanceof HTMLElement)) return;
  const index = Number.parseInt(String(row.dataset.suggestIndex || '-1'), 10);
  if (!Number.isFinite(index) || index < 0) return;
  applyBuildingSuggestion(index, true);
});

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (elements.buildingSuggest.hidden) return;
  if (elements.buildingQuery.contains(target)) return;
  if (elements.buildingSuggest.contains(target)) return;
  clearBuildingSuggestions();
});

if (elements.listingModal) {
  elements.listingModal.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.hasAttribute('data-listing-close')) {
      closeListingModal();
    }
  });
}

if (elements.listingModalClose) {
  elements.listingModalClose.addEventListener('click', closeListingModal);
}

if (elements.listingCancelBtn) {
  elements.listingCancelBtn.addEventListener('click', closeListingModal);
}

if (elements.listingSaveBtn) {
  elements.listingSaveBtn.addEventListener('click', () => {
    const unit = state.listingTargetUnit || {};
    const label = `${unit.dongName || ''} ${unit.hoName || ''}`.trim() || '선택 호실';
    state.listingDraft = {
      sourceApp: 'building-info-app',
      savedAt: new Date().toISOString(),
      unit: {
        dongName: String(unit.dongName || ''),
        hoName: String(unit.hoName || ''),
        pyeongLabel: String(unit.pyeongLabel || ''),
        supplySqm: Number.isFinite(Number(unit.supplySqm)) ? Number(unit.supplySqm) : null,
        exclusiveSqm: Number.isFinite(Number(unit.exclusiveSqm)) ? Number(unit.exclusiveSqm) : null
      },
      listing: {
        propertyType: getActiveChipValue('propertyType'),
        dealType: getActiveChipValue('dealType'),
        direction: getActiveChipValue('direction'),
        parking: getActiveChipValue('parking'),
        price: String(elements.listingPrice?.value || '').trim(),
        roomCount: String(elements.listingRoomCount?.value || '').trim(),
        bathCount: String(elements.listingBathCount?.value || '').trim(),
        maintenanceFee: String(elements.listingMaintenanceFee?.value || '').trim(),
        moveInDate: String(elements.listingMoveInDate?.value || '').trim(),
        description: String(elements.listingDescription?.value || '').trim()
      }
    };
    updateAutofillStartButton();
    setMessage(`매물등록 입력 완료: ${label} · 상단 '자동입력 시작' 버튼으로 전송`);
    closeListingModal();
  });
}

if (elements.listingAutofillStartBtn) {
  elements.listingAutofillStartBtn.addEventListener('click', () => {
    if (!state.listingDraft) {
      setMessage('먼저 보강 항목에서 매물등록을 입력해 주세요.', true);
      return;
    }
    const encoded = encodeAutofillPayload(state.listingDraft);
    const targetUrl = `https://rter.kr/#codexAutofill=${encodeURIComponent(encoded)}`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    setMessage('rter.kr를 열었습니다. 크롬 확장프로그램이 설치되어 있으면 자동입력이 시작됩니다.');
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && elements.listingModal && !elements.listingModal.hidden) {
    closeListingModal();
  }
});

document.querySelectorAll('[data-chip-group]').forEach((groupEl) => {
  groupEl.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest('.listing-chip');
    if (!(button instanceof HTMLButtonElement)) return;
    groupEl.querySelectorAll('.listing-chip').forEach((chip) => chip.classList.remove('active'));
    button.classList.add('active');
  });
});

document.querySelectorAll('.building-tab').forEach((tabEl) => {
  tabEl.addEventListener('click', () => {
    if (!(tabEl instanceof HTMLButtonElement)) return;
    const tabName = tabEl.dataset.buildingTab || 'overview';
    selectBuildingTab(tabName);
    if (tabName === 'description') {
      void reloadDescriptionDataIfNeeded();
    }
  });
});

elements.fileInput.addEventListener('change', (event) => {
  onImageFilesSelected(event.target.files || []);
});

elements.pdfFile.addEventListener('change', (event) => {
  void onPdfFileSelected(event.target.files?.[0] || null);
});

elements.pdfPage.addEventListener('change', () => {
  if (!state.pdfPreviewDoc) return;
  void renderPdfPage(Number(elements.pdfPage.value || 1));
});

elements.pdfText.addEventListener('input', updatePdfActionState);
elements.pdfText.addEventListener('input', drawPdfTextOverlay);
elements.pdfX.addEventListener('input', drawPdfTextOverlay);
elements.pdfY.addEventListener('input', drawPdfTextOverlay);
elements.pdfFontSize.addEventListener('input', drawPdfTextOverlay);

elements.compressButton.addEventListener('click', () => {
  void runCompress();
});

elements.transparentButton.addEventListener('click', () => {
  void runTransparency();
});
elements.upscaleButton.addEventListener('click', () => {
  void runUpscale();
});

elements.pdfSignButton.addEventListener('click', () => {
  void runPdfTextInsert();
});
elements.pdfAddButton.addEventListener('click', addPdfTextItem);

elements.pdfItems.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const removeId = target.dataset.removeId;
  if (!removeId) return;
  state.pdfItems = state.pdfItems.filter((item) => item.id !== removeId);
  renderPdfItemsList();
  updatePdfActionState();
  drawPdfTextOverlay();
  setMessage(`텍스트 박스 삭제됨 (${state.pdfItems.length}개 남음)`);
});

elements.transparentMode.addEventListener('change', syncTransparentControls);
elements.transparentMethod.addEventListener('change', syncTransparentControls);
elements.compareSlider.addEventListener('input', updateCompareSlider);

['dragenter', 'dragover'].forEach((eventName) => {
  elements.dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropzone.classList.add('dragging');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  elements.dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropzone.classList.remove('dragging');
  });
});

elements.dropzone.addEventListener('drop', (event) => {
  const files = event.dataTransfer?.files || [];
  if (!files.length) return;
  onImageFilesSelected(files);
});

elements.pdfCanvas.addEventListener('mousedown', (event) => {
  if (!state.pdfPreviewDoc) return;
  state.pdfSelecting = true;
  state.pdfDragStart = getCanvasPoint(event);
  updateSelectionVisual(state.pdfDragStart.x, state.pdfDragStart.y, 1, 1);
});

elements.pdfCanvas.addEventListener('mousemove', (event) => {
  if (!state.pdfSelecting || !state.pdfDragStart) return;

  const current = getCanvasPoint(event);
  const left = Math.min(state.pdfDragStart.x, current.x);
  const top = Math.min(state.pdfDragStart.y, current.y);
  const width = Math.max(1, Math.abs(current.x - state.pdfDragStart.x));
  const height = Math.max(1, Math.abs(current.y - state.pdfDragStart.y));
  updateSelectionVisual(left, top, width, height);
});

elements.pdfCanvas.addEventListener('mouseup', (event) => {
  if (!state.pdfSelecting || !state.pdfDragStart) return;

  const end = getCanvasPoint(event);
  const left = Math.min(state.pdfDragStart.x, end.x);
  const top = Math.min(state.pdfDragStart.y, end.y);
  const width = Math.max(12, Math.abs(end.x - state.pdfDragStart.x));
  const height = Math.max(12, Math.abs(end.y - state.pdfDragStart.y));
  updateSelectionVisual(left, top, width, height);

  const xPdf = left / state.pdfScale;
  const yPdf = (elements.pdfCanvas.height - (top + height)) / state.pdfScale;
  const boxWidthPdf = width / state.pdfScale;
  const boxHeightPdf = height / state.pdfScale;

  state.pdfBoxWidth = Math.round(boxWidthPdf);
  elements.pdfX.value = String(Math.round(xPdf));
  elements.pdfY.value = String(Math.round(yPdf));
  elements.pdfFontSize.value = String(Math.max(8, Math.round(boxHeightPdf * 0.7)));
  state.pdfSelecting = false;
  state.pdfDragStart = null;
  drawPdfTextOverlay();
  elements.pdfText.focus();
  setMessage(`영역 선택됨: X ${elements.pdfX.value}, Y ${elements.pdfY.value}, 폭 ${state.pdfBoxWidth}`);
});

elements.pdfCanvas.addEventListener('mouseleave', () => {
  if (!state.pdfSelecting) return;
  state.pdfSelecting = false;
  state.pdfDragStart = null;
});

syncTransparentControls();
renderPdfItemsList();
selectBuildingTab('overview');
setMode('building');
bindCompareDrag();
updateCompareSlider();
updateAutofillStartButton();
