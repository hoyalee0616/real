require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const axios = require('axios');
const { spawn, execFile } = require('child_process');

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

const KAKAO_REST_API_KEY = String(process.env.KAKAO_REST_API_KEY || '').trim();
const BUILDING_REGISTRY_SERVICE_KEY = String(process.env.BUILDING_REGISTRY_SERVICE_KEY || '').trim();
const KAKAO_MAP_JS_KEY = String(process.env.KAKAO_MAP_JS_KEY || '').trim();
const MOLIT_RTMS_SERVICE_KEY = String(
  process.env.MOLIT_RTMS_SERVICE_KEY || process.env.BUILDING_REGISTRY_SERVICE_KEY || ''
).trim();
const KAKAO_BASE_URL = 'https://dapi.kakao.com/v2/local';
const BLD_REGISTRY_BASE_URL = 'https://apis.data.go.kr/1613000/BldRgstHubService';
const RTMS_APT_URL = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev';
const RTMS_OFFI_URL = 'https://apis.data.go.kr/1613000/RTMSDataSvcOffiTradeDev/getRTMSDataSvcOffiTradeDev';
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_FAST_BUDGET_MS = 1900;
const searchCache = new Map();
const REB_APTID_SERVICE_KEY = String(
  process.env.REB_APTID_SERVICE_KEY || process.env.BUILDING_REGISTRY_SERVICE_KEY || ''
).trim();
const REB_APTID_BASE_URL = 'https://api.odcloud.kr/api/AptIdInfoSvc/v1';
const VWORLD_APT_PRICE_KEY = String(process.env.VWORLD_APT_PRICE_KEY || '').trim();
const VWORLD_APT_ATTR_URL = 'https://api.vworld.kr/ned/data/getApartHousingPriceAttr';
const LH_SUPPLY_API_URL = String(process.env.LH_SUPPLY_API_URL || '').trim();
const LH_SUPPLY_SERVICE_KEY = String(process.env.LH_SUPPLY_SERVICE_KEY || '').trim();
const MIN_VALID_AREA_SQM = 10;
const MAX_VALID_AREA_SQM = 400;

function resolveLocalHousingCsvPath() {
  const fromEnv = String(process.env.LOCAL_HOUSING_CSV_PATH || '').trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const logDir = path.join(__dirname, '..', 'log');
  if (!fs.existsSync(logDir)) return '';
  const files = fs.readdirSync(logDir)
    .filter((name) => name.toLowerCase().endsWith('.csv'))
    .map((name) => path.join(logDir, name));
  if (!files.length) return '';
  const targets = ['주택공시가격정보', '주택공시가격정보'].map((v) => normalizeFilenameToken(v));
  const preferred = files.find((file) => {
    const base = normalizeFilenameToken(path.basename(file));
    return targets.some((t) => base.includes(t));
  });
  return preferred || files[0];
}

const LOCAL_HOUSING_CSV_PATH = resolveLocalHousingCsvPath();
const LOCAL_CSV_CACHE = new Map();
const LOCAL_EXPOS_AREA_CACHE = new Map();
const LOCAL_HOUSING_SQLITE_PATH = String(process.env.LOCAL_HOUSING_SQLITE_PATH || '')
  .trim() || path.join(__dirname, '..', 'log', 'housing_prices_2025.sqlite');
const LOCAL_CSV_SQLITE_STATE = {
  ready: false,
  building: null,
  lastError: ''
};
const LH_SUPPLY_CACHE = new Map();
const COMPLEX_SUPPLY_HINT_CACHE = new Map();
const SUPPLY_COMMON_ETC_TOKENS = ['계단실', '승강기', '벽체', '외벽'];
const MAIN_BUILDING_TOKEN = '주건축물';

function normalizeFilenameToken(value) {
  return String(value || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()\-_.]/g, '');
}

function resolveLocalExposAreaCsvPath() {
  const fromEnv = String(process.env.LOCAL_EXPOS_AREA_CSV_PATH || '').trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const logDir = path.join(__dirname, '..', 'log');
  if (!fs.existsSync(logDir)) return '';
  const files = fs.readdirSync(logDir)
    .filter((name) => name.toLowerCase().endsWith('.csv'))
    .map((name) => path.join(logDir, name));
  if (!files.length) return '';
  const targets = ['전유공용면적', '전유공용면적'].map((v) => normalizeFilenameToken(v));
  const byName = files.find((file) => {
    const base = normalizeFilenameToken(path.basename(file));
    return targets.some((t) => base.includes(t));
  });
  return byName || '';
}

function resolveLocalExposAreaJsonPath() {
  const fromEnv = String(process.env.LOCAL_EXPOS_AREA_JSON_PATH || '').trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const logDir = path.join(__dirname, '..', 'log');
  if (!fs.existsSync(logDir)) return '';
  const files = fs.readdirSync(logDir)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .map((name) => path.join(logDir, name));
  if (!files.length) return '';
  const targets = ['전유공용면적', '전유공용면적'].map((v) => normalizeFilenameToken(v));
  const matched = files.filter((file) => {
    const base = normalizeFilenameToken(path.basename(file));
    return targets.some((t) => base.includes(t));
  });
  if (!matched.length) return '';
  matched.sort((a, b) => (getFileMtimeMs(b) - getFileMtimeMs(a)));
  return matched[0];
}

const LOCAL_EXPOS_AREA_CSV_PATH = resolveLocalExposAreaCsvPath();
const LOCAL_EXPOS_AREA_JSON_PATH = resolveLocalExposAreaJsonPath();
let LOCAL_EXPOS_AREA_JSON_ROWS = null;
const LOCAL_EXPOS_AREA_JSON_INDEX = {
  ready: false,
  byParcel: new Map(),
  lastError: ''
};

app.get('/api/client-config', (_req, res) => {
  res.json({
    ok: true,
    kakaoMapJsKey: KAKAO_MAP_JS_KEY || ''
  });
});

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toInteger(value) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : null;
}

function trunc2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n * 100) / 100;
}

function toNumberLoose(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = String(value).trim();
  if (!raw) return null;
  const cleaned = raw
    .replace(/,/g, '')
    .replace(/\s+/g, '')
    .replace(/[^\d.+-]/g, '');
  if (!cleaned || cleaned === '.' || cleaned === '+' || cleaned === '-') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function toIntegerLoose(value) {
  const n = toNumberLoose(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function pad4(value) {
  const n = Number.parseInt(String(value ?? '0'), 10);
  if (!Number.isFinite(n) || n < 0) return '0000';
  return String(n).padStart(4, '0');
}

function formatDateYYYYMMDD(value) {
  const raw = String(value || '').replace(/\D/g, '');
  if (raw.length !== 8) return value ? String(value) : '-';
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function pickFirst(item, keys, fallback = null) {
  for (const key of keys) {
    const value = item?.[key];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (!text) continue;
    return value;
  }
  return fallback;
}

function normalizeItemsFromApi(rawResponse) {
  const body = rawResponse?.data?.response?.body || rawResponse?.response?.body || null;
  const raw = body?.items?.item;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function getSearchCache(key) {
  const hit = searchCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.createdAt > SEARCH_CACHE_TTL_MS) {
    searchCache.delete(key);
    return null;
  }
  return hit.data;
}

function setSearchCache(key, data) {
  searchCache.set(key, {
    createdAt: Date.now(),
    data
  });
}

async function resolveWithin(promise, timeoutMs, fallbackValue) {
  const ms = Math.max(50, Number(timeoutMs) || 50);
  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => setTimeout(() => resolve(fallbackValue), ms))
    ]);
  } catch (_error) {
    return fallbackValue;
  }
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function execFileAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      maxBuffer: 1024 * 1024 * 64,
      ...options
    }, (error, stdout, stderr) => {
      if (error) {
        const e = new Error(stderr || error.message || 'command failed');
        e.cause = error;
        reject(e);
        return;
      }
      resolve({
        stdout: String(stdout || ''),
        stderr: String(stderr || '')
      });
    });
  });
}

function sqlQuote(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

function getFileMtimeMs(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs || 0;
  } catch (_error) {
    return 0;
  }
}

async function buildLocalCsvSqliteDb() {
  const dbPath = LOCAL_HOUSING_SQLITE_PATH;
  const tmpPath = `${dbPath}.tmp`;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

  const createSql = [
    'PRAGMA journal_mode=OFF;',
    'PRAGMA synchronous=OFF;',
    'PRAGMA temp_store=MEMORY;',
    'DROP TABLE IF EXISTS apt_prices;',
    'CREATE TABLE apt_prices (',
    ' base_year TEXT,',
    ' base_month TEXT,',
    ' legal_code TEXT,',
    ' road_addr TEXT,',
    ' sido TEXT,',
    ' sigungu TEXT,',
    ' eupmyeon TEXT,',
    ' dongri TEXT,',
    ' special_code TEXT,',
    ' bun TEXT,',
    ' ji TEXT,',
    ' special_name TEXT,',
    ' complex_name TEXT,',
    ' dong_name TEXT,',
    ' ho_name TEXT,',
    ' area REAL,',
    ' official_price REAL,',
    ' complex_code TEXT,',
    ' dong_code TEXT,',
    ' ho_code TEXT,',
    ' pnu TEXT',
    ');'
  ].join('\n');
  await execFileAsync('sqlite3', [tmpPath, createSql]);

  const csvPathForImport = LOCAL_HOUSING_CSV_PATH.replace(/'/g, "''");
  await execFileAsync('sqlite3', [
    '-cmd', '.mode csv',
    tmpPath,
    `.import --skip 1 '${csvPathForImport}' apt_prices`
  ]);

  const postSql = [
    'CREATE INDEX IF NOT EXISTS idx_apt_parcel ON apt_prices(legal_code, special_code, bun, ji);',
    'CREATE INDEX IF NOT EXISTS idx_apt_dong_ho ON apt_prices(dong_name, ho_name);',
    'ANALYZE;'
  ].join('\n');
  await execFileAsync('sqlite3', [tmpPath, postSql]);

  fs.renameSync(tmpPath, dbPath);
}

async function ensureLocalCsvSqliteReady() {
  if (!LOCAL_HOUSING_CSV_PATH) {
    return { ok: false, reason: '로컬 CSV 파일이 없습니다.' };
  }
  if (LOCAL_CSV_SQLITE_STATE.ready) return { ok: true, reason: '' };
  if (LOCAL_CSV_SQLITE_STATE.building) {
    return { ok: false, reason: 'sqlite 인덱스 구축 중입니다. 임시로 CSV 직접 조회를 사용합니다.' };
  }

  LOCAL_CSV_SQLITE_STATE.building = (async () => {
    try {
      await execFileAsync('sqlite3', ['--version']);
      const csvMtime = getFileMtimeMs(LOCAL_HOUSING_CSV_PATH);
      const dbMtime = getFileMtimeMs(LOCAL_HOUSING_SQLITE_PATH);
      let needBuild = !fs.existsSync(LOCAL_HOUSING_SQLITE_PATH) || dbMtime < csvMtime;
      if (!needBuild && fs.existsSync(LOCAL_HOUSING_SQLITE_PATH)) {
        try {
          const sanitySql = [
            'SELECT COUNT(*)',
            'FROM apt_prices',
            "WHERE length(legal_code)=10"
          ].join(' ');
          const sanity = await execFileAsync('sqlite3', ['-noheader', LOCAL_HOUSING_SQLITE_PATH, sanitySql]);
          const count = Number.parseInt(String(sanity.stdout || '').trim(), 10) || 0;
          if (count <= 0) needBuild = true;
        } catch (_error) {
          needBuild = true;
        }
      }
      if (needBuild) {
        await buildLocalCsvSqliteDb();
      }
      LOCAL_CSV_SQLITE_STATE.ready = true;
      LOCAL_CSV_SQLITE_STATE.lastError = '';
      return { ok: true, reason: '' };
    } catch (error) {
      LOCAL_CSV_SQLITE_STATE.ready = false;
      LOCAL_CSV_SQLITE_STATE.lastError = error.message || 'sqlite 준비 실패';
      return { ok: false, reason: LOCAL_CSV_SQLITE_STATE.lastError };
    } finally {
      LOCAL_CSV_SQLITE_STATE.building = null;
    }
  })();

  return { ok: false, reason: 'sqlite 인덱스 구축 시작. 임시로 CSV 직접 조회를 사용합니다.' };
}

async function queryLocalCsvSqliteRows(parcel) {
  const legalCode = `${String(parcel.sigunguCd || '')}${String(parcel.bjdongCd || '')}`;
  const bunNum = Number.parseInt(String(parcel.bun || '0'), 10) || 0;
  const jiNum = Number.parseInt(String(parcel.ji || '0'), 10) || 0;
  const plat = String(parcel.platGbCd || '0');
  const sql = [
    'SELECT dong_name, ho_name, area, official_price, pnu',
    'FROM apt_prices',
    `WHERE legal_code=${sqlQuote(legalCode)}`,
    `AND special_code=${sqlQuote(plat)}`,
    `AND CAST(bun AS INTEGER)=${bunNum}`,
    `AND CAST(ji AS INTEGER)=${jiNum}`
  ].join(' ');
  const result = await execFileAsync('sqlite3', ['-csv', '-noheader', LOCAL_HOUSING_SQLITE_PATH, sql]);
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseCsvLine(line));
}

function safeLower(value) {
  return String(value || '').toLowerCase();
}

function normalizeNameToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()\-_.]/g, '');
}

function toPyeongLabel(areaSquareMeter) {
  const area = Number(areaSquareMeter);
  if (!Number.isFinite(area) || area <= 0) return '-';
  const p = area / 3.305785;
  return `${p.toFixed(1)}평`;
}

function isValidResidentialArea(areaSquareMeter) {
  const area = Number(areaSquareMeter);
  if (!Number.isFinite(area)) return false;
  return area >= MIN_VALID_AREA_SQM && area <= MAX_VALID_AREA_SQM;
}

function isUndergroundUnit(item = {}) {
  const floorType = String(item?.floorType || item?.flrGbCdNm || '').trim();
  if (floorType.includes('지하')) return true;
  const floor = Number(item?.floorNumber ?? item?.flrNo);
  return Number.isFinite(floor) && floor < 0;
}

function recentDealMonths(count = 6) {
  const out = [];
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  for (let i = 0; i < count; i += 1) {
    out.push(`${year}${String(month).padStart(2, '0')}`);
    month -= 1;
    if (month <= 0) {
      month = 12;
      year -= 1;
    }
  }
  return out;
}

function inferRegion(roadAddress, address) {
  const source = String(roadAddress || address || '').trim();
  if (!source) return '-';
  const parts = source.split(/\s+/).filter(Boolean);
  return parts.slice(0, 3).join(' ') || '-';
}

const EXCLUDED_PLACE_KEYWORDS = [
  '경비실',
  '관리사무소',
  '관리사무실',
  '수위실',
  '보안실',
  '경비초소'
];

function isExcludedPlaceDoc(doc) {
  const text = [
    String(doc?.place_name || ''),
    String(doc?.category_name || ''),
    String(doc?.road_address_name || ''),
    String(doc?.address_name || '')
  ].join(' ');
  return EXCLUDED_PLACE_KEYWORDS.some((keyword) => text.includes(keyword));
}

function pickPreferredKeywordDoc(docs = []) {
  if (!Array.isArray(docs) || !docs.length) return null;
  const filtered = docs.filter((doc) => !isExcludedPlaceDoc(doc));
  return filtered[0] || null;
}

function computeTravelMinutes(distance) {
  const d = Number(distance);
  if (!Number.isFinite(d)) return { walkMinutes: null, driveMinutes: null };
  return {
    walkMinutes: Math.max(1, Math.ceil(d / 67)),
    driveMinutes: Math.max(1, Math.ceil(d / 400))
  };
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2))
    * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function pointToSegmentDistanceMeters(point, a, b, latRef) {
  const meterPerLat = 111132;
  const meterPerLng = 111320 * Math.cos((latRef * Math.PI) / 180);

  const px = point.lng * meterPerLng;
  const py = point.lat * meterPerLat;
  const ax = a.lng * meterPerLng;
  const ay = a.lat * meterPerLat;
  const bx = b.lng * meterPerLng;
  const by = b.lat * meterPerLat;

  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = (abx * abx) + (aby * aby);
  if (abLenSq <= 0) {
    return Math.round(Math.sqrt((px - ax) ** 2 + (py - ay) ** 2));
  }
  const t = Math.max(0, Math.min(1, ((apx * abx) + (apy * aby)) / abLenSq));
  const cx = ax + (abx * t);
  const cy = ay + (aby * t);
  return Math.round(Math.sqrt((px - cx) ** 2 + (py - cy) ** 2));
}

function toBuildingParcelFromKakaoAddress(addressDoc) {
  const legalCode = String(addressDoc?.address?.b_code || '');
  if (legalCode.length < 10) return null;

  const mainAddressNo = pad4(addressDoc?.address?.main_address_no || '0');
  const subAddressNo = pad4(addressDoc?.address?.sub_address_no || '0');
  const mountainYn = String(addressDoc?.address?.mountain_yn || 'N').toUpperCase();
  return {
    sigunguCd: legalCode.slice(0, 5),
    bjdongCd: legalCode.slice(5, 10),
    platGbCd: mountainYn === 'Y' ? '1' : '0',
    bun: mainAddressNo,
    ji: subAddressNo
  };
}

async function callBuildingRegistryApi(operation, parcel, options = {}) {
  if (!BUILDING_REGISTRY_SERVICE_KEY || !parcel) return [];
  const {
    numOfRows = 300,
    timeoutMs = 25000,
    retries = 1,
    maxPages = 80
  } = options;

  const pageSize = Math.max(1, Math.min(100, Number(numOfRows) || 100));
  const out = [];
  let expectedTotal = null;

  for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
    let pageResponse = null;
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        pageResponse = await axios.get(`${BLD_REGISTRY_BASE_URL}/${operation}`, {
          params: {
            serviceKey: BUILDING_REGISTRY_SERVICE_KEY,
            sigunguCd: parcel.sigunguCd,
            bjdongCd: parcel.bjdongCd,
            platGbCd: parcel.platGbCd,
            bun: parcel.bun,
            ji: parcel.ji,
            numOfRows: pageSize,
            pageNo,
            _type: 'json'
          },
          timeout: timeoutMs
        });
        break;
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
        }
      }
    }

    if (!pageResponse) {
      if (out.length) break;
      throw lastError || new Error('건축물대장 API 호출 실패');
    }

    const body = pageResponse?.data?.response?.body || pageResponse?.response?.body || {};
    const totalCountRaw = Number.parseInt(String(body?.totalCount ?? ''), 10);
    if (Number.isFinite(totalCountRaw) && totalCountRaw >= 0) {
      expectedTotal = totalCountRaw;
    }
    const pageItems = normalizeItemsFromApi(pageResponse);
    if (!pageItems.length) break;
    out.push(...pageItems);

    if (expectedTotal !== null && out.length >= expectedTotal) break;
    if (pageItems.length < pageSize) break;
  }

  return out;
}

function pickMaxIntegerFromRows(rows = [], keys = []) {
  const source = Array.isArray(rows) ? rows : [];
  let out = null;
  source.forEach((row) => {
    keys.forEach((key) => {
      const n = toIntegerLoose(row?.[key]);
      if (!Number.isFinite(n)) return;
      out = out === null ? n : Math.max(out, n);
    });
  });
  return out;
}

function pickMaxNumberFromRows(rows = [], keys = []) {
  const source = Array.isArray(rows) ? rows : [];
  let out = null;
  source.forEach((row) => {
    keys.forEach((key) => {
      const n = toNumberLoose(row?.[key]);
      if (!Number.isFinite(n)) return;
      out = out === null ? n : Math.max(out, n);
    });
  });
  return out;
}

function pickMaxParkingFromComponents(rows = []) {
  const source = Array.isArray(rows) ? rows : [];
  let out = null;
  source.forEach((row) => {
    const values = [
      'indrMechUtcnt',
      'indrAutoUtcnt',
      'oudrMechUtcnt',
      'oudrAutoUtcnt',
      'indoMechUtcnt',
      'indoAutoUtcnt',
      'outMechUtcnt',
      'outAutoUtcnt'
    ].map((key) => toIntegerLoose(row?.[key]));
    const finite = values.filter((n) => Number.isFinite(n) && n >= 0);
    if (!finite.length) return;
    const sum = finite.reduce((acc, n) => acc + n, 0);
    out = out === null ? sum : Math.max(out, sum);
  });
  return out;
}

function mapBuildingRegistrySummary(titleItems = [], recapItems = []) {
  const titleFirst = Array.isArray(titleItems) ? (titleItems[0] || {}) : (titleItems || {});
  const recapFirst = Array.isArray(recapItems) ? (recapItems[0] || {}) : (recapItems || {});
  const merged = { ...titleFirst, ...recapFirst };
  const allRows = [
    ...(Array.isArray(recapItems) ? recapItems : []),
    ...(Array.isArray(titleItems) ? titleItems : [])
  ];

  const groundFloors = pickMaxIntegerFromRows(allRows, ['grndFlrCnt']);
  const undergroundFloors = pickMaxIntegerFromRows(allRows, ['ugrndFlrCnt']);
  const heightNumber = pickMaxNumberFromRows(allRows, ['heit', 'height']);
  const elevatorCount = pickMaxIntegerFromRows(allRows, ['rideUseElvtCnt', 'elvtCnt']);
  const parkingByTotal = pickMaxIntegerFromRows(allRows, [
    'totPkngCnt',
    'totParkngCnt',
    'totParkingCnt',
    'pkngCnt',
    'parkingCnt'
  ]);
  const parkingByComponents = pickMaxParkingFromComponents(allRows);
  const parkingCount = (Number.isFinite(parkingByTotal) && parkingByTotal > 0)
    ? parkingByTotal
    : (Number.isFinite(parkingByComponents) && parkingByComponents > 0
      ? parkingByComponents
      : parkingByTotal);
  const archArea = pickMaxNumberFromRows(allRows, ['archArea']);
  const totalArea = pickMaxNumberFromRows(allRows, ['totArea']);

  return {
    mainPurpose: String(pickFirst(merged, ['mainPurpsCdNm', 'mainPurpsNm'], '-')),
    structure: String(pickFirst(merged, ['strctCdNm', 'strctNm'], '-')),
    useApprovalDate: formatDateYYYYMMDD(pickFirst(merged, ['useAprDay', 'useAprDate'], '-')),
    groundFloors,
    undergroundFloors,
    heightMeters: heightNumber,
    passengerElevatorCount: elevatorCount,
    parkingCount,
    buildingArea: archArea,
    totalFloorArea: totalArea
  };
}

function countTextValue(map, value) {
  const text = String(value || '').trim();
  if (!text || text === '-') return;
  map.set(text, (map.get(text) || 0) + 1);
}

function pickTopCountValue(map, fallback = '-') {
  if (!(map instanceof Map) || map.size === 0) return fallback;
  let topValue = fallback;
  let topCount = -1;
  for (const [value, count] of map.entries()) {
    if (count > topCount) {
      topCount = count;
      topValue = value;
    }
  }
  return topValue || fallback;
}

function mapDongInfo(floorItems, titleItems = []) {
  const titleRows = Array.isArray(titleItems) ? titleItems : [];
  const titleMerged = titleRows[0] || {};
  const globalMainPurpose = String(pickFirst(titleMerged, ['mainPurpsCdNm', 'mainPurpsNm'], '-'));
  const globalStructure = String(pickFirst(titleMerged, ['strctCdNm', 'strctNm'], '-'));
  const globalUseApprovalDate = formatDateYYYYMMDD(pickFirst(titleMerged, ['useAprDay', 'useAprDate'], '-'));

  const dongMeta = new Map();
  const collectDongMeta = (row = {}) => {
    const rawDong = String(pickFirst(row, ['dongNm', 'bldNm'], '')).trim();
    if (!rawDong) return;
    const dongName = formatDongName(rawDong);
    if (!dongMeta.has(dongName)) {
      dongMeta.set(dongName, {
        mainPurposeCounts: new Map(),
        structureCounts: new Map(),
        useApprovalDateCounts: new Map()
      });
    }
    const target = dongMeta.get(dongName);
    countTextValue(target.mainPurposeCounts, pickFirst(row, ['mainPurpsCdNm', 'mainPurpsNm'], ''));
    countTextValue(target.structureCounts, pickFirst(row, ['strctCdNm', 'strctNm'], ''));
    countTextValue(
      target.useApprovalDateCounts,
      formatDateYYYYMMDD(pickFirst(row, ['useAprDay', 'useAprDate'], ''))
    );
  };

  const grouped = new Map();
  floorItems.forEach((item) => {
    collectDongMeta(item);
    const dongName = formatDongName(pickFirst(item, ['dongNm', 'bldNm'], '동 미상'));
    if (!grouped.has(dongName)) {
      grouped.set(dongName, {
        dongName,
        floorCount: 0,
        maxFloor: null,
        minFloor: null,
        mainPurpose: globalMainPurpose,
        structure: globalStructure,
        useApprovalDate: globalUseApprovalDate
      });
    }
    const entry = grouped.get(dongName);
    entry.floorCount += 1;
    const floorNo = toInteger(pickFirst(item, ['flrNo']));
    if (Number.isFinite(floorNo)) {
      entry.maxFloor = entry.maxFloor === null ? floorNo : Math.max(entry.maxFloor, floorNo);
      entry.minFloor = entry.minFloor === null ? floorNo : Math.min(entry.minFloor, floorNo);
    }
  });
  titleRows.forEach((item) => collectDongMeta(item));

  if (grouped.size > 0) {
    return [...grouped.values()].map((entry) => {
      const meta = dongMeta.get(String(entry.dongName || ''));
      return {
        ...entry,
        mainPurpose: pickTopCountValue(meta?.mainPurposeCounts, entry.mainPurpose || '-'),
        structure: pickTopCountValue(meta?.structureCounts, entry.structure || '-'),
        useApprovalDate: pickTopCountValue(meta?.useApprovalDateCounts, entry.useApprovalDate || '-')
      };
    });
  }

  // Fallback: some parcels return no floor outline rows, but title rows still include dong names.
  titleRows.forEach((item) => {
    const dongName = formatDongName(pickFirst(item, ['dongNm', 'bldNm'], ''));
    if (!dongName) return;
    if (!grouped.has(dongName)) {
      grouped.set(dongName, {
        dongName,
        floorCount: 0,
        maxFloor: null,
        minFloor: null,
        mainPurpose: globalMainPurpose,
        structure: globalStructure,
        useApprovalDate: globalUseApprovalDate
      });
    }
  });
  return [...grouped.values()].map((entry) => {
    const meta = dongMeta.get(String(entry.dongName || ''));
    return {
      ...entry,
      mainPurpose: pickTopCountValue(meta?.mainPurposeCounts, entry.mainPurpose || '-'),
      structure: pickTopCountValue(meta?.structureCounts, entry.structure || '-'),
      useApprovalDate: pickTopCountValue(meta?.useApprovalDateCounts, entry.useApprovalDate || '-')
    };
  });
}

function classifyExposPubuseType(item = {}) {
  const token = normalizeNameToken([
    pickFirst(item, ['exposPubuseGbCdNm', 'exposPubuseSeCdNm', 'prvusePublicSeCdNm'], ''),
    pickFirst(item, ['exposPubuseGbCd', 'exposPubuseSeCd', 'prvusePublicSeCd'], '')
  ].join(' '));
  if (!token) return 'unknown';
  if (token.includes('전유') || token.includes('private') || token.includes('prv')) return 'exclusive';
  if (token.includes('공용') || token.includes('common') || token.includes('pub')) return 'common';
  return 'unknown';
}

function shouldIncludeCommonForSupply(mainAtchName, etcPurpose) {
  const mainAtch = normalizeNameToken(mainAtchName || '');
  const etc = normalizeNameToken(etcPurpose || '');
  if (!mainAtch.includes(normalizeNameToken(MAIN_BUILDING_TOKEN))) return false;
  return SUPPLY_COMMON_ETC_TOKENS.some((token) => etc.includes(normalizeNameToken(token)));
}

function mapHoInfo(exclusiveItems, dongHintRows = []) {
  const mgmPkToDong = new Map();
  (Array.isArray(dongHintRows) ? dongHintRows : []).forEach((row) => {
    const mgmPk = normalizeMgmPk(pickFirst(row, ['mgmBldrgstPk'], ''));
    if (!mgmPk) return;
    const dong = formatDongName(pickFirst(row, ['dongNm', 'bldNm'], ''));
    if (!dong || dong === '동 미상') return;
    if (!mgmPkToDong.has(mgmPk)) mgmPkToDong.set(mgmPk, dong);
  });

  const grouped = new Map();
  (Array.isArray(exclusiveItems) ? exclusiveItems : []).forEach((item) => {
    const mgmPk = normalizeMgmPk(pickFirst(item, ['mgmBldrgstPk'], ''));
    const rawDong = String(pickFirst(item, ['dongNm'], '')).trim();
    const dongFromHint = mgmPk ? String(mgmPkToDong.get(mgmPk) || '').trim() : '';
    const dongName = formatDongName(rawDong || dongFromHint || '동 미상');
    const hoName = formatHoName(pickFirst(item, ['hoNm'], '-'));
    if (hoName === '-') return;
    const key = `${dongName}|${hoName}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        dongName,
        hoName,
        mgmBldrgstPk: mgmPk,
        floorNumber: toInteger(pickFirst(item, ['flrNo'])),
        floorType: String(pickFirst(item, ['flrGbCdNm'], '-')),
        mainPurpose: String(pickFirst(item, ['mainPurpsCdNm', 'mainPurpsNm'], '-')),
        exclusiveAreaSquareMeter: null,
        commonAreaSquareMeter: null,
        supplyAreaSquareMeter: null,
        areaSquareMeter: null,
        mainPurposeCounts: new Map()
      });
    }

    const row = grouped.get(key);
    if (!Number.isFinite(Number(row.floorNumber))) {
      row.floorNumber = toInteger(pickFirst(item, ['flrNo']));
    }
    if (!row.floorType || row.floorType === '-') {
      row.floorType = String(pickFirst(item, ['flrGbCdNm'], '-'));
    }
    const rowMainPurpose = String(pickFirst(item, ['mainPurpsCdNm', 'mainPurpsNm'], '')).trim();
    if (rowMainPurpose) {
      countTextValue(row.mainPurposeCounts, rowMainPurpose);
      row.mainPurpose = pickTopCountValue(row.mainPurposeCounts, row.mainPurpose || '-');
    }
    if (!row.mgmBldrgstPk) {
      row.mgmBldrgstPk = mgmPk;
    }

    const area = toNumberLoose(pickFirst(item, ['area', 'exposPubuseArea', 'prvuseAr', 'pubuseAr'], null));
    if (!Number.isFinite(area) || area <= 0) return;

    const type = classifyExposPubuseType(item);
    if (type === 'exclusive') {
      row.exclusiveAreaSquareMeter = Number.isFinite(Number(row.exclusiveAreaSquareMeter))
        ? Number(row.exclusiveAreaSquareMeter) + area
        : area;
      return;
    }
    if (type === 'common') {
      const includeCommonForSupply = shouldIncludeCommonForSupply(
        pickFirst(item, ['mainAtchGbCdNm', 'mainAtchGbNm'], ''),
        pickFirst(item, ['etcPurps', 'etcUse'], '')
      );
      if (includeCommonForSupply) {
        row.commonAreaSquareMeter = Number.isFinite(Number(row.commonAreaSquareMeter))
          ? Number(row.commonAreaSquareMeter) + area
          : area;
      }
      return;
    }

    // Some providers omit explicit 전유/공용 구분. Keep the largest single area as exclusive fallback.
    row.exclusiveAreaSquareMeter = Number.isFinite(Number(row.exclusiveAreaSquareMeter))
      ? Math.max(Number(row.exclusiveAreaSquareMeter), area)
      : area;
  });

  return [...grouped.values()]
    .map((item) => {
      const exclusive = toNumberLoose(item.exclusiveAreaSquareMeter);
      const common = toNumberLoose(item.commonAreaSquareMeter);
      const supply = Number.isFinite(exclusive) && Number.isFinite(common)
        ? exclusive + common
        : (Number.isFinite(exclusive) ? exclusive : null);
      return {
        ...item,
        mainPurpose: String(item.mainPurpose || '-').trim() || '-',
        exclusiveAreaSquareMeter: Number.isFinite(exclusive) ? trunc2(exclusive) : null,
        commonAreaSquareMeter: Number.isFinite(common) ? trunc2(common) : null,
        supplyAreaSquareMeter: Number.isFinite(supply) ? trunc2(supply) : null,
        areaSquareMeter: Number.isFinite(exclusive)
          ? trunc2(exclusive)
          : (Number.isFinite(supply) ? trunc2(supply) : null)
      };
    })
    .map((item) => {
      const out = { ...item };
      delete out.mainPurposeCounts;
      return out;
    })
    .filter((item) => item.hoName !== '-');
}

function mapApDongOulnRawRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((item) => ({
    dongNm: String(pickFirst(item, ['dongNm', 'bldNm'], '')).trim() || '-',
    hoNm: String(pickFirst(item, ['hoNm'], '')).trim() || '-',
    flrNo: toIntegerLoose(pickFirst(item, ['flrNo'], null)),
    flrGbCdNm: String(pickFirst(item, ['flrGbCdNm'], '')).trim() || '-',
    mgmBldrgstPk: normalizeMgmPk(pickFirst(item, ['mgmBldrgstPk'], ''))
  }));
}

function mapApExposPubuseAreaRawRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((item) => ({
    dongNm: String(pickFirst(item, ['dongNm'], '')).trim() || '-',
    hoNm: String(pickFirst(item, ['hoNm'], '')).trim() || '-',
    flrNo: toIntegerLoose(pickFirst(item, ['flrNo'], null)),
    flrGbCdNm: String(pickFirst(item, ['flrGbCdNm'], '')).trim() || '-',
    exposPubuseGbCdNm: String(pickFirst(item, ['exposPubuseGbCdNm', 'exposPubuseSeCdNm'], '')).trim() || '-',
    mainAtchGbCdNm: String(pickFirst(item, ['mainAtchGbCdNm'], '')).trim() || '-',
    etcPurps: String(pickFirst(item, ['etcPurps'], '')).trim() || '-',
    area: toNumberLoose(pickFirst(item, ['area', 'exposPubuseArea', 'prvuseAr', 'pubuseAr'], null)),
    mgmBldrgstPk: normalizeMgmPk(pickFirst(item, ['mgmBldrgstPk'], ''))
  }));
}

function mapBrFlrOulnRawRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((item) => ({
    dongNm: String(pickFirst(item, ['dongNm', 'bldNm'], '')).trim() || '-',
    hoNm: String(pickFirst(item, ['hoNm'], '')).trim() || '-',
    flrNo: toIntegerLoose(pickFirst(item, ['flrNo'], null)),
    flrGbCdNm: String(pickFirst(item, ['flrGbCdNm'], '')).trim() || '-',
    mainPurpsCdNm: String(pickFirst(item, ['mainPurpsCdNm'], '')).trim() || '-',
    etcPurps: String(pickFirst(item, ['etcPurps'], '')).trim() || '-',
    area: toNumberLoose(pickFirst(item, ['area'], null)),
    mgmBldrgstPk: normalizeMgmPk(pickFirst(item, ['mgmBldrgstPk'], ''))
  }));
}

function mapBrExposPubuseAreaRawRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((item) => ({
    dongNm: String(pickFirst(item, ['dongNm'], '')).trim() || '-',
    hoNm: String(pickFirst(item, ['hoNm'], '')).trim() || '-',
    flrNo: toIntegerLoose(pickFirst(item, ['flrNo'], null)),
    flrGbCdNm: String(pickFirst(item, ['flrGbCdNm'], '')).trim() || '-',
    exposPubuseGbCdNm: String(pickFirst(item, ['exposPubuseGbCdNm', 'exposPubuseSeCdNm'], '')).trim() || '-',
    mainAtchGbCdNm: String(pickFirst(item, ['mainAtchGbCdNm'], '')).trim() || '-',
    mainPurpsCdNm: String(pickFirst(item, ['mainPurpsCdNm'], '')).trim() || '-',
    etcPurps: String(pickFirst(item, ['etcPurps'], '')).trim() || '-',
    area: toNumberLoose(pickFirst(item, ['area', 'exposPubuseArea', 'prvuseAr', 'pubuseAr'], null)),
    mgmBldrgstPk: normalizeMgmPk(pickFirst(item, ['mgmBldrgstPk'], ''))
  }));
}

async function fetchBuildingRegistryDetails(parcel) {
  if (!BUILDING_REGISTRY_SERVICE_KEY || !parcel) {
    return {
      available: false,
      reason: 'BUILDING_REGISTRY_SERVICE_KEY 누락 또는 지번 파라미터 부족',
      summary: null,
      dongInfo: [],
      hoInfo: [],
      apDongOulnInfo: [],
      apExposPubuseAreaInfo: [],
      apDongOulnRawRows: [],
      apExposPubuseAreaRawRows: [],
      brFlrOulnRawRows: [],
      brExposPubuseAreaRawRows: []
    };
  }

  try {
    // Run sequentially so public API spikes/timeouts are less likely.
    const titleItems = await callBuildingRegistryApi('getBrTitleInfo', parcel, {
      numOfRows: 50,
      timeoutMs: 25000,
      retries: 1
    }).catch(() => []);
    const recapItems = await callBuildingRegistryApi('getBrRecapTitleInfo', parcel, {
      numOfRows: 50,
      timeoutMs: 25000,
      retries: 1
    }).catch(() => []);
    const floorItems = await callBuildingRegistryApi('getBrFlrOulnInfo', parcel, {
      numOfRows: 500,
      timeoutMs: 25000,
      retries: 1
    }).catch(() => []);
    const exclusiveItems = await callBuildingRegistryApi('getBrExposPubuseAreaInfo', parcel, {
      numOfRows: 500,
      timeoutMs: 25000,
      retries: 1
    }).catch(() => []);
    const exposItems = await callBuildingRegistryApi('getBrExposInfo', parcel, {
      numOfRows: 500,
      timeoutMs: 25000,
      retries: 1
    }).catch(() => []);
    const apDongOulnRaw = await callBuildingRegistryApi('getApDongOulnInfo', parcel, {
      numOfRows: 500,
      timeoutMs: 25000,
      retries: 1
    }).catch(() => []);
    const apExposPubuseAreaRaw = await callBuildingRegistryApi('getApExposPubuseAreaInfo', parcel, {
      numOfRows: 1000,
      timeoutMs: 25000,
      retries: 1
    }).catch(() => []);

    const summary = mapBuildingRegistrySummary(titleItems, recapItems);
    const dongInfo = mapDongInfo(floorItems, [...titleItems, ...recapItems]);
    const hoInfoPrimary = mapHoInfo(exclusiveItems, floorItems).map((item) => ({ ...item, source: 'br-expos-pubuse' }));
    const hoInfoSupplement = mapHoInfo(exposItems, floorItems).map((item) => ({ ...item, source: 'br-expos' }));
    const hoInfoMap = new Map();
    hoInfoPrimary.forEach((item) => {
      const key = `${String(item?.dongName || '').trim()}|${String(item?.hoName || '').trim()}`;
      if (!key) return;
      hoInfoMap.set(key, item);
    });
    hoInfoSupplement.forEach((item) => {
      const key = `${String(item?.dongName || '').trim()}|${String(item?.hoName || '').trim()}`;
      if (!key || hoInfoMap.has(key)) return;
      hoInfoMap.set(key, item);
    });
    const hoInfo = [...hoInfoMap.values()];
    const apDongOulnInfo = mapDongInfo(apDongOulnRaw, [...titleItems, ...recapItems]);
    const apExposPubuseAreaInfo = mapHoInfo(apExposPubuseAreaRaw, apDongOulnRaw);
    const apDongOulnRawRows = mapApDongOulnRawRows(apDongOulnRaw);
    const apExposPubuseAreaRawRows = mapApExposPubuseAreaRawRows(apExposPubuseAreaRaw);
    const brFlrOulnRawRows = mapBrFlrOulnRawRows(floorItems);
    const brExposPubuseAreaRawRows = [
      ...mapBrExposPubuseAreaRawRows(exclusiveItems),
      ...mapBrExposPubuseAreaRawRows(exposItems)
    ];
    const noCoreData = !titleItems.length && !recapItems.length && !floorItems.length && !exclusiveItems.length && !exposItems.length;
    const reason = noCoreData
      ? '건축물대장 API 응답이 지연되거나 비어 있습니다. 잠시 후 다시 시도해 주세요.'
      : ((!dongInfo.length && !hoInfo.length)
          ? '해당 필지에서 동/호 공개 항목이 조회되지 않았습니다. (공공데이터 원본 미제공 또는 다른 대장 유형)'
          : '');

    return {
      available: !noCoreData,
      reason,
      summary,
      dongInfo,
      hoInfo,
      apDongOulnInfo,
      apExposPubuseAreaInfo,
      apDongOulnRawRows,
      apExposPubuseAreaRawRows,
      brFlrOulnRawRows,
      brExposPubuseAreaRawRows,
      debug: {
        titleCount: titleItems.length,
        recapCount: recapItems.length,
        floorCount: floorItems.length,
        exclusiveCount: exclusiveItems.length,
        exposCount: exposItems.length,
        apDongOulnCount: apDongOulnRaw.length,
        apExposPubuseAreaCount: apExposPubuseAreaRaw.length
      }
    };
  } catch (error) {
    return {
      available: false,
      reason: `건축물대장 API 조회 실패: ${error.response?.data?.response?.header?.resultMsg || error.message}`,
      summary: null,
      dongInfo: [],
      hoInfo: [],
      apDongOulnInfo: [],
      apExposPubuseAreaInfo: [],
      apDongOulnRawRows: [],
      apExposPubuseAreaRawRows: [],
      brFlrOulnRawRows: [],
      brExposPubuseAreaRawRows: [],
      debug: null
    };
  }
}

async function callRtmsApiByMonth(endpointUrl, lawdCd, dealYmd) {
  if (!MOLIT_RTMS_SERVICE_KEY) return [];
  const response = await axios.get(endpointUrl, {
    params: {
      serviceKey: MOLIT_RTMS_SERVICE_KEY,
      LAWD_CD: lawdCd,
      DEAL_YMD: dealYmd,
      numOfRows: 1000,
      pageNo: 1,
      _type: 'json'
    },
    timeout: 16000
  });
  return normalizeItemsFromApi(response);
}

async function fetchRtmsRecords(endpointUrl, lawdCd, months = []) {
  const rows = [];
  for (const month of months) {
    try {
      const items = await callRtmsApiByMonth(endpointUrl, lawdCd, month);
      rows.push(...items);
    } catch (_error) {
      // skip month-level failures and continue
    }
  }
  const seen = new Set();
  return rows.filter((row) => {
    const key = [
      String(pickFirst(row, ['aptNm', 'offiNm', 'sggCd'], '')),
      String(pickFirst(row, ['jibun', 'umdNm'], '')),
      String(pickFirst(row, ['excluUseAr', 'excluUseAr', 'buildingAr'], '')),
      String(pickFirst(row, ['floor'], '')),
      String(pickFirst(row, ['dealYear'], '')),
      String(pickFirst(row, ['dealMonth'], '')),
      String(pickFirst(row, ['dealDay'], '')),
      String(pickFirst(row, ['dealAmount'], ''))
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildHoCandidatesFromRtms(records, sourceType) {
  return records
    .map((row) => {
      const area = toNumber(pickFirst(row, ['excluUseAr', 'buildingAr', 'area']));
      const floor = toInteger(pickFirst(row, ['floor']));
      const dong = String(pickFirst(row, ['aptDong', 'dong', 'umdNm'], '-')).trim() || '-';
      const name = String(pickFirst(row, ['aptNm', 'offiNm'], '-')).trim() || '-';
      return {
        dongName: dong,
        hoName: floor ? `${floor}층` : '-',
        floorNumber: floor,
        floorType: sourceType === 'apt' ? '공동주택(실거래)' : '오피스텔(실거래)',
        areaSquareMeter: area,
        pyeongLabel: toPyeongLabel(area),
        name,
        source: sourceType
      };
    })
    .filter((item) => item.hoName !== '-' || Number.isFinite(item.areaSquareMeter))
    .slice(0, 300);
}

function groupDongCandidates(hoCandidates = []) {
  const map = new Map();
  hoCandidates.forEach((item) => {
    const key = item.dongName || '동 미상';
    if (!map.has(key)) {
      map.set(key, {
        dongName: key,
        floorCount: 0,
        maxFloor: null,
        minFloor: null
      });
    }
    const row = map.get(key);
    row.floorCount += 1;
    const f = Number(item.floorNumber);
    if (Number.isFinite(f)) {
      row.maxFloor = row.maxFloor === null ? f : Math.max(row.maxFloor, f);
      row.minFloor = row.minFloor === null ? f : Math.min(row.minFloor, f);
    }
  });
  return [...map.values()];
}

function toPnuFromParcel(parcel) {
  if (!parcel?.sigunguCd || !parcel?.bjdongCd || !parcel?.bun || !parcel?.ji) return null;
  const legal10 = `${parcel.sigunguCd}${parcel.bjdongCd}`;
  if (legal10.length !== 10) return null;
  const regstrSe = String(parcel.platGbCd) === '1' ? '2' : '1';
  return `${legal10}${regstrSe}${String(parcel.bun).padStart(4, '0')}${String(parcel.ji).padStart(4, '0')}`;
}

function normalizeVworldApartRows(raw) {
  const root = raw?.apartHousingPrices || raw || {};
  const row = root?.field;
  if (!row) return [];
  if (Array.isArray(row)) return row;
  return [row];
}

async function callVworldApartAttr(pnu, stdrYear, pageNo = 1, numOfRows = 300, filters = {}) {
  if (!VWORLD_APT_PRICE_KEY) {
    return { ok: false, reason: 'VWORLD_APT_PRICE_KEY 누락', rows: [] };
  }
  const response = await axios.get(VWORLD_APT_ATTR_URL, {
    params: {
      key: VWORLD_APT_PRICE_KEY,
      pnu,
      stdrYear,
      ...(filters?.dongNm ? { dongNm: filters.dongNm } : {}),
      ...(filters?.hoNm ? { hoNm: filters.hoNm } : {}),
      format: 'json',
      numOfRows,
      pageNo
    },
    timeout: 12000
  });
  const root = response.data?.apartHousingPrices || {};
  const resultCode = String(root?.resultCode || '');
  if (resultCode && resultCode !== 'SUCCESS') {
    return {
      ok: false,
      reason: `${resultCode}: ${String(root?.resultMsg || 'VWorld API 오류')}`,
      rows: []
    };
  }
  return {
    ok: true,
    reason: '',
    rows: normalizeVworldApartRows(response.data)
  };
}

async function fetchVworldApartAttrAllPages(pnu, stdrYear, filters = {}) {
  const pageSize = 100;
  const maxPages = 60;
  const merged = [];
  for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
    const result = await callVworldApartAttr(pnu, stdrYear, pageNo, pageSize, filters);
    if (!result.ok) return result;
    const rows = Array.isArray(result.rows) ? result.rows : [];
    if (!rows.length) break;
    merged.push(...rows);
    if (rows.length < pageSize) break;
  }
  return { ok: true, reason: '', rows: merged };
}

function normalizeDongToken(value) {
  return String(value || '')
    .trim()
    .replace(/동$/u, '')
    .replace(/[^\dA-Za-z가-힣]/g, '');
}

function formatDongName(value) {
  const raw = String(value || '').trim();
  if (!raw) return '동 미상';
  if (/동$/u.test(raw)) return raw;
  if (/^\d+$/u.test(raw)) return `${raw}동`;
  return raw;
}

function formatHoName(value) {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  return raw;
}

function mapHoCandidatesFromVworld(rows = []) {
  return rows
    .map((item) => {
      const area = toNumber(pickFirst(item, ['prvuseAr']));
      const floorRaw = String(pickFirst(item, ['floorNm'], '')).trim();
      const floorNum = toInteger(floorRaw);
      return {
        dongName: String(pickFirst(item, ['dongNm'], '동 미상')).trim() || '동 미상',
        hoName: String(pickFirst(item, ['hoNm'], '-')).trim() || '-',
        floorNumber: floorNum,
        floorType: '공동주택가격',
        areaSquareMeter: area,
        pyeongLabel: toPyeongLabel(area),
        officialPrice: toNumber(pickFirst(item, ['pblntfPc'])),
        source: 'vworld'
      };
    })
    .filter((item) => item.hoName !== '-')
    .slice(0, 1000);
}

function pickRepresentativeUnits(hoCandidates = []) {
  const rows = Array.isArray(hoCandidates) ? hoCandidates : [];
  const map = new Map();
  rows.forEach((item) => {
    const dong = String(item?.dongName || '').trim();
    const ho = String(item?.hoName || '').trim();
    if (!dong || !ho) return;
    const key = `${dong}|${ho}`;
    const current = map.get(key);
    if (!current) {
      map.set(key, item);
      return;
    }
    const currentArea = Number(current?.areaSquareMeter);
    const nextArea = Number(item?.areaSquareMeter);
    const currentValid = Number.isFinite(currentArea) ? currentArea : -1;
    const nextValid = Number.isFinite(nextArea) ? nextArea : -1;
    if (nextValid > currentValid) {
      map.set(key, item);
    } else if (nextValid === currentValid) {
      const curPrice = Number(current?.officialPrice);
      const nextPrice = Number(item?.officialPrice);
      const curPriceValid = Number.isFinite(curPrice) ? curPrice : -1;
      const nextPriceValid = Number.isFinite(nextPrice) ? nextPrice : -1;
      if (nextPriceValid > curPriceValid) map.set(key, item);
    }
  });
  return [...map.values()];
}

function dedupeHoCandidates(hoCandidates = []) {
  const map = new Map();
  hoCandidates.forEach((item) => {
    const dong = String(item?.dongName || '').trim();
    const ho = String(item?.hoName || '').trim();
    if (!dong || !ho) return;
    const key = `${dong}|${ho}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, item);
      return;
    }
    const prevScore = (Number.isFinite(Number(prev.officialPrice)) ? 2 : 0) + (isValidResidentialArea(prev.areaSquareMeter) ? 1 : 0);
    const nextScore = (Number.isFinite(Number(item.officialPrice)) ? 2 : 0) + (isValidResidentialArea(item.areaSquareMeter) ? 1 : 0);
    if (nextScore >= prevScore) map.set(key, item);
  });
  return [...map.values()];
}

function filterVerifiedVworldUnits(hoCandidates = []) {
  return dedupeHoCandidates(hoCandidates)
    .filter((item) => isValidResidentialArea(item.areaSquareMeter))
    .filter((item) => Number.isFinite(Number(item.officialPrice)) && Number(item.officialPrice) > 0);
}

function normalizeAreaBand(areaSquareMeter, step = 0.1) {
  const area = Number(areaSquareMeter);
  if (!Number.isFinite(area) || area <= 0) return null;
  const unit = Number(step);
  if (!Number.isFinite(unit) || unit <= 0) return area;
  return Math.round(area / unit) * unit;
}

function toPyeongNumber(areaSquareMeter) {
  const area = Number(areaSquareMeter);
  if (!Number.isFinite(area) || area <= 0) return null;
  return area / 3.3058;
}

function buildPyeongTypeList(hoCandidates = [], options = {}) {
  const source = Array.isArray(hoCandidates) ? hoCandidates : [];
  const {
    areaBandStep = 0.01,
    minUnits = 1,
    includePriceStats = true,
    enforceResidentialArea = true,
    groupByPyeong = true
  } = options;

  const grouped = new Map();
  source.forEach((item) => {
    if (enforceResidentialArea && !isValidResidentialArea(item.areaSquareMeter)) return;
    const areaRaw = Number(item.areaSquareMeter);
    const areaBand = normalizeAreaBand(areaRaw, areaBandStep);
    if (!Number.isFinite(areaBand) || areaBand <= 0) return;
    const pyeongRaw = areaBand / 3.3058;
    const pyeongBand = Number(pyeongRaw.toFixed(1));
    const key = groupByPyeong ? pyeongBand.toFixed(1) : areaBand.toFixed(2);
    if (!grouped.has(key)) {
      grouped.set(key, {
        areaSqmSum: 0,
        areaSqmMin: null,
        areaSqmMax: null,
        pyeong: pyeongBand,
        unitCount: 0,
        officialPriceMin: null,
        officialPriceMax: null
      });
    }
    const row = grouped.get(key);
    row.areaSqmSum += areaBand;
    row.areaSqmMin = row.areaSqmMin === null ? areaBand : Math.min(row.areaSqmMin, areaBand);
    row.areaSqmMax = row.areaSqmMax === null ? areaBand : Math.max(row.areaSqmMax, areaBand);
    row.unitCount += 1;
    const price = Number(item.officialPrice);
    if (Number.isFinite(price) && price > 0) {
      row.officialPriceMin = row.officialPriceMin === null ? price : Math.min(row.officialPriceMin, price);
      row.officialPriceMax = row.officialPriceMax === null ? price : Math.max(row.officialPriceMax, price);
    }
  });

  return [...grouped.values()]
    .filter((row) => row.unitCount >= minUnits)
    .sort((a, b) => a.pyeong - b.pyeong)
    .map((row) => ({
      label: `${Number(row.pyeong.toFixed(1))}평형`,
      pyeong: Number(row.pyeong.toFixed(1)),
      areaSqm: Number((row.areaSqmSum / row.unitCount).toFixed(2)),
      areaSqmRange: row.areaSqmMin !== null && row.areaSqmMax !== null
        ? [Number(row.areaSqmMin.toFixed(2)), Number(row.areaSqmMax.toFixed(2))]
        : null,
      matchKey: Number(row.pyeong.toFixed(1)).toFixed(1),
      unitCount: row.unitCount,
      ...(includePriceStats
        ? {
            officialPriceMin: row.officialPriceMin,
            officialPriceMax: row.officialPriceMax
          }
        : {})
    }));
}

function parsePyeongNumber(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const matched = raw.match(/-?\d+(\.\d+)?/);
  if (!matched) return null;
  const n = Number(matched[0]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function toOptionalNumber(value) {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function normalizeHoToken(value) {
  return String(value || '')
    .trim()
    .replace(/호$/u, '')
    .replace(/[^\dA-Za-z가-힣]/g, '');
}

function normalizeListingAreaSquareMeter(listing = {}) {
  const supplyArea = toOptionalNumber(
    pickFirst(listing, [
      'supplyAreaSquareMeter',
      'supplySqm',
      'supplyArea',
      'supply',
      '공급면적'
    ], null)
  );
  if (Number.isFinite(supplyArea) && supplyArea > 0) return supplyArea;

  const exclusiveArea = toOptionalNumber(
    pickFirst(listing, [
      'exclusiveAreaSquareMeter',
      'exclusiveSqm',
      'exclusiveArea',
      'exclusive',
      '전용면적'
    ], null)
  );
  if (Number.isFinite(exclusiveArea) && exclusiveArea > 0) return exclusiveArea;

  const pyeong = parsePyeongNumber(pickFirst(listing, ['pyeong', 'pyeongLabel', '평형', '평'], null));
  if (Number.isFinite(pyeong) && pyeong > 0) return pyeong * 3.3058;

  return null;
}

function normalizeListingForMapping(rawListing = {}, index = 0) {
  const dongName = formatDongName(pickFirst(rawListing, ['dongName', 'dong', '동'], ''));
  const hoName = formatHoName(pickFirst(rawListing, ['hoName', 'ho', '호'], ''));
  const supplySqm = toOptionalNumber(
    pickFirst(rawListing, ['supplyAreaSquareMeter', 'supplySqm', 'supplyArea', 'supply', '공급면적'], null)
  );
  const exclusiveSqm = toOptionalNumber(
    pickFirst(rawListing, ['exclusiveAreaSquareMeter', 'exclusiveSqm', 'exclusiveArea', 'exclusive', '전용면적'], null)
  );
  const pyeong = parsePyeongNumber(pickFirst(rawListing, ['pyeong', 'pyeongLabel', '평형', '평'], null));
  return {
    listingId: String(pickFirst(rawListing, ['listingId', 'id'], index + 1)),
    dongName,
    hoName,
    supplySqm,
    exclusiveSqm,
    pyeong,
    areaForMatch: normalizeListingAreaSquareMeter(rawListing),
    raw: rawListing
  };
}

function pickBestPyeongTypeMatch(listing, pyeongTypes = []) {
  const source = Array.isArray(pyeongTypes) ? pyeongTypes : [];
  if (!source.length) return null;
  let best = null;
  let bestScore = -Infinity;
  source.forEach((item) => {
    const areaSqm = Number(item?.areaSqm);
    const pyeong = Number(item?.pyeong);
    let score = 0;
    if (Number.isFinite(listing.areaForMatch) && Number.isFinite(areaSqm)) {
      const areaGap = Math.abs(listing.areaForMatch - areaSqm);
      score += Math.max(0, 80 - (areaGap * 8));
    }
    if (Number.isFinite(listing.pyeong) && Number.isFinite(pyeong)) {
      const pyGap = Math.abs(listing.pyeong - pyeong);
      score += Math.max(0, 40 - (pyGap * 20));
    }
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  });
  if (!best) return null;
  return { ...best, matchScore: Number(bestScore.toFixed(2)) };
}

function pickBestUnitMatch(listing, hoCandidates = []) {
  const source = Array.isArray(hoCandidates) ? hoCandidates : [];
  if (!source.length) return null;

  const targetDong = normalizeDongToken(listing.dongName);
  const targetHo = normalizeHoToken(listing.hoName);
  let best = null;
  let bestScore = -Infinity;

  source.forEach((item) => {
    const candDongRaw = formatDongName(item?.dongName || '');
    const candDong = normalizeDongToken(candDongRaw);
    const candHo = normalizeHoToken(item?.hoName || '');
    const candArea = Number(item?.areaSquareMeter);

    let score = 0;
    if (targetDong && candDong && targetDong === candDong) score += 120;
    if (targetHo && candHo && targetHo === candHo) score += 140;
    if (targetDong && targetHo && candDong === targetDong && candHo === targetHo) score += 220;
    if (Number.isFinite(listing.areaForMatch) && Number.isFinite(candArea)) {
      const areaGap = Math.abs(listing.areaForMatch - candArea);
      score += Math.max(0, 80 - (areaGap * 8));
    }
    if (Number.isFinite(listing.pyeong) && Number.isFinite(candArea)) {
      const pyGap = Math.abs(listing.pyeong - (candArea / 3.3058));
      score += Math.max(0, 40 - (pyGap * 20));
    }
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  });

  if (!best) return null;
  return {
    ...best,
    matchScore: Number(bestScore.toFixed(2)),
    areaGapSqm: Number.isFinite(listing.areaForMatch) && Number.isFinite(Number(best.areaSquareMeter))
      ? Number(Math.abs(listing.areaForMatch - Number(best.areaSquareMeter)).toFixed(2))
      : null
  };
}

function classifyMappingConfidence(unitMatch, pyeongMatch) {
  if (unitMatch) {
    const score = Number(unitMatch.matchScore || 0);
    const gap = Number(unitMatch.areaGapSqm);
    if (score >= 300) return 'high';
    if (score >= 180 || (Number.isFinite(gap) && gap <= 1.0)) return 'medium';
  }
  if (pyeongMatch) {
    const score = Number(pyeongMatch.matchScore || 0);
    if (score >= 80) return 'medium';
  }
  return 'low';
}

function mapListingsWithRealUnits(listings = [], hoCandidates = [], pyeongTypes = []) {
  const normalizedListings = (Array.isArray(listings) ? listings : []).map((item, index) => (
    normalizeListingForMapping(item, index)
  ));
  return normalizedListings.map((listing) => {
    const unitMatch = pickBestUnitMatch(listing, hoCandidates);
    const pyeongMatch = pickBestPyeongTypeMatch(listing, pyeongTypes);
    return {
      listingId: listing.listingId,
      input: listing.raw,
      normalized: {
        dongName: listing.dongName,
        hoName: listing.hoName,
        supplySqm: listing.supplySqm,
        exclusiveSqm: listing.exclusiveSqm,
        pyeong: listing.pyeong,
        areaForMatch: listing.areaForMatch
      },
      match: {
        confidence: classifyMappingConfidence(unitMatch, pyeongMatch),
        unit: unitMatch
          ? {
              dongName: unitMatch.dongName,
              hoName: unitMatch.hoName,
              source: unitMatch.source || '',
              pyeongLabel: unitMatch.pyeongLabel || toPyeongLabel(unitMatch.areaSquareMeter),
              areaSquareMeter: Number.isFinite(Number(unitMatch.areaSquareMeter))
                ? Number(Number(unitMatch.areaSquareMeter).toFixed(2))
                : null,
              officialPrice: toOptionalNumber(unitMatch.officialPrice),
              matchScore: unitMatch.matchScore,
              areaGapSqm: unitMatch.areaGapSqm
            }
          : null,
        pyeongType: pyeongMatch
          ? {
              label: pyeongMatch.label,
              pyeong: pyeongMatch.pyeong,
              areaSqm: pyeongMatch.areaSqm,
              unitCount: pyeongMatch.unitCount,
              matchScore: pyeongMatch.matchScore
            }
          : null
      },
      mappedArea: {
        supplySqm: Number.isFinite(Number(pyeongMatch?.areaSqm))
          ? Number(Number(pyeongMatch.areaSqm).toFixed(2))
          : null,
        exclusiveSqm: Number.isFinite(Number(unitMatch?.areaSquareMeter))
          ? Number(Number(unitMatch.areaSquareMeter).toFixed(2))
          : null
      }
    };
  });
}

function normalizePublicHoCandidates(rows = []) {
  const source = Array.isArray(rows) ? rows : [];
  return source
    .map((item) => {
      const areaSquareMeter = toOptionalNumber(
        pickFirst(item, ['areaSquareMeter', 'exclusiveAreaSquareMeter', 'exclusiveSqm', 'areaSqm', 'exclusiveArea'], null)
      );
      const supplyAreaSquareMeter = toOptionalNumber(
        pickFirst(item, ['supplyAreaSquareMeter', 'supplySqm', 'supplyArea'], null)
      );
      const mappedArea = Number.isFinite(areaSquareMeter)
        ? areaSquareMeter
        : (Number.isFinite(supplyAreaSquareMeter) ? supplyAreaSquareMeter : null);
      return {
        dongName: formatDongName(pickFirst(item, ['dongName', 'dong', '동'], '')),
        hoName: formatHoName(pickFirst(item, ['hoName', 'ho', '호'], '')),
        areaSquareMeter: mappedArea,
        supplyAreaSquareMeter: supplyAreaSquareMeter,
        pyeongLabel: String(pickFirst(item, ['pyeongLabel', 'label'], '') || ''),
        officialPrice: toOptionalNumber(pickFirst(item, ['officialPrice', 'price'], null)),
        source: String(pickFirst(item, ['source'], 'public-payload') || 'public-payload')
      };
    })
    .filter((item) => item.hoName !== '-');
}

function normalizePublicPyeongTypes(rows = []) {
  const source = Array.isArray(rows) ? rows : [];
  return source
    .map((item) => {
      const areaSqm = toOptionalNumber(pickFirst(item, ['areaSqm', 'supplySqm', 'supplyAreaSquareMeter'], null));
      const pyeong = toOptionalNumber(pickFirst(item, ['pyeong', 'pyeongLabel', 'label'], null));
      if (!Number.isFinite(areaSqm) && !Number.isFinite(pyeong)) return null;
      const computedPyeong = Number.isFinite(pyeong)
        ? Number(pyeong.toFixed(1))
        : Number((Number(areaSqm) / 3.3058).toFixed(1));
      const computedAreaSqm = Number.isFinite(areaSqm)
        ? Number(areaSqm.toFixed(2))
        : Number((Number(pyeong) * 3.3058).toFixed(2));
      return {
        label: String(item?.label || `${computedPyeong}평형`),
        pyeong: computedPyeong,
        areaSqm: computedAreaSqm,
        unitCount: Math.max(1, toInteger(item?.unitCount) || 1)
      };
    })
    .filter(Boolean);
}

function pickRealPyeongSourceRows(localCsvAptPrice, vworldAptPrice, registry) {
  const localRowsRaw = Array.isArray(localCsvAptPrice?.hoCandidates) ? localCsvAptPrice.hoCandidates : [];
  const localRows = pickRepresentativeUnits(localRowsRaw)
    .filter((item) => !isUndergroundUnit(item))
    .filter((item) => isValidResidentialArea(item.areaSquareMeter));
  if (localRows.length) {
    return {
      source: 'local-csv',
      rows: localRows
    };
  }

  const vworldRowsRaw = Array.isArray(vworldAptPrice?.hoCandidates) ? vworldAptPrice.hoCandidates : [];
  const vworldRows = filterVerifiedVworldUnits(vworldRowsRaw);
  if (vworldRows.length) {
    return {
      source: 'vworld',
      rows: pickRepresentativeUnits(vworldRows)
    };
  }

  const registryRows = pickRepresentativeUnits(
    (registry?.hoInfo || [])
      .map((item) => ({ ...item, source: 'registry' }))
      .filter((item) => !isUndergroundUnit(item))
      .filter((item) => isValidResidentialArea(item.areaSquareMeter))
  );
  return {
    source: registryRows.length ? 'registry-fallback' : 'none',
    rows: registryRows
  };
}

function normalizeRegionPartsForLh(regionText = '') {
  const parts = String(regionText || '').trim().split(/\s+/).filter(Boolean);
  return {
    sido: parts[0] || '',
    sigungu: parts[1] || ''
  };
}

function normalizeItemsFromUnknownApi(rawData) {
  if (!rawData) return [];
  if (Array.isArray(rawData)) return rawData;
  const responseBody = rawData?.response?.body || rawData?.body || null;
  const responseItem = responseBody?.items?.item || responseBody?.items || null;
  if (Array.isArray(responseItem)) return responseItem;
  if (responseItem && typeof responseItem === 'object') return [responseItem];
  const dataField = rawData?.data;
  if (Array.isArray(dataField)) return dataField;
  if (Array.isArray(dataField?.items)) return dataField.items;
  if (Array.isArray(rawData?.items)) return rawData.items;
  if (rawData && typeof rawData === 'object') return [rawData];
  return [];
}

function toLhSupplyRow(item = {}) {
  const exclusive = toNumberLoose(pickFirst(item, [
    'suplyPrvuseAr',
    'prvuseAr',
    'excluUseAr',
    'exclusiveAreaSquareMeter',
    'exclusiveArea',
    '전용면적'
  ], null));
  const common = toNumberLoose(pickFirst(item, [
    'suplyCmnuseAr',
    'cmnuseAr',
    'commonAreaSquareMeter',
    'commonArea',
    '공용면적'
  ], null));
  const supplyRaw = toNumberLoose(pickFirst(item, [
    'suplyAr',
    'supplyAreaSquareMeter',
    'supplyArea',
    '공급면적'
  ], null));
  const supply = Number.isFinite(exclusive) && Number.isFinite(common)
    ? (exclusive + common)
    : supplyRaw;
  if (!Number.isFinite(exclusive) || exclusive <= 0) return null;
  if (!Number.isFinite(supply) || supply <= 0) return null;
  return {
    complexName: String(pickFirst(item, ['aptNm', 'houseNm', 'cntrctBldNm', 'danjiNm', '단지명'], '')).trim(),
    exclusiveAreaSquareMeter: Number(exclusive.toFixed(2)),
    supplyAreaSquareMeter: Number(supply.toFixed(2))
  };
}

function buildLhSupplyHints(rows = []) {
  const grouped = new Map();
  (Array.isArray(rows) ? rows : []).forEach((item) => {
    const ex = Number(item?.exclusiveAreaSquareMeter);
    const sup = Number(item?.supplyAreaSquareMeter);
    if (!Number.isFinite(ex) || !Number.isFinite(sup) || ex <= 0 || sup <= 0) return;
    const key = ex.toFixed(2);
    if (!grouped.has(key)) {
      grouped.set(key, {
        exclusiveAreaSquareMeter: ex,
        supplyAreaSquareMeterSum: 0,
        count: 0
      });
    }
    const row = grouped.get(key);
    row.supplyAreaSquareMeterSum += sup;
    row.count += 1;
  });
  return [...grouped.values()]
    .map((row) => ({
      exclusiveAreaSquareMeter: Number(row.exclusiveAreaSquareMeter.toFixed(2)),
      supplyAreaSquareMeter: Number((row.supplyAreaSquareMeterSum / row.count).toFixed(2)),
      count: row.count
    }))
    .sort((a, b) => a.exclusiveAreaSquareMeter - b.exclusiveAreaSquareMeter);
}

async function fetchLhSupplyHints(normalized) {
  if (!LH_SUPPLY_API_URL || !LH_SUPPLY_SERVICE_KEY) {
    return { available: false, reason: 'LH 공급면적 API 설정이 없습니다.', hints: [] };
  }
  const aptName = String(normalized?.building?.name || '').trim();
  if (!aptName) {
    return { available: false, reason: '단지명이 없습니다.', hints: [] };
  }
  const cacheKey = `${aptName}|${normalized?.building?.region || ''}`;
  if (LH_SUPPLY_CACHE.has(cacheKey)) return LH_SUPPLY_CACHE.get(cacheKey);

  const region = normalizeRegionPartsForLh(normalized?.building?.region || '');
  const candidates = [
    { aptNm: aptName, pageNo: 1, numOfRows: 500, serviceKey: LH_SUPPLY_SERVICE_KEY, _type: 'json' },
    { houseNm: aptName, pageNo: 1, numOfRows: 500, serviceKey: LH_SUPPLY_SERVICE_KEY, _type: 'json' },
    { danjiNm: aptName, pageNo: 1, numOfRows: 500, serviceKey: LH_SUPPLY_SERVICE_KEY, _type: 'json' },
    { aptNm: aptName, sido: region.sido, sigungu: region.sigungu, pageNo: 1, numOfRows: 500, serviceKey: LH_SUPPLY_SERVICE_KEY, _type: 'json' }
  ];

  let merged = [];
  for (const params of candidates) {
    try {
      const response = await axios.get(LH_SUPPLY_API_URL, { params, timeout: 15000 });
      const rows = normalizeItemsFromUnknownApi(response?.data)
        .map((item) => toLhSupplyRow(item))
        .filter(Boolean);
      merged.push(...rows);
      if (rows.length >= 5) break;
    } catch (_error) {
      // try next query pattern
    }
  }

  if (!merged.length) {
    const empty = { available: false, reason: 'LH 공급면적 원천 매칭 실패', hints: [] };
    LH_SUPPLY_CACHE.set(cacheKey, empty);
    return empty;
  }

  const aptToken = normalizeNameToken(aptName);
  const filtered = merged.filter((item) => {
    const token = normalizeNameToken(item.complexName || '');
    return !token || token.includes(aptToken) || aptToken.includes(token);
  });
  const hints = buildLhSupplyHints(filtered.length ? filtered : merged);
  const out = {
    available: hints.length > 0,
    reason: hints.length ? '' : 'LH 공급면적 힌트 생성 실패',
    hints
  };
  LH_SUPPLY_CACHE.set(cacheKey, out);
  return out;
}

function applyLhSupplyFallback(hoCandidates = [], lhSupply = { available: false, hints: [] }) {
  const units = Array.isArray(hoCandidates) ? hoCandidates : [];
  const hints = Array.isArray(lhSupply?.hints) ? lhSupply.hints : [];
  if (!units.length || !hints.length) {
    return { rows: units, appliedCount: 0 };
  }
  let appliedCount = 0;
  const rows = units.map((item) => {
    const hasSupply = Number.isFinite(toNumberLoose(item?.supplyAreaSquareMeter));
    if (hasSupply) return item;
    const exclusive = toNumberLoose(item?.exclusiveAreaSquareMeter ?? item?.areaSquareMeter);
    if (!Number.isFinite(exclusive) || exclusive <= 0) return item;
    let best = null;
    let bestGap = Number.POSITIVE_INFINITY;
    hints.forEach((hint) => {
      const ex = Number(hint?.exclusiveAreaSquareMeter);
      const sup = Number(hint?.supplyAreaSquareMeter);
      if (!Number.isFinite(ex) || !Number.isFinite(sup)) return;
      const gap = Math.abs(exclusive - ex);
      if (gap < bestGap) {
        bestGap = gap;
        best = hint;
      }
    });
    // Match only when exclusive area is close enough to avoid wrong type assignment.
    if (!best || bestGap > 1.5) return item;
    appliedCount += 1;
    return {
      ...item,
      exclusiveAreaSquareMeter: Number(exclusive.toFixed(2)),
      supplyAreaSquareMeter: Number(Number(best.supplyAreaSquareMeter).toFixed(2)),
      source: String(item?.source || '').includes('lh-supply')
        ? item.source
        : `${item?.source || 'unknown'}+lh-supply`
    };
  });
  return { rows, appliedCount };
}

function buildSupplyHintsFromUnits(hoCandidates = []) {
  const rows = Array.isArray(hoCandidates) ? hoCandidates : [];
  const grouped = new Map();
  rows.forEach((item) => {
    const exclusive = toNumberLoose(item?.exclusiveAreaSquareMeter ?? item?.areaSquareMeter);
    const supply = toNumberLoose(item?.supplyAreaSquareMeter ?? item?.supplyArea);
    if (!Number.isFinite(exclusive) || !Number.isFinite(supply) || exclusive <= 0 || supply <= 0) return;
    const key = exclusive.toFixed(2);
    if (!grouped.has(key)) {
      grouped.set(key, {
        exclusiveAreaSquareMeter: exclusive,
        supplyAreaSquareMeterSum: 0,
        count: 0
      });
    }
    const row = grouped.get(key);
    row.supplyAreaSquareMeterSum += supply;
    row.count += 1;
  });
  return [...grouped.values()].map((row) => ({
    exclusiveAreaSquareMeter: Number(row.exclusiveAreaSquareMeter.toFixed(2)),
    supplyAreaSquareMeter: Number((row.supplyAreaSquareMeterSum / row.count).toFixed(2)),
    count: row.count
  }));
}

function getComplexSupplyCacheKey(normalized) {
  const aptName = normalizeNameToken(normalized?.building?.name || '');
  const region = normalizeNameToken(normalized?.building?.region || '');
  if (!aptName) return '';
  return `${aptName}|${region}`;
}

function updateComplexSupplyHintsCache(normalized, hoCandidates = []) {
  const key = getComplexSupplyCacheKey(normalized);
  if (!key) return;
  const nextHints = buildSupplyHintsFromUnits(hoCandidates);
  if (!nextHints.length) return;
  const prevHints = COMPLEX_SUPPLY_HINT_CACHE.get(key) || [];
  const merged = new Map();
  [...prevHints, ...nextHints].forEach((item) => {
    const ex = Number(item?.exclusiveAreaSquareMeter);
    const sup = Number(item?.supplyAreaSquareMeter);
    if (!Number.isFinite(ex) || !Number.isFinite(sup)) return;
    const hintKey = ex.toFixed(2);
    if (!merged.has(hintKey)) {
      merged.set(hintKey, {
        exclusiveAreaSquareMeter: ex,
        supplyAreaSquareMeter: sup,
        count: Number(item?.count) || 1
      });
      return;
    }
    const prev = merged.get(hintKey);
    const prevCount = Number(prev.count) || 1;
    const nextCount = Number(item?.count) || 1;
    const weighted = ((Number(prev.supplyAreaSquareMeter) * prevCount) + (sup * nextCount)) / (prevCount + nextCount);
    merged.set(hintKey, {
      exclusiveAreaSquareMeter: ex,
      supplyAreaSquareMeter: Number(weighted.toFixed(2)),
      count: prevCount + nextCount
    });
  });
  COMPLEX_SUPPLY_HINT_CACHE.set(key, [...merged.values()]);
}

function applyComplexSupplyFallback(normalized, hoCandidates = []) {
  const key = getComplexSupplyCacheKey(normalized);
  if (!key || !COMPLEX_SUPPLY_HINT_CACHE.has(key)) {
    return { rows: hoCandidates, appliedCount: 0 };
  }
  const hints = COMPLEX_SUPPLY_HINT_CACHE.get(key) || [];
  if (!hints.length) return { rows: hoCandidates, appliedCount: 0 };

  let appliedCount = 0;
  const rows = (Array.isArray(hoCandidates) ? hoCandidates : []).map((item) => {
    const hasSupply = Number.isFinite(toNumberLoose(item?.supplyAreaSquareMeter ?? item?.supplyArea));
    if (hasSupply) return item;
    const exclusive = toNumberLoose(item?.exclusiveAreaSquareMeter ?? item?.areaSquareMeter);
    if (!Number.isFinite(exclusive) || exclusive <= 0) return item;

    let best = null;
    let bestGap = Number.POSITIVE_INFINITY;
    hints.forEach((hint) => {
      const ex = Number(hint?.exclusiveAreaSquareMeter);
      const sup = Number(hint?.supplyAreaSquareMeter);
      if (!Number.isFinite(ex) || !Number.isFinite(sup)) return;
      const gap = Math.abs(exclusive - ex);
      if (gap < bestGap) {
        bestGap = gap;
        best = hint;
      }
    });
    if (!best || bestGap > 1.5) return item;
    appliedCount += 1;
    return {
      ...item,
      exclusiveAreaSquareMeter: Number(exclusive.toFixed(2)),
      supplyAreaSquareMeter: Number(Number(best.supplyAreaSquareMeter).toFixed(2)),
      source: String(item?.source || '').includes('complex-supply-map')
        ? item.source
        : `${item?.source || 'unknown'}+complex-supply-map`
    };
  });
  return { rows, appliedCount };
}

async function fetchVworldApartPriceUnits(parcel) {
  const pnu = toPnuFromParcel(parcel);
  if (!pnu) {
    return {
      available: false,
      reason: 'VWorld 조회용 PNU 생성 실패',
      year: null,
      pnu: null,
      hoCandidates: []
    };
  }
  if (!VWORLD_APT_PRICE_KEY) {
    return {
      available: false,
      reason: 'VWORLD_APT_PRICE_KEY 누락',
      year: null,
      pnu,
      hoCandidates: []
    };
  }

  const years = [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2];
  for (const y of years) {
    const result = await fetchVworldApartAttrAllPages(pnu, y).catch((error) => ({
      ok: false,
      reason: error.response?.data?.apartHousingPrices?.resultMsg || error.message || 'VWorld 조회 오류',
      rows: []
    }));
    if (!result.ok) {
      if (String(result.reason || '').includes('INCORRECT_KEY')) {
        return {
          available: false,
          reason: result.reason,
          year: y,
          pnu,
          hoCandidates: []
        };
      }
      continue;
    }
    const hoCandidates = mapHoCandidatesFromVworld(result.rows);
    if (hoCandidates.length) {
      return {
        available: true,
        reason: '',
        year: y,
        pnu,
        hoCandidates
      };
    }
  }

  return {
    available: false,
    reason: 'VWorld 공동주택가격에서 동/호 데이터를 찾지 못했습니다.',
    year: null,
    pnu,
    hoCandidates: []
  };
}

function toUnitKey(dongName, hoName) {
  const dong = String(dongName || '').trim();
  const ho = String(hoName || '').trim();
  if (!dong || !ho || ho === '-') return '';
  return `${dong}|${ho}`;
}

function toMgmPkKey(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/[eE][+-]?\d+/u.test(raw)) return '';
  return raw.replace(/\D/g, '');
}

function normalizeMgmPk(value) {
  const key = toMgmPkKey(value);
  return key && key.length >= 10 ? key : null;
}

function toParcelKeyParts(sggCd, stdgCd, plotCd, mno, sno) {
  const sgg = String(sggCd || '').trim();
  const stdg = String(stdgCd || '').trim();
  const plot = String(plotCd || '0').trim();
  const bun = String(mno || '').trim().padStart(4, '0');
  const ji = String(sno || '').trim().padStart(4, '0');
  if (!sgg || !stdg) return '';
  return `${sgg}|${stdg}|${plot}|${bun}|${ji}`;
}

function toParcelKeyFromParcel(parcel) {
  if (!parcel) return '';
  return toParcelKeyParts(parcel.sigunguCd, parcel.bjdongCd, parcel.platGbCd, parcel.bun, parcel.ji);
}

function ensureLocalExposJsonIndexReady() {
  if (!LOCAL_EXPOS_AREA_JSON_PATH) return { ok: false, reason: '전유공용 JSON 파일 없음' };
  if (LOCAL_EXPOS_AREA_JSON_INDEX.ready) return { ok: true, reason: '' };
  try {
    if (!Array.isArray(LOCAL_EXPOS_AREA_JSON_ROWS)) {
      const raw = fs.readFileSync(LOCAL_EXPOS_AREA_JSON_PATH, 'utf8');
      const json = JSON.parse(raw);
      LOCAL_EXPOS_AREA_JSON_ROWS = Array.isArray(json?.Data) ? json.Data : [];
    }
    const byParcel = new Map();
    LOCAL_EXPOS_AREA_JSON_ROWS
      .filter((row) => row && typeof row === 'object')
      .forEach((row) => {
        const parcelKey = toParcelKeyParts(row.SGG_CD, row.STDG_CD, row.PLOT_SE_CD, row.MNO, row.SNO);
        if (!parcelKey) return;
        if (!byParcel.has(parcelKey)) byParcel.set(parcelKey, []);
        byParcel.get(parcelKey).push({
          dongName: formatDongName(row.DNG_NM),
          hoName: formatHoName(row.HO_NM),
          mgmBldrgstPk: normalizeMgmPk(row.BDRG_SN),
          floorNumber: toInteger(row.FLR_NO),
          floorType: String(row.FLR_SE_CD_NM || '-'),
          epcmName: normalizeNameToken(row.EPCM_SE_CD_NM || ''),
          etcUse: normalizeNameToken(row.ETC_USG || ''),
          manxName: normalizeNameToken(String(row.MANX_SE_CD_NM || '')),
          area: toNumberLoose(row.AREA)
        });
      });
    LOCAL_EXPOS_AREA_JSON_INDEX.byParcel = byParcel;
    LOCAL_EXPOS_AREA_JSON_INDEX.ready = true;
    LOCAL_EXPOS_AREA_JSON_INDEX.lastError = '';
    return { ok: true, reason: '' };
  } catch (error) {
    LOCAL_EXPOS_AREA_JSON_INDEX.ready = false;
    LOCAL_EXPOS_AREA_JSON_INDEX.lastError = error.message || 'index build failed';
    return { ok: false, reason: LOCAL_EXPOS_AREA_JSON_INDEX.lastError };
  }
}

async function fetchLocalExposAreaUnits(parcel) {
  if ((!LOCAL_EXPOS_AREA_JSON_PATH && !LOCAL_EXPOS_AREA_CSV_PATH) || !parcel) {
    return {
      available: false,
      reason: '전유공용면적 원본(JSON/CSV) 경로가 없거나 필지정보가 없습니다.',
      filePath: LOCAL_EXPOS_AREA_JSON_PATH || LOCAL_EXPOS_AREA_CSV_PATH || null,
      hoCandidates: []
    };
  }
  const legalCode = `${String(parcel.sigunguCd || '')}${String(parcel.bjdongCd || '')}`;
  const bun = String(Number.parseInt(String(parcel.bun || '0'), 10) || 0).padStart(4, '0');
  const ji = String(Number.parseInt(String(parcel.ji || '0'), 10) || 0).padStart(4, '0');
  const plat = String(parcel.platGbCd || '0');
  const cacheKey = `${legalCode}|${plat}|${bun}|${ji}|expos`;
  if (LOCAL_EXPOS_AREA_CACHE.has(cacheKey)) return LOCAL_EXPOS_AREA_CACHE.get(cacheKey);
  const exposSourceTag = LOCAL_EXPOS_AREA_JSON_PATH ? 'local-expos-json' : 'local-expos-csv';

  let normalizedRows = [];
  if (LOCAL_EXPOS_AREA_JSON_PATH) {
    const indexed = ensureLocalExposJsonIndexReady();
    if (!indexed.ok) {
      const failed = {
        available: false,
        reason: `전유공용면적 JSON 조회 실패: ${indexed.reason || 'unknown'}`,
        filePath: LOCAL_EXPOS_AREA_JSON_PATH,
        hoCandidates: []
      };
      LOCAL_EXPOS_AREA_CACHE.set(cacheKey, failed);
      return failed;
    }

    const parcelKey = toParcelKeyFromParcel(parcel);
    normalizedRows = [...(LOCAL_EXPOS_AREA_JSON_INDEX.byParcel.get(parcelKey) || [])];
  } else {
    const awkScript = 'NR>1 {'
      + 'c2=$2; c3=$3; c4=$4; c5=$5; c6=$6; '
      + 'gsub(/"/,"",c2); gsub(/"/,"",c3); gsub(/"/,"",c4); gsub(/"/,"",c5); gsub(/"/,"",c6); '
      + 'if (c2==sigungu && c3==bjdong && c4==plat && c5==bun && c6==ji) print'
      + '}';
    const lines = await new Promise((resolve, reject) => {
      const child = spawn('awk', [
        '-F,',
        '-v', `sigungu=${String(parcel.sigunguCd || '')}`,
        '-v', `bjdong=${String(parcel.bjdongCd || '')}`,
        '-v', `plat=${plat}`,
        '-v', `bun=${bun}`,
        '-v', `ji=${ji}`,
        awkScript,
        LOCAL_EXPOS_AREA_CSV_PATH
      ]);
      const out = [];
      let err = '';
      child.stdout.on('data', (chunk) => {
        const text = String(chunk || '');
        text.split('\n').forEach((line) => {
          const trimmed = line.trim();
          if (trimmed) out.push(trimmed);
        });
      });
      child.stderr.on('data', (chunk) => {
        err += String(chunk || '');
      });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(err || `awk exited with code ${code}`));
          return;
        }
        resolve(out);
      });
    }).catch((error) => ({ __error: error }));

    if (!Array.isArray(lines)) {
      const failed = {
        available: false,
        reason: `전유공용면적 CSV 조회 실패: ${lines?.__error?.message || 'unknown'}`,
        filePath: LOCAL_EXPOS_AREA_CSV_PATH,
        hoCandidates: []
      };
      LOCAL_EXPOS_AREA_CACHE.set(cacheKey, failed);
      return failed;
    }

    normalizedRows = lines
      .map((line) => parseCsvLine(line))
      .filter((cols) => cols.length >= 38)
      .map((cols) => ({
        dongName: formatDongName(cols[21]),
        hoName: formatHoName(cols[22]),
        mgmBldrgstPk: normalizeMgmPk(cols[6]),
        floorNumber: toInteger(cols[25]),
        floorType: String(cols[24] || '-'),
        epcmName: normalizeNameToken(cols[27] || ''),
        etcUse: normalizeNameToken(cols[36] || ''),
        manxName: normalizeNameToken(cols[29] || ''),
        area: toNumberLoose(cols[37])
      }));
  }

  const grouped = new Map();
  normalizedRows.forEach((rowData) => {
      const dongName = rowData.dongName;
      const hoName = rowData.hoName;
      const key = toUnitKey(dongName, hoName);
      if (!key) return;
      const area = toNumberLoose(rowData.area);
      if (!Number.isFinite(area) || area <= 0) return;

      if (!grouped.has(key)) {
        grouped.set(key, {
          dongName,
          hoName,
          mgmBldrgstPk: normalizeMgmPk(rowData.mgmBldrgstPk),
          areaSquareMeter: null,
          exclusiveAreaSquareMeter: null,
          supplyCommonAreaSquareMeter: null,
          supplyAreaSquareMeter: null,
          floorNumber: toInteger(rowData.floorNumber),
          floorType: String(rowData.floorType || '-'),
          pyeongLabel: '',
          source: exposSourceTag
        });
      }
      const row = grouped.get(key);
      if (!row.mgmBldrgstPk) row.mgmBldrgstPk = normalizeMgmPk(rowData.mgmBldrgstPk);
      const epcmName = normalizeNameToken(rowData.epcmName || '');
      const isExclusive = epcmName.includes('전유');
      const isCommon = epcmName.includes('공용');
      const includeCommonForSupply = isCommon && shouldIncludeCommonForSupply(
        rowData.manxName || '',
        rowData.etcUse || ''
      );

      if (isExclusive) {
        row.exclusiveAreaSquareMeter = Number.isFinite(Number(row.exclusiveAreaSquareMeter))
          ? Number(row.exclusiveAreaSquareMeter) + area
          : area;
      }
      if (includeCommonForSupply) {
        row.supplyCommonAreaSquareMeter = Number.isFinite(Number(row.supplyCommonAreaSquareMeter))
          ? Number(row.supplyCommonAreaSquareMeter) + area
          : area;
      }
  });

  const rows = [...grouped.values()]
    .map((item) => {
      const exclusive = toNumberLoose(item.exclusiveAreaSquareMeter);
      const supplyCommon = toNumberLoose(item.supplyCommonAreaSquareMeter);
      const supply = Number.isFinite(exclusive)
        ? (Number.isFinite(supplyCommon) ? exclusive + supplyCommon : null)
        : null;
      const area = Number.isFinite(exclusive) ? exclusive : supply;
      return {
        ...item,
        exclusiveAreaSquareMeter: Number.isFinite(exclusive) ? trunc2(exclusive) : null,
        supplyAreaSquareMeter: Number.isFinite(supply) ? trunc2(supply) : null,
        areaSquareMeter: Number.isFinite(area) ? trunc2(area) : null,
        pyeongLabel: Number.isFinite(area) ? toPyeongLabel(area) : '-'
      };
    })
    .filter((item) => item.hoName !== '-')
    .filter((item) => Number.isFinite(Number(item.exclusiveAreaSquareMeter)) || Number.isFinite(Number(item.supplyAreaSquareMeter)));

  const result = {
    available: rows.length > 0,
    reason: rows.length ? '' : '전유공용면적 원본(JSON/CSV)에서 필지 매칭 결과가 없습니다.',
    filePath: LOCAL_EXPOS_AREA_JSON_PATH || LOCAL_EXPOS_AREA_CSV_PATH,
    hoCandidates: rows
  };
  LOCAL_EXPOS_AREA_CACHE.set(cacheKey, result);
  return result;
}

function mergeSupplyUnits(primaryUnits = [], supplementUnits = [], options = {}) {
  const base = Array.isArray(primaryUnits) ? primaryUnits : [];
  const supp = Array.isArray(supplementUnits) ? supplementUnits : [];
  if (!supp.length) return base;
  const pkOnly = Boolean(options?.pkOnly);
  const appendUnmatched = options?.appendUnmatched !== false;

  const byMgmPk = new Map();
  const byDongHo = new Map();
  const matchedSuppKeys = new Set();
  supp.forEach((item) => {
    const mgmPkKey = toMgmPkKey(item?.mgmBldrgstPk);
    if (mgmPkKey) byMgmPk.set(mgmPkKey, item);
    const dongHoKey = toUnitKey(item?.dongName, item?.hoName);
    if (dongHoKey) byDongHo.set(dongHoKey, item);
  });

  const merged = base.map((item) => {
    const mgmPkKey = toMgmPkKey(item?.mgmBldrgstPk);
    const dongHoKey = toUnitKey(item?.dongName, item?.hoName);
    const source = pkOnly
      ? ((mgmPkKey && byMgmPk.get(mgmPkKey)) || null)
      : ((mgmPkKey && byMgmPk.get(mgmPkKey))
        || (dongHoKey && byDongHo.get(dongHoKey))
        || null);
    if (!source) return item;
    if (mgmPkKey && byMgmPk.has(mgmPkKey)) matchedSuppKeys.add(`pk:${mgmPkKey}`);
    if (dongHoKey && byDongHo.has(dongHoKey)) matchedSuppKeys.add(`dh:${dongHoKey}`);
    const exclusive = toNumberLoose(item?.exclusiveAreaSquareMeter ?? item?.areaSquareMeter);
    const supply = toNumberLoose(item?.supplyAreaSquareMeter ?? item?.supplyArea);
    const sourceExclusive = toNumberLoose(source?.exclusiveAreaSquareMeter);
    const sourceSupply = toNumberLoose(source?.supplyAreaSquareMeter);
    // If CSV has the value, prefer it over previously estimated/aggregated values.
    const mergedExclusive = Number.isFinite(sourceExclusive) ? sourceExclusive : exclusive;
    const mergedSupply = Number.isFinite(sourceSupply) ? sourceSupply : supply;
    const area = Number.isFinite(mergedExclusive) ? mergedExclusive : toNumberLoose(item?.areaSquareMeter);
    return {
      ...item,
      mgmBldrgstPk: normalizeMgmPk(item?.mgmBldrgstPk) || normalizeMgmPk(source?.mgmBldrgstPk),
      exclusiveAreaSquareMeter: Number.isFinite(mergedExclusive) ? trunc2(mergedExclusive) : null,
      supplyAreaSquareMeter: Number.isFinite(mergedSupply) ? trunc2(mergedSupply) : null,
      areaSquareMeter: Number.isFinite(area) ? trunc2(area) : null,
      source: (String(item?.source || '').includes('local-expos-csv') || String(item?.source || '').includes('local-expos-json'))
        ? item.source
        : `${item?.source || 'unknown'}+${source?.source || 'local-expos-csv'}`
    };
  });

  if (!appendUnmatched) return merged;

  // If supplement has rows not present in base, append them so parcel-wide mapping is preserved.
  const appended = supp
    .filter((item) => {
      const mgmPkKey = toMgmPkKey(item?.mgmBldrgstPk);
      if (mgmPkKey && matchedSuppKeys.has(`pk:${mgmPkKey}`)) return false;
      const dongHoKey = toUnitKey(item?.dongName, item?.hoName);
      if (dongHoKey && matchedSuppKeys.has(`dh:${dongHoKey}`)) return false;
      return true;
    })
    .map((item) => {
      const exclusive = toNumberLoose(item?.exclusiveAreaSquareMeter ?? item?.areaSquareMeter);
      const supply = toNumberLoose(item?.supplyAreaSquareMeter ?? item?.supplyArea);
      const area = Number.isFinite(exclusive) ? exclusive : toNumberLoose(item?.areaSquareMeter);
      return {
        ...item,
        mgmBldrgstPk: normalizeMgmPk(item?.mgmBldrgstPk),
        exclusiveAreaSquareMeter: Number.isFinite(exclusive) ? trunc2(exclusive) : null,
        supplyAreaSquareMeter: Number.isFinite(supply) ? trunc2(supply) : null,
        areaSquareMeter: Number.isFinite(area) ? trunc2(area) : null,
        source: String(item?.source || (LOCAL_EXPOS_AREA_JSON_PATH ? 'local-expos-json' : 'local-expos-csv'))
      };
    });

  return [...merged, ...appended];
}

async function fetchLocalCsvHousingUnitsByAwk(parcel) {
  if (!LOCAL_HOUSING_CSV_PATH || !parcel) {
    return {
      available: false,
      reason: '로컬 CSV 경로가 없거나 필지정보가 없습니다.',
      filePath: LOCAL_HOUSING_CSV_PATH || null,
      hoCandidates: []
    };
  }

  const legalCode = `${String(parcel.sigunguCd || '')}${String(parcel.bjdongCd || '')}`;
  const bun = String(Number.parseInt(String(parcel.bun || '0'), 10) || 0);
  const ji = String(Number.parseInt(String(parcel.ji || '0'), 10) || 0);
  const plat = String(parcel.platGbCd || '0');
  const cacheKey = `${legalCode}|${plat}|${bun}|${ji}`;
  if (LOCAL_CSV_CACHE.has(cacheKey)) {
    return LOCAL_CSV_CACHE.get(cacheKey);
  }
  if (legalCode.length !== 10) {
    return {
      available: false,
      reason: '법정동 코드가 유효하지 않습니다.',
      filePath: LOCAL_HOUSING_CSV_PATH,
      hoCandidates: []
    };
  }

  const awkScript = 'NR>1 {'
    + 'c3=$3; c9=$9; c10=$10; c11=$11; '
    + 'gsub(/"/,"",c3); gsub(/"/,"",c9); gsub(/"/,"",c10); gsub(/"/,"",c11); '
    + 'if (c3==legal && c9==plat && (c10+0)==(bun+0) && (c11+0)==(ji+0)) print'
    + '}';
  const lines = await new Promise((resolve, reject) => {
    const child = spawn('awk', [
      '-F,',
      '-v', `legal=${legalCode}`,
      '-v', `plat=${plat}`,
      '-v', `bun=${bun}`,
      '-v', `ji=${ji}`,
      awkScript,
      LOCAL_HOUSING_CSV_PATH
    ]);
    const out = [];
    let err = '';
    child.stdout.on('data', (chunk) => {
      const text = String(chunk || '');
      text.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed) out.push(trimmed);
      });
    });
    child.stderr.on('data', (chunk) => {
      err += String(chunk || '');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(err || `awk exited with code ${code}`));
        return;
      }
      resolve(out);
    });
  }).catch((error) => ({ __error: error }));

  if (!Array.isArray(lines)) {
    const failed = {
      available: false,
      reason: `로컬 CSV 조회 실패: ${lines?.__error?.message || 'unknown'}`,
      filePath: LOCAL_HOUSING_CSV_PATH,
      hoCandidates: []
    };
    LOCAL_CSV_CACHE.set(cacheKey, failed);
    return failed;
  }

  const mapped = lines
    .map((line) => parseCsvLine(line))
    .filter((cols) => cols.length >= 21)
    .map((cols) => {
      const area = toNumber(cols[15]);
      return {
        dongName: formatDongName(cols[13]),
        hoName: formatHoName(cols[14]),
        mgmBldrgstPk: normalizeMgmPk(cols[20]),
        floorNumber: null,
        floorType: '공동주택가격(로컬CSV)',
        areaSquareMeter: area,
        pyeongLabel: toPyeongLabel(area),
        officialPrice: toNumber(cols[16]),
        source: 'local-csv'
      };
    })
    .filter((item) => item.hoName !== '-');

  const rows = pickRepresentativeUnits(mapped)
    .filter((item) => isValidResidentialArea(item.areaSquareMeter));
  const result = {
    available: rows.length > 0,
    reason: rows.length ? '' : '로컬 CSV에서 필지 매칭 결과가 없습니다.',
    filePath: LOCAL_HOUSING_CSV_PATH,
    hoCandidates: rows
  };
  LOCAL_CSV_CACHE.set(cacheKey, result);
  return result;
}

async function fetchLocalCsvHousingUnits(parcel) {
  if (!LOCAL_HOUSING_CSV_PATH || !parcel) {
    return {
      available: false,
      reason: '로컬 CSV 경로가 없거나 필지정보가 없습니다.',
      filePath: LOCAL_HOUSING_CSV_PATH || null,
      hoCandidates: []
    };
  }

  const legalCode = `${String(parcel.sigunguCd || '')}${String(parcel.bjdongCd || '')}`;
  const bun = String(Number.parseInt(String(parcel.bun || '0'), 10) || 0);
  const ji = String(Number.parseInt(String(parcel.ji || '0'), 10) || 0);
  const plat = String(parcel.platGbCd || '0');
  const cacheKey = `${legalCode}|${plat}|${bun}|${ji}`;
  if (LOCAL_CSV_CACHE.has(cacheKey)) return LOCAL_CSV_CACHE.get(cacheKey);

  const ready = await ensureLocalCsvSqliteReady();
  if (!ready.ok) {
    return fetchLocalCsvHousingUnitsByAwk(parcel);
  }

  try {
    const colsRows = await queryLocalCsvSqliteRows(parcel);
    const mapped = colsRows
      .filter((cols) => cols.length >= 5)
      .map((cols) => {
        const area = toNumber(cols[2]);
        return {
          dongName: formatDongName(cols[0]),
          hoName: formatHoName(cols[1]),
          mgmBldrgstPk: normalizeMgmPk(cols[4]),
          floorNumber: null,
          floorType: '공동주택가격(로컬CSV)',
          areaSquareMeter: area,
          pyeongLabel: toPyeongLabel(area),
          officialPrice: toNumber(cols[3]),
          source: 'local-csv'
        };
      })
      .filter((item) => item.hoName !== '-');
    const rows = pickRepresentativeUnits(mapped)
      .filter((item) => isValidResidentialArea(item.areaSquareMeter));
    const result = {
      available: rows.length > 0,
      reason: rows.length ? '' : '로컬 CSV에서 필지 매칭 결과가 없습니다.',
      filePath: LOCAL_HOUSING_CSV_PATH,
      hoCandidates: rows
    };
    LOCAL_CSV_CACHE.set(cacheKey, result);
    return result;
  } catch (error) {
    return fetchLocalCsvHousingUnitsByAwk(parcel);
  }
}

function filterRtmsByBuildingName(records, buildingName) {
  if (!buildingName) return records;
  const target = normalizeNameToken(buildingName);
  if (!target) return records;
  const filtered = records.filter((row) => {
    const aptNm = normalizeNameToken(pickFirst(row, ['aptNm', 'offiNm'], ''));
    return aptNm && (aptNm.includes(target) || target.includes(aptNm));
  });
  return filtered.length ? filtered : records;
}

function mergeDongCandidates(primary = [], supplement = []) {
  const map = new Map();
  [...primary, ...supplement].forEach((item) => {
    const key = String(item?.dongName || '').trim();
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, { ...item });
      return;
    }
    const current = map.get(key);
    const merged = {
      ...item,
      ...current,
      dongName: key,
      floorCount: Number.isFinite(Number(current.floorCount)) ? current.floorCount : item.floorCount,
      maxFloor: Number.isFinite(Number(current.maxFloor)) ? current.maxFloor : item.maxFloor,
      minFloor: Number.isFinite(Number(current.minFloor)) ? current.minFloor : item.minFloor,
      source: current.source || item.source || 'reb'
    };
    map.set(key, merged);
  });
  return [...map.values()];
}

function toRebDongCandidates(dongItems = []) {
  return dongItems
    .map((item) => {
      const dongName = String(pickFirst(item, ['DONG_NM2', 'DONG_NM1', 'DONG_NM3'], '')).trim() || '동 미상';
      const groundFloor = toInteger(pickFirst(item, ['GRND_FLR_CNT']));
      return {
        dongName,
        floorCount: Number.isFinite(groundFloor) && groundFloor > 0 ? groundFloor : 0,
        maxFloor: Number.isFinite(groundFloor) && groundFloor > 0 ? groundFloor : null,
        minFloor: Number.isFinite(groundFloor) && groundFloor > 0 ? 1 : null,
        source: 'reb'
      };
    })
    .slice(0, 400);
}

function compactAddressLikeTerm(value) {
  return String(value || '')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function expandSidoName(term) {
  const t = compactAddressLikeTerm(term);
  if (!t) return t;
  const pairs = [
    ['서울 ', '서울특별시 '],
    ['부산 ', '부산광역시 '],
    ['대구 ', '대구광역시 '],
    ['인천 ', '인천광역시 '],
    ['광주 ', '광주광역시 '],
    ['대전 ', '대전광역시 '],
    ['울산 ', '울산광역시 '],
    ['세종 ', '세종특별자치시 '],
    ['경기 ', '경기도 '],
    ['강원 ', '강원특별자치도 '],
    ['충북 ', '충청북도 '],
    ['충남 ', '충청남도 '],
    ['전북 ', '전북특별자치도 '],
    ['전남 ', '전라남도 '],
    ['경북 ', '경상북도 '],
    ['경남 ', '경상남도 '],
    ['제주 ', '제주특별자치도 ']
  ];
  for (const [shortForm, fullForm] of pairs) {
    if (t.startsWith(shortForm)) {
      return `${fullForm}${t.slice(shortForm.length)}`.trim();
    }
  }
  return t;
}

function buildRebAddressSearchTerms(building = {}) {
  const source = [
    building.roadAddress,
    building.address,
    building.fullAddress
  ]
    .map((v) => compactAddressLikeTerm(v))
    .filter(Boolean);

  const terms = new Set();
  source.forEach((text) => {
    const parts = text.split(' ').filter(Boolean);
    terms.add(text);
    terms.add(expandSidoName(text));
    if (parts.length >= 4) terms.add(parts.slice(0, 4).join(' '));
    if (parts.length >= 3) terms.add(parts.slice(0, 3).join(' '));
    if (parts.length >= 2) terms.add(parts.slice(0, 2).join(' '));
    if (parts.length >= 4) terms.add(expandSidoName(parts.slice(0, 4).join(' ')));
    if (parts.length >= 3) terms.add(expandSidoName(parts.slice(0, 3).join(' ')));
    if (parts.length >= 2) terms.add(expandSidoName(parts.slice(0, 2).join(' ')));
  });
  return [...terms].filter((v) => v.length >= 4).slice(0, 6);
}

async function callRebAptIdInfoByAddress(addressLike) {
  const response = await axios.get(`${REB_APTID_BASE_URL}/getAptInfo`, {
    params: {
      serviceKey: REB_APTID_SERVICE_KEY,
      page: 1,
      perPage: 100,
      returnType: 'JSON',
      'cond[ADRES::LIKE]': addressLike
    },
    timeout: 12000
  });
  return Array.isArray(response.data?.data) ? response.data.data : [];
}

function scoreRebComplex(row, normalized) {
  const rowAddrRaw = String(pickFirst(row, ['ADRES'], ''));
  const targetAddrRaw = String(
    normalized?.building?.address || normalized?.building?.roadAddress || normalized?.building?.fullAddress || ''
  );
  const rowAddr = normalizeNameToken(rowAddrRaw);
  const targetAddr = normalizeNameToken(targetAddrRaw);
  const rowName = normalizeNameToken(
    pickFirst(row, ['COMPLEX_NM2', 'COMPLEX_NM1', 'COMPLEX_NM3'], '')
  );
  const targetName = normalizeNameToken(normalized?.building?.name || '');
  const rowAddrKey = compactAddressLikeTerm(rowAddrRaw).split(' ').slice(0, 3).join(' ');
  const targetAddrKey = compactAddressLikeTerm(targetAddrRaw).split(' ').slice(0, 3).join(' ');

  let score = 0;
  if (rowAddrKey && targetAddrKey) {
    if (rowAddrKey === targetAddrKey) score += 6;
    else score -= 6;
  }
  if (targetAddr && rowAddr) {
    if (targetAddr.includes(rowAddr)) score += 5;
    else if (rowAddr.includes(targetAddr)) score += 4;
  }
  if (targetName && rowName) {
    if (targetName.includes(rowName) || rowName.includes(targetName)) score += 4;
  }
  if (String(pickFirst(row, ['COMPLEX_GB_CD'], '')) === '1') score += 1;
  const unitCnt = Math.max(0, toInteger(pickFirst(row, ['UNIT_CNT'])) || 0);
  score += Math.min(0.5, unitCnt / 10000);
  return score;
}

async function callRebDongInfoByComplexPk(complexPk) {
  const response = await axios.get(`${REB_APTID_BASE_URL}/getDongInfo`, {
    params: {
      serviceKey: REB_APTID_SERVICE_KEY,
      page: 1,
      perPage: 500,
      returnType: 'JSON',
      'cond[COMPLEX_PK::EQ]': String(complexPk || '')
    },
    timeout: 12000
  });
  return Array.isArray(response.data?.data) ? response.data.data : [];
}

async function fetchRebAptIdDetails(normalized) {
  if (!REB_APTID_SERVICE_KEY) {
    return {
      available: false,
      reason: 'REB_APTID_SERVICE_KEY 누락',
      complex: null,
      dongInfo: []
    };
  }

  const terms = buildRebAddressSearchTerms(normalized?.building || {});
  if (!terms.length) {
    return {
      available: false,
      reason: 'REB 단지 검색용 주소 텍스트 부족',
      complex: null,
      dongInfo: []
    };
  }

  let rows = [];
  for (const term of terms) {
    try {
      const items = await callRebAptIdInfoByAddress(term);
      if (items.length) {
        rows = items;
        break;
      }
    } catch (_error) {
      // continue next address term
    }
  }

  if (!rows.length) {
    return {
      available: false,
      reason: 'REB 단지 식별정보 매칭 결과 없음',
      complex: null,
      dongInfo: []
    };
  }

  const sorted = rows
    .map((row) => ({
      row,
      score: scoreRebComplex(row, normalized)
    }))
    .sort((a, b) => b.score - a.score);
  if (!sorted.length || sorted[0].score <= 0) {
    return {
      available: false,
      reason: 'REB 단지식별 매칭 신뢰도가 낮아 보강 정보를 제외했습니다.',
      complex: null,
      dongInfo: []
    };
  }
  const best = sorted[0]?.row || null;
  const complexPk = pickFirst(best || {}, ['COMPLEX_PK'], '');
  if (!complexPk) {
    return {
      available: false,
      reason: 'REB 단지 식별정보에서 단지고유번호를 찾지 못했습니다.',
      complex: null,
      dongInfo: []
    };
  }

  const dongRaw = await callRebDongInfoByComplexPk(complexPk).catch(() => []);
  const dongInfo = toRebDongCandidates(dongRaw);

  return {
    available: true,
    reason: dongInfo.length ? '' : 'REB 동정보가 비어 있습니다.',
    complex: {
      complexPk: String(pickFirst(best, ['COMPLEX_PK'], '')),
      pnu: String(pickFirst(best, ['PNU'], '')),
      address: String(pickFirst(best, ['ADRES'], '')),
      complexName: String(pickFirst(best, ['COMPLEX_NM2', 'COMPLEX_NM1', 'COMPLEX_NM3'], '-')),
      dongCount: toInteger(pickFirst(best, ['DONG_CNT'])),
      unitCount: toInteger(pickFirst(best, ['UNIT_CNT'])),
      useApprovalDate: formatDateYYYYMMDD(pickFirst(best, ['USEAPR_DT'], ''))
    },
    dongInfo
  };
}

async function fetchHousingUnitPipeline(normalized, registry, rebAptId, vworldAptPrice, localCsvAptPrice) {
  const fromRebDong = Array.isArray(rebAptId?.dongInfo) ? rebAptId.dongInfo : [];
  const fromLocalCsv = Array.isArray(localCsvAptPrice?.hoCandidates) ? localCsvAptPrice.hoCandidates : [];
  const fromRegistryHo = pickRepresentativeUnits(
    (Array.isArray(registry?.hoInfo) ? registry.hoInfo : []).map((item) => ({ ...item, source: 'registry' }))
  );
  const fromExposCsvResult = await fetchLocalExposAreaUnits(normalized?.parcel || null).catch(() => ({
    available: false,
    reason: '전유공용면적 원본(JSON/CSV) 조회 실패',
    hoCandidates: []
  }));
  const exposLabel = String(fromExposCsvResult?.filePath || '').toLowerCase().endsWith('.json')
    ? '전유공용면적 JSON'
    : '전유공용면적 CSV';
  const fromExposCsv = Array.isArray(fromExposCsvResult?.hoCandidates) ? fromExposCsvResult.hoCandidates : [];
  const exposUnits = pickRepresentativeUnits(fromExposCsv);
  if (exposUnits.length) {
    return {
      source: String(exposUnits[0]?.source || 'local-expos-csv'),
      hoCandidates: exposUnits,
      dongCandidates: mergeDongCandidates(groupDongCandidates(exposUnits), fromRebDong),
      note: [
        `${exposLabel} 원천`
      ].filter(Boolean).join(' / ')
    };
  }

  const localRows = pickRepresentativeUnits(fromLocalCsv)
    .map((item) => {
      const ex = toNumberLoose(item?.exclusiveAreaSquareMeter ?? item?.areaSquareMeter);
      return {
        ...item,
        exclusiveAreaSquareMeter: Number.isFinite(ex) ? trunc2(ex) : null,
        supplyAreaSquareMeter: null,
        areaSquareMeter: Number.isFinite(ex) ? trunc2(ex) : toNumberLoose(item?.areaSquareMeter),
        source: 'local-csv'
      };
    })
    .filter((item) => item.hoName !== '-');
  if (localRows.length) {
    const mergedWithRegistry = mergeSupplyUnits(localRows, fromRegistryHo, {
      pkOnly: true,
      appendUnmatched: false
    });
    const hasSupply = mergedWithRegistry.some((item) => Number.isFinite(toNumberLoose(item?.supplyAreaSquareMeter)));
    return {
      source: hasSupply ? 'local-csv+registry' : 'local-csv',
      hoCandidates: mergedWithRegistry,
      dongCandidates: mergeDongCandidates(groupDongCandidates(mergedWithRegistry), fromRebDong),
      note: hasSupply
        ? '전유공용면적 JSON 없음: 주택공시가격 + 건축물대장(Br) PK연동 공급/전용 보강'
        : '전유공용면적 JSON 없음: 주택공시가격 전용면적만 표시'
    };
  }

  if (fromRegistryHo.length) {
    return {
      source: 'registry',
      hoCandidates: fromRegistryHo,
      dongCandidates: mergeDongCandidates(groupDongCandidates(fromRegistryHo), fromRebDong),
      note: '전유공용면적 JSON/주택공시가격 없음: 건축물대장(Br) 원본 사용'
    };
  }

  return {
    source: 'local-expos-json',
    hoCandidates: [],
    dongCandidates: mergeDongCandidates([], fromRebDong),
    note: fromExposCsvResult?.reason || `${exposLabel} 데이터 없음`
  };
}

function buildRegistryLinkageInfo(normalized, registry, housingPipeline) {
  const hasParcelKey = Boolean(
    normalized?.parcel?.sigunguCd
    && normalized?.parcel?.bjdongCd
    && normalized?.parcel?.platGbCd
    && normalized?.parcel?.bun
    && normalized?.parcel?.ji
  );
  const fromRegistry = Boolean(Array.isArray(registry?.hoInfo) && registry.hoInfo.length > 0);
  const fromFallback = Boolean(housingPipeline?.source === 'rtms-fallback');

  const sourceType = fromRegistry
    ? 'building-registry'
    : (fromFallback ? 'rtms-fallback' : 'none');

  return {
    usableForRegistryWorkflow: hasParcelKey,
    sourceType,
    confidence: fromRegistry ? 'high' : (fromFallback ? 'low' : 'none'),
    note: fromRegistry
      ? '동/호가 건축물대장 전유부/층별 개요 원본입니다. 등기 열람 결과와 대조용으로 사용 가능합니다.'
      : (fromFallback
        ? '동/호가 실거래 기반 후보 데이터입니다. 등기/건축물대장 원본과 불일치할 수 있습니다.'
        : (registry?.reason || '동/호 데이터 원본을 확인하지 못했습니다.')),
    parcelKey: hasParcelKey
      ? {
          sigunguCd: String(normalized.parcel.sigunguCd),
          bjdongCd: String(normalized.parcel.bjdongCd),
          platGbCd: String(normalized.parcel.platGbCd),
          bun: String(normalized.parcel.bun),
          ji: String(normalized.parcel.ji)
        }
      : null
  };
}

function normalizeOverpassPoint(item) {
  const lat = toNumber(item.lat) || toNumber(item.center?.lat);
  const lng = toNumber(item.lon) || toNumber(item.center?.lon);
  if (!lat || !lng) return null;
  return { lat, lng };
}

function nearestFromPoints(center, items, predicate) {
  const candidates = items
    .filter((item) => predicate(item))
    .map((item) => {
      const point = normalizeOverpassPoint(item);
      if (!point) return null;
      const distance = haversineMeters(center.lat, center.lng, point.lat, point.lng);
      return { item, point, distance };
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance);
  return candidates[0] || null;
}

function mapNearestResult(nearest, fallbackName = '-') {
  if (!nearest) {
    return {
      name: '-',
      distanceMeters: null,
      walkMinutes: null,
      driveMinutes: null,
      lat: null,
      lng: null
    };
  }
  const tags = nearest.item.tags || {};
  const travel = computeTravelMinutes(nearest.distance);
  return {
    name: String(tags.name || tags.brand || fallbackName),
    distanceMeters: nearest.distance,
    walkMinutes: travel.walkMinutes,
    driveMinutes: travel.driveMinutes,
    lat: nearest.point.lat,
    lng: nearest.point.lng
  };
}

function classifySchoolLevel(name) {
  const n = String(name || '');
  if (/초등|elementary/i.test(n)) return 'elementary';
  if (/중학|middle/i.test(n)) return 'middle';
  if (/고등|high/i.test(n)) return 'high';
  return 'unknown';
}

function chooseCloserItem(a, b) {
  const da = Number(a?.distanceMeters);
  const db = Number(b?.distanceMeters);
  const aValid = Number.isFinite(da);
  const bValid = Number.isFinite(db);
  if (aValid && bValid) return da <= db ? a : b;
  if (aValid) return a;
  if (bValid) return b;
  return null;
}

function limitByDistance(item, maxMeters = 1000) {
  const d = Number(item?.distanceMeters);
  if (!Number.isFinite(d) || d < 0) return null;
  if (d >= maxMeters) return null;
  return item;
}

async function searchNearestKakaoKeyword(center, options) {
  const {
    query,
    radius = 2500,
    size = 15,
    filterFn = null,
    fallbackName = '-'
  } = options || {};
  if (!KAKAO_REST_API_KEY) return null;
  const headers = { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` };
  const response = await axios.get(`${KAKAO_BASE_URL}/search/keyword.json`, {
    params: {
      query,
      x: center.lng,
      y: center.lat,
      radius,
      sort: 'distance',
      size
    },
    headers,
    timeout: 9000
  });
  const docs = (response.data?.documents || [])
    .filter((doc) => !isExcludedPlaceDoc(doc))
    .filter((doc) => {
      const distance = Number.parseInt(String(doc.distance || '0'), 10);
      return Number.isFinite(distance) && distance >= 0;
    })
    .filter((doc) => (typeof filterFn === 'function' ? filterFn(doc) : true))
    .sort((a, b) => Number(a.distance) - Number(b.distance));
  const doc = docs[0];
  if (!doc) return null;
  const distanceMeters = Number.parseInt(String(doc.distance || '0'), 10);
  const travel = computeTravelMinutes(distanceMeters);
  return {
    name: String(doc.place_name || fallbackName || query),
    distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : null,
    walkMinutes: travel.walkMinutes,
    driveMinutes: travel.driveMinutes,
    lat: toNumber(doc.y),
    lng: toNumber(doc.x)
  };
}

async function searchKakaoKeywordList(center, options) {
  const {
    query,
    radius = 20000,
    size = 15,
    limit = 3,
    fallbackQuery = ''
  } = options || {};
  if (!KAKAO_REST_API_KEY || !query) return [];
  const headers = { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` };
  const fetchDocs = async (q, useCenter = true) => {
    const params = {
      query: q,
      size: Math.max(size, limit)
    };
    if (useCenter) {
      params.x = center.lng;
      params.y = center.lat;
      params.radius = radius;
      params.sort = 'distance';
    }
    const response = await axios.get(`${KAKAO_BASE_URL}/search/keyword.json`, {
      params,
      headers,
      timeout: 9000
    });
    return (response.data?.documents || [])
      .filter((doc) => !isExcludedPlaceDoc(doc))
      .map((doc) => String(doc.place_name || '').trim())
      .filter(Boolean);
  };

  const near = await fetchDocs(query, true).catch(() => []);
  const merged = [...near];
  if (merged.length < limit) {
    const fallback = await fetchDocs(fallbackQuery || query, false).catch(() => []);
    merged.push(...fallback);
  }
  return [...new Set(merged)].slice(0, limit);
}

async function fetchDescriptionHints(center, regionText = '') {
  if (!KAKAO_REST_API_KEY || !center) {
    return {
      schoolsAround: [],
      mountainPark: [],
      departmentStore: [],
      largeMart: [],
      library: [],
      hospital: []
    };
  }
  const region = String(regionText || '').trim();
  const [
    schoolsAround,
    mountainPark,
    departmentStore,
    largeMart,
    library,
    hospital
  ] = await Promise.all([
    searchKakaoKeywordList(center, {
      query: '학교',
      limit: 3,
      fallbackQuery: `${region} 학교`
    }),
    searchKakaoKeywordList(center, {
      query: '공원',
      limit: 3,
      fallbackQuery: `${region} 산`
    }),
    searchKakaoKeywordList(center, {
      query: '백화점',
      limit: 3,
      fallbackQuery: `${region} 백화점`
    }),
    searchKakaoKeywordList(center, {
      query: '대형마트',
      limit: 3,
      fallbackQuery: `${region} 마트`
    }),
    searchKakaoKeywordList(center, {
      query: '도서관',
      limit: 3,
      fallbackQuery: `${region} 도서관`
    }),
    searchKakaoKeywordList(center, {
      query: '병원',
      limit: 3,
      fallbackQuery: `${region} 종합병원`
    })
  ]);

  return {
    schoolsAround,
    mountainPark,
    departmentStore,
    largeMart,
    library,
    hospital
  };
}

async function fetchTransitWithKakao(center) {
  if (!KAKAO_REST_API_KEY) return null;
  const settled = await Promise.allSettled([
    searchNearestKakaoKeyword(center, {
      query: '버스정류장',
      radius: 5000,
      size: 30,
      filterFn: (doc) => {
        const text = `${doc.place_name || ''} ${doc.category_name || ''} ${doc.category_group_name || ''}`;
        return /버스정류장|정류소|버스스탑|버스정류/.test(text);
      },
      fallbackName: '가까운 버스정류장'
    }),
    searchNearestKakaoKeyword(center, {
      query: '지하철역',
      radius: 6000,
      size: 30,
      filterFn: (doc) => {
        const text = `${doc.place_name || ''} ${doc.category_name || ''} ${doc.category_group_name || ''}`;
        if (String(doc.category_group_code || '') === 'SW8') return true;
        if (/버스정류장|버스터미널/.test(text)) return false;
        return /지하철역|전철역|역\b/.test(text);
      },
      fallbackName: '가까운 지하철역'
    }),
    searchNearestKakaoKeyword(center, {
      query: '주차장',
      radius: 2500,
      filterFn: (doc) => String(doc.category_group_code || '') === 'PK6'
        || /주차장/.test(`${doc.place_name || ''} ${doc.category_name || ''}`),
      fallbackName: '인근 주차장'
    }),
    searchNearestKakaoKeyword(center, {
      query: '초등학교',
      radius: 4000,
      filterFn: (doc) => /초등/.test(`${doc.place_name || ''} ${doc.category_name || ''}`),
      fallbackName: '가까운 초등학교'
    }),
    searchNearestKakaoKeyword(center, {
      query: '중학교',
      radius: 4000,
      filterFn: (doc) => /중학교|중학/.test(`${doc.place_name || ''} ${doc.category_name || ''}`),
      fallbackName: '가까운 중학교'
    }),
    searchNearestKakaoKeyword(center, {
      query: '고등학교',
      radius: 5000,
      filterFn: (doc) => /고등/.test(`${doc.place_name || ''} ${doc.category_name || ''}`),
      fallbackName: '가까운 고등학교'
    })
  ]);
  const read = (index) => (settled[index]?.status === 'fulfilled' ? settled[index].value : null);
  const bus = read(0);
  let subway = read(1);
  const parking = read(2);
  const elementary = read(3);
  const middle = read(4);
  const high = read(5);
  if (!subway || !Number.isFinite(Number(subway.distanceMeters))) {
    subway = await searchNearestKakaoKeyword(center, {
      query: '전철역',
      radius: 6000,
      size: 30,
      filterFn: (doc) => {
        const text = `${doc.place_name || ''} ${doc.category_name || ''} ${doc.category_group_name || ''}`;
        if (String(doc.category_group_code || '') === 'SW8') return true;
        if (/버스정류장|버스터미널/.test(text)) return false;
        return /지하철역|전철역|역\b/.test(text);
      },
      fallbackName: '가까운 지하철역'
    }).catch(() => null);
  }
  return {
    bus: bus || mapNearestResult(null, '가까운 버스정류장'),
    subway: subway || mapNearestResult(null, '가까운 지하철역'),
    parking: parking || mapNearestResult(null, '인근 주차장'),
    schools: {
      elementary: elementary || mapNearestResult(null, '가까운 초등학교'),
      middle: middle || mapNearestResult(null, '가까운 중학교'),
      high: high || mapNearestResult(null, '가까운 고등학교')
    }
  };
}

function inferRoadSurface(surfaceText) {
  const t = String(surfaceText || '').toLowerCase();
  if (!t) return '정보없음';
  if (/(asphalt|paved|concrete|paving_stones|sett)/.test(t)) return '포장';
  if (/(gravel|ground|dirt|earth|unpaved|mud|sand)/.test(t)) return '비포장';
  return '혼합/기타';
}

function inferRoadEase(surface, sidewalkTag) {
  const paved = surface === '포장';
  const sidewalk = String(sidewalkTag || '').toLowerCase();
  const hasSidewalk = ['yes', 'both', 'left', 'right', 'separate'].includes(sidewalk);
  if (paved && hasSidewalk) return '용이함';
  if (!paved) return '불편함';
  return '보통';
}

function computeRoadAccess(center, wayElements) {
  let nearest = null;
  wayElements.forEach((way) => {
    if (!Array.isArray(way.geometry) || way.geometry.length < 2) return;
    for (let i = 1; i < way.geometry.length; i += 1) {
      const prev = way.geometry[i - 1];
      const curr = way.geometry[i];
      const prevPoint = { lat: Number(prev.lat), lng: Number(prev.lon) };
      const currPoint = { lat: Number(curr.lat), lng: Number(curr.lon) };
      if (!Number.isFinite(prevPoint.lat) || !Number.isFinite(prevPoint.lng)) continue;
      if (!Number.isFinite(currPoint.lat) || !Number.isFinite(currPoint.lng)) continue;
      const segmentDistance = pointToSegmentDistanceMeters(center, prevPoint, currPoint, center.lat);
      if (!nearest || segmentDistance < nearest.distanceMeters) {
        nearest = { way, distanceMeters: segmentDistance };
      }
    }
  });

  if (!nearest) {
    return {
      surfaceType: '정보없음',
      ease: '정보없음',
      contactDistanceMeters: null
    };
  }

  const tags = nearest.way.tags || {};
  const surface = inferRoadSurface(tags.surface);
  return {
    surfaceType: surface,
    ease: inferRoadEase(surface, tags.sidewalk),
    contactDistanceMeters: nearest.distanceMeters
  };
}

function mapNearbyFromOverpass(center, elements) {
  const items = elements
    .map((item) => {
      const point = normalizeOverpassPoint(item);
      if (!point) return null;
      const tags = item.tags || {};
      const category = tags.amenity || tags.shop || tags.public_transport || tags.railway || '시설';
      const distance = haversineMeters(center.lat, center.lng, point.lat, point.lng);
      const travel = computeTravelMinutes(distance);
      return {
        id: String(item.id || `${tags.name || category}-${point.lat}-${point.lng}`),
        name: String(tags.name || tags.brand || category),
        category,
        distance,
        address: String(tags['addr:full'] || ''),
        roadAddress: '',
        phone: String(tags.phone || ''),
        placeUrl: '',
        lat: point.lat,
        lng: point.lng,
        walkMinutes: travel.walkMinutes,
        driveMinutes: travel.driveMinutes
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance);

  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.name}-${item.lat}-${item.lng}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 60);
}

function buildEmptyMobilityResult() {
  return {
    roadAccess: {
      surfaceType: '정보없음',
      ease: '정보없음',
      contactDistanceMeters: null
    },
    transit: {
      bus: mapNearestResult(null, '가까운 버스정류장'),
      subway: mapNearestResult(null, '가까운 지하철역'),
      parking: mapNearestResult(null, '인근 주차장'),
      schools: {
        elementary: mapNearestResult(null, '가까운 초등학교'),
        middle: mapNearestResult(null, '가까운 중학교'),
        high: mapNearestResult(null, '가까운 고등학교')
      }
    },
    nearbyItems: []
  };
}

async function fetchMobilityAndRoad(center) {
  const query = `
[out:json][timeout:20];
(
  node(around:1800,${center.lat},${center.lng})["highway"="bus_stop"];
  node(around:1800,${center.lat},${center.lng})["public_transport"="platform"]["bus"="yes"];
  node(around:2500,${center.lat},${center.lng})["railway"="station"]["station"="subway"];
  node(around:1200,${center.lat},${center.lng})["amenity"="parking"];
  way(around:1200,${center.lat},${center.lng})["amenity"="parking"];
  node(around:2000,${center.lat},${center.lng})["amenity"="school"];
  way(around:2000,${center.lat},${center.lng})["amenity"="school"];
  node(around:1200,${center.lat},${center.lng})["amenity"~"hospital|pharmacy|cafe|restaurant"];
  node(around:1200,${center.lat},${center.lng})["shop"="convenience"];
  way(around:1200,${center.lat},${center.lng})["amenity"~"hospital|pharmacy|cafe|restaurant"];
  way(around:1200,${center.lat},${center.lng})["shop"="convenience"];
  way(around:350,${center.lat},${center.lng})["highway"]["highway"~"motorway|trunk|primary|secondary|tertiary|residential|service|unclassified|living_street"];
);
out center geom 200;`;

  let elements = [];
  try {
    const response = await axios.post('https://overpass-api.de/api/interpreter', query, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: 15000
    });
    elements = response.data?.elements || [];
  } catch (_error) {
    // Keep going with Kakao transit even if Overpass is temporarily unavailable.
    elements = [];
  }

  const roadWays = elements.filter((item) => item.type === 'way' && item.tags?.highway);
  const roadAccess = computeRoadAccess(center, roadWays);

  const busNearest = nearestFromPoints(
    center,
    elements,
    (item) => item.tags?.highway === 'bus_stop'
      || item.tags?.public_transport === 'stop_position'
      || (item.tags?.public_transport === 'platform' && item.tags?.bus === 'yes')
  );
  const subwayNearest = nearestFromPoints(
    center,
    elements,
    (item) => item.tags?.railway === 'station'
      && (item.tags?.station === 'subway' || item.tags?.subway === 'yes')
  );
  const parkingNearest = nearestFromPoints(
    center,
    elements,
    (item) => item.tags?.amenity === 'parking'
  );

  const schoolNearestByLevel = { elementary: null, middle: null, high: null };
  elements.forEach((item) => {
    if (item.tags?.amenity !== 'school') return;
    const point = normalizeOverpassPoint(item);
    if (!point) return;
    const distance = haversineMeters(center.lat, center.lng, point.lat, point.lng);
    const level = classifySchoolLevel(item.tags?.name);
    if (level === 'unknown') return;
    if (!schoolNearestByLevel[level] || distance < schoolNearestByLevel[level].distance) {
      schoolNearestByLevel[level] = { item, point, distance };
    }
  });

  const osmTransit = {
    bus: mapNearestResult(busNearest, '가까운 버스정류장'),
    subway: mapNearestResult(subwayNearest, '가까운 지하철역'),
    parking: mapNearestResult(parkingNearest, '인근 주차장'),
    schools: {
      elementary: mapNearestResult(schoolNearestByLevel.elementary, '가까운 초등학교'),
      middle: mapNearestResult(schoolNearestByLevel.middle, '가까운 중학교'),
      high: mapNearestResult(schoolNearestByLevel.high, '가까운 고등학교')
    }
  };

  const kakaoTransit = await fetchTransitWithKakao(center).catch(() => null);
  const mergedTransit = {
    // Bus stop density can be sparse in suburban areas; keep nearest result even beyond 2km.
    bus: limitByDistance(chooseCloserItem(kakaoTransit?.bus, osmTransit.bus), 5000)
      || chooseCloserItem(kakaoTransit?.bus, osmTransit.bus)
      || mapNearestResult(null, '가까운 버스정류장'),
    // Prefer Kakao result for subway stations to reduce OSM station-tag mismatches.
    subway: limitByDistance(kakaoTransit?.subway, 6000)
      || kakaoTransit?.subway
      || limitByDistance(osmTransit.subway, 6000)
      || osmTransit.subway
      || mapNearestResult(null, '가까운 지하철역'),
    parking: limitByDistance(chooseCloserItem(kakaoTransit?.parking, osmTransit.parking), 2000) || mapNearestResult(null, '인근 주차장'),
    schools: {
      elementary: limitByDistance(chooseCloserItem(kakaoTransit?.schools?.elementary, osmTransit.schools.elementary), 2000) || mapNearestResult(null, '가까운 초등학교'),
      middle: limitByDistance(chooseCloserItem(kakaoTransit?.schools?.middle, osmTransit.schools.middle), 2000) || mapNearestResult(null, '가까운 중학교'),
      high: limitByDistance(chooseCloserItem(kakaoTransit?.schools?.high, osmTransit.schools.high), 2000) || mapNearestResult(null, '가까운 고등학교')
    }
  };

  return {
    roadAccess,
    transit: mergedTransit,
    nearbyItems: mapNearbyFromOverpass(center, elements)
      .filter((item) => Number.isFinite(Number(item.distance)) && Number(item.distance) < 1000)
  };
}

function mapOsmNearbyItem(item, centerLat, centerLng) {
  const lat = toNumber(item.lat) || toNumber(item.center?.lat);
  const lng = toNumber(item.lon) || toNumber(item.center?.lon);
  if (!lat || !lng) return null;
  const tag = item.tags || {};
  const name = tag.name || tag.brand || '주변 시설';
  const amenity = tag.amenity || tag.shop || tag.public_transport || '시설';
  const roughMeters = Math.round(
    Math.sqrt(((lat - centerLat) * 111000) ** 2 + ((lng - centerLng) * 88000) ** 2)
  );
  const travel = computeTravelMinutes(roughMeters);
  return {
    id: String(item.id || `${name}-${lat}-${lng}`),
    name: String(name),
    category: String(amenity),
    distance: roughMeters,
    address: String(tag['addr:full'] || ''),
    roadAddress: '',
    phone: String(tag.phone || ''),
    placeUrl: '',
    lat,
    lng,
    walkMinutes: travel.walkMinutes,
    driveMinutes: travel.driveMinutes
  };
}

async function searchWithOsm(query) {
  const nominatim = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: {
      q: query,
      format: 'jsonv2',
      addressdetails: 1,
      limit: 1
    },
    headers: { 'User-Agent': 'building-info-app/1.0' },
    timeout: 9000
  });

  const first = nominatim.data?.[0];
  if (!first) throw new Error('주소 검색 결과가 없습니다.');

  const lat = toNumber(first.lat);
  const lng = toNumber(first.lon);
  if (!lat || !lng) throw new Error('좌표를 찾을 수 없습니다.');

  const overpassQuery = `
[out:json][timeout:12];
(
  node(around:1200,${lat},${lng})["amenity"~"school|hospital|pharmacy|cafe|restaurant|bank|police|post_office|bus_station"];
  way(around:1200,${lat},${lng})["amenity"~"school|hospital|pharmacy|cafe|restaurant|bank|police|post_office|bus_station"];
  node(around:1200,${lat},${lng})["shop"="convenience"];
  way(around:1200,${lat},${lng})["shop"="convenience"];
);
out center 40;`;

  const overpass = await axios.post('https://overpass-api.de/api/interpreter', overpassQuery, {
    headers: { 'Content-Type': 'text/plain' },
    timeout: 12000
  });

  const nearbyItems = (overpass.data?.elements || [])
    .map((item) => mapOsmNearbyItem(item, lat, lng))
    .filter(Boolean)
    .sort((a, b) => (a.distance || 999999) - (b.distance || 999999))
    .slice(0, 40);

  const displayName = String(first.display_name || '');
  const region = displayName.split(',').slice(-3).reverse().join(' ').trim() || '-';

  return {
    provider: 'OpenStreetMap',
    building: {
      name: first.name || '검색 건물',
      fullAddress: displayName,
      roadAddress: displayName,
      address: displayName,
      category: String(first.type || '건물'),
      use: String(first.class || '미지정'),
      region,
      lat,
      lng,
      placeUrl: first.osm_id
        ? `https://www.openstreetmap.org/${first.osm_type}/${first.osm_id}`
        : '',
      phone: ''
    },
    nearbyItems
  };
}

async function resolveAddressWithKakao(query) {
  const headers = { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` };
  const addrRes = await axios.get(`${KAKAO_BASE_URL}/search/address.json`, {
    params: { query, size: 1 },
    headers,
    timeout: 9000
  });
  let addressDoc = addrRes.data?.documents?.[0] || null;
  let keywordDoc = null;

  if (!addressDoc) {
    const kwRes = await axios.get(`${KAKAO_BASE_URL}/search/keyword.json`, {
      params: { query, size: 7, sort: 'accuracy' },
      headers,
      timeout: 9000
    });
    keywordDoc = pickPreferredKeywordDoc(kwRes.data?.documents || []);
    if (!keywordDoc) {
      throw new Error('주소 또는 건물명 검색 결과가 없습니다.');
    }
    const addressLike = keywordDoc.road_address_name || keywordDoc.address_name;
    if (addressLike) {
      const normalized = await axios.get(`${KAKAO_BASE_URL}/search/address.json`, {
        params: { query: addressLike, size: 1 },
        headers,
        timeout: 9000
      });
      addressDoc = normalized.data?.documents?.[0] || null;
    }
  } else {
    const lat = toNumber(addressDoc.y);
    const lng = toNumber(addressDoc.x);
    if (lat && lng) {
      const kwRes = await axios.get(`${KAKAO_BASE_URL}/search/keyword.json`, {
        params: {
          query,
          x: lng,
          y: lat,
          radius: 600,
          sort: 'distance',
          size: 7
        },
        headers,
        timeout: 9000
      });
      keywordDoc = pickPreferredKeywordDoc(kwRes.data?.documents || []);
    }
  }

  if (!addressDoc) throw new Error('주소 정규화에 실패했습니다.');

  const lat = toNumber(addressDoc.y) || toNumber(keywordDoc?.y);
  const lng = toNumber(addressDoc.x) || toNumber(keywordDoc?.x);
  if (!lat || !lng) throw new Error('좌표를 찾을 수 없습니다.');

  const parcel = toBuildingParcelFromKakaoAddress(addressDoc);
  return {
    provider: 'Kakao Local API',
    building: {
      name: keywordDoc?.place_name || addressDoc.address?.building_name || '검색 건물',
      fullAddress: String(addressDoc.address_name || ''),
      roadAddress: String(addressDoc.road_address?.address_name || keywordDoc?.road_address_name || ''),
      address: String(addressDoc.address?.address_name || keywordDoc?.address_name || addressDoc.address_name || ''),
      category: String(keywordDoc?.category_group_name || keywordDoc?.category_name || '건물'),
      use: String(keywordDoc?.category_name || '미지정'),
      region: inferRegion(addressDoc.road_address?.address_name, addressDoc.address_name),
      lat,
      lng,
      placeUrl: String(keywordDoc?.place_url || ''),
      phone: String(keywordDoc?.phone || '')
    },
    parcel
  };
}

function parcelToKey(parcel) {
  if (!parcel) return '';
  return [
    String(parcel.sigunguCd || ''),
    String(parcel.bjdongCd || ''),
    String(parcel.platGbCd || ''),
    String(parcel.bun || ''),
    String(parcel.ji || '')
  ].join('|');
}

async function resolveBestAddressWithKakao(query, depth = 0) {
  const primary = await resolveAddressWithKakao(query);
  if (!KAKAO_REST_API_KEY) return primary;

  const headers = { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` };
  let kwDocs = [];
  const queryVariants = [query];
  if (!/(서울|경기|부천|역곡|인천|부산|대구|광주|대전|울산|세종|제주)/u.test(query)) {
    queryVariants.push(`부천 ${query}`);
    queryVariants.push(`부천 역곡동 ${query}`);
    queryVariants.push(`경기 부천시 원미구 역곡동 ${query}`);
  }
  for (const qv of queryVariants) {
    try {
      const kwRes = await axios.get(`${KAKAO_BASE_URL}/search/keyword.json`, {
        params: { query: qv, size: 12, sort: 'accuracy' },
        headers,
        timeout: 9000
      });
      kwDocs.push(...(kwRes.data?.documents || []));
    } catch (_error) {
      // skip variant
    }
  }
  kwDocs = kwDocs.filter((doc) => !isExcludedPlaceDoc(doc));
  if (!kwDocs.length) {
    return primary;
  }

  const candidates = [primary];
  for (const doc of kwDocs.slice(0, 8)) {
    try {
      const addressLike = String(doc.road_address_name || doc.address_name || '').trim();
      if (!addressLike) continue;
      const addrRes = await axios.get(`${KAKAO_BASE_URL}/search/address.json`, {
        params: { query: addressLike, size: 1 },
        headers,
        timeout: 9000
      });
      const addressDoc = addrRes.data?.documents?.[0] || null;
      if (!addressDoc) continue;
      const lat = toNumber(addressDoc.y) || toNumber(doc.y);
      const lng = toNumber(addressDoc.x) || toNumber(doc.x);
      if (!lat || !lng) continue;
      const parcel = toBuildingParcelFromKakaoAddress(addressDoc);
      if (!parcel) continue;
      candidates.push({
        provider: 'Kakao Local API',
        building: {
          name: doc.place_name || addressDoc.address?.building_name || '검색 건물',
          fullAddress: String(addressDoc.address_name || ''),
          roadAddress: String(addressDoc.road_address?.address_name || doc.road_address_name || ''),
          address: String(addressDoc.address?.address_name || doc.address_name || addressDoc.address_name || ''),
          category: String(doc.category_group_name || doc.category_name || '건물'),
          use: String(doc.category_name || '미지정'),
          region: inferRegion(addressDoc.road_address?.address_name, addressDoc.address_name),
          lat,
          lng,
          placeUrl: String(doc.place_url || ''),
          phone: String(doc.phone || '')
        },
        parcel
      });
    } catch (_error) {
      // skip invalid candidate
    }
  }

  const deduped = [];
  const seen = new Set();
  candidates.forEach((item) => {
    const key = parcelToKey(item?.parcel);
    if (!key || seen.has(key)) return;
    seen.add(key);
    deduped.push(item);
  });
  if (deduped.length <= 1) return primary;

  const scored = await Promise.all(deduped.map(async (item) => {
    try {
      const expos = await fetchLocalExposAreaUnits(item.parcel);
      const exposCount = Array.isArray(expos?.hoCandidates) ? expos.hoCandidates.length : 0;
      const nameToken = normalizeNameToken(item?.building?.name || '');
      const queryToken = normalizeNameToken(query || '');
      const nameBoost = (nameToken && queryToken && (nameToken.includes(queryToken) || queryToken.includes(nameToken))) ? 5 : 0;
      const exposBoost = exposCount > 0 ? 1000000 : 0;
      return {
        item,
        score: exposBoost + (exposCount * 1000) + nameBoost
      };
    } catch (_error) {
      return { item, score: 0 };
    }
  }));

  scored.sort((a, b) => b.score - a.score);
  const selected = scored[0]?.score > 0 ? scored[0].item : primary;
  const hasRegionToken = /(서울|경기|부천|역곡|인천|부산|대구|광주|대전|울산|세종|제주)/u.test(query);
  if (!hasRegionToken && depth < 1) {
    try {
      const expos = await fetchLocalExposAreaUnits(selected?.parcel || null);
      const exposCount = Array.isArray(expos?.hoCandidates) ? expos.hoCandidates.length : 0;
      if (exposCount <= 0) {
        const alt = await resolveBestAddressWithKakao(`부천 ${query}`, depth + 1);
        const altExpos = await fetchLocalExposAreaUnits(alt?.parcel || null);
        const altCount = Array.isArray(altExpos?.hoCandidates) ? altExpos.hoCandidates.length : 0;
        if (altCount > exposCount) return alt;
      }
    } catch (_error) {
      // keep selected on fallback errors
    }
  }
  return selected;
}

function mapKakaoSuggestion(doc, query) {
  const roadAddress = String(doc.road_address_name || '');
  const address = String(doc.address_name || '');
  const placeName = String(doc.place_name || '');
  const lat = toNumber(doc.y);
  const lng = toNumber(doc.x);
  const main = roadAddress || address || placeName || query;
  return {
    query: main,
    main,
    placeName,
    roadAddress,
    address,
    category: String(doc.category_name || doc.category_group_name || ''),
    lat,
    lng
  };
}

async function getKakaoSuggestions(query) {
  const headers = { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` };
  const [keywordRes, addressRes] = await Promise.all([
    axios.get(`${KAKAO_BASE_URL}/search/keyword.json`, {
      params: { query, size: 7, sort: 'accuracy' },
      headers,
      timeout: 9000
    }),
    axios.get(`${KAKAO_BASE_URL}/search/address.json`, {
      params: { query, size: 5 },
      headers,
      timeout: 9000
    })
  ]);

  const merged = [];
  const seen = new Set();
  (keywordRes.data?.documents || []).forEach((doc) => {
    if (isExcludedPlaceDoc(doc)) return;
    const item = mapKakaoSuggestion(doc, query);
    const key = `${item.main}|${item.placeName}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  });
  (addressRes.data?.documents || []).forEach((doc) => {
    const main = String(doc.road_address?.address_name || doc.address_name || query);
    const address = String(doc.address_name || '');
    const roadAddress = String(doc.road_address?.address_name || '');
    const item = {
      query: main,
      main,
      placeName: '',
      roadAddress,
      address,
      category: '주소',
      lat: toNumber(doc.y),
      lng: toNumber(doc.x)
    };
    const key = `${item.main}|${item.address}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  });
  return merged.slice(0, 8);
}

app.get('/api/location/suggest', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) {
    return res.json({ ok: true, items: [] });
  }

  try {
    if (KAKAO_REST_API_KEY) {
      const items = await getKakaoSuggestions(q);
      return res.json({ ok: true, provider: 'Kakao Local API', items });
    }
    return res.json({ ok: true, provider: 'none', items: [] });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.response?.data?.message || error.message || '자동완성 조회 중 오류가 발생했습니다.'
    });
  }
});

app.get('/api/vworld/apart-price/hos', async (req, res) => {
  const pnu = String(req.query.pnu || '').trim();
  const dongNmRaw = String(req.query.dongNm || '').trim();
  const dongNm = normalizeDongToken(dongNmRaw);
  const stdrYear = toInteger(req.query.stdrYear) || new Date().getFullYear();

  if (!pnu || pnu.length < 10) {
    return res.status(400).json({ ok: false, error: 'pnu 파라미터가 필요합니다.' });
  }
  if (!dongNm) {
    return res.status(400).json({ ok: false, error: 'dongNm 파라미터가 필요합니다.' });
  }
  if (!VWORLD_APT_PRICE_KEY) {
    return res.status(500).json({ ok: false, error: 'VWORLD_APT_PRICE_KEY 누락' });
  }

  const result = await fetchVworldApartAttrAllPages(pnu, stdrYear, { dongNm }).catch((error) => ({
    ok: false,
    reason: error.response?.data?.apartHousingPrices?.resultMsg || error.message || 'VWorld 조회 실패',
    rows: []
  }));
  if (!result.ok) {
    return res.status(502).json({ ok: false, error: result.reason || 'VWorld 조회 실패' });
  }

  const rows = filterVerifiedVworldUnits(mapHoCandidatesFromVworld(result.rows))
    .filter((item) => normalizeDongToken(item.dongName) === dongNm)
    .sort((a, b) => {
      const fa = Number(a.floorNumber);
      const fb = Number(b.floorNumber);
      if (Number.isFinite(fa) && Number.isFinite(fb) && fa !== fb) return fa - fb;
      return String(a.hoName || '').localeCompare(String(b.hoName || ''), 'ko');
    });

  return res.json({
    ok: true,
    pnu,
    stdrYear,
    dongNm: dongNmRaw,
    count: rows.length,
    rows
  });
});

async function diagnoseLocation(query) {
  const out = {
    ok: true,
    query,
    env: {
      hasKakaoRestKey: Boolean(KAKAO_REST_API_KEY),
      hasKakaoMapJsKey: Boolean(KAKAO_MAP_JS_KEY),
      hasBuildingRegistryKey: Boolean(BUILDING_REGISTRY_SERVICE_KEY)
    },
    steps: {}
  };

  try {
    if (!KAKAO_REST_API_KEY) {
      out.steps.kakaoAddress = { ok: false, error: 'KAKAO_REST_API_KEY 누락' };
      out.ok = false;
      return out;
    }
    const normalized = await resolveBestAddressWithKakao(query);
    out.steps.kakaoAddress = {
      ok: true,
      provider: normalized.provider,
      building: normalized.building,
      parcel: normalized.parcel
    };

    try {
      const registry = await fetchBuildingRegistryDetails(normalized.parcel);
      out.steps.registry = {
        ok: registry.available,
        reason: registry.reason || '',
        summary: registry.summary || null,
        dongCount: registry.dongInfo?.length || 0,
        hoCount: registry.hoInfo?.length || 0
      };
      if (!registry.available) out.ok = false;
    } catch (e) {
      out.ok = false;
      out.steps.registry = {
        ok: false,
        error: e.response?.data?.response?.header?.resultMsg || e.message
      };
    }

    try {
      const mobility = await fetchMobilityAndRoad({
        lat: normalized.building.lat,
        lng: normalized.building.lng
      });
      out.steps.mobility = {
        ok: true,
        roadAccess: mobility.roadAccess,
        nearbyCount: mobility.nearbyItems?.length || 0,
        transit: mobility.transit
      };
    } catch (e) {
      out.ok = false;
      out.steps.mobility = {
        ok: false,
        error: e.response?.data?.message || e.message
      };
    }
  } catch (e) {
    out.ok = false;
    out.steps.kakaoAddress = {
      ok: false,
      error: e.response?.data?.msg || e.response?.data?.message || e.message
    };
  }

  return out;
}

app.get('/api/location/diagnose', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ ok: false, error: 'q(query) 파라미터가 필요합니다.' });
  }

  const result = await diagnoseLocation(q);
  return res.status(result.ok ? 200 : 500).json(result);
});

app.get('/api/apartment/py-types', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ ok: false, error: 'q(query) 파라미터가 필요합니다.' });
  }

  try {
    if (!KAKAO_REST_API_KEY) {
      return res.status(500).json({ ok: false, error: 'KAKAO_REST_API_KEY 누락' });
    }
    const normalized = await resolveBestAddressWithKakao(q);
    const [registry, vworld, localCsv] = await Promise.all([
      fetchBuildingRegistryDetails(normalized.parcel),
      fetchVworldApartPriceUnits(normalized.parcel),
      fetchLocalCsvHousingUnits(normalized.parcel)
    ]);

    const realSource = pickRealPyeongSourceRows(localCsv, vworld, registry);
    const sourceRows = realSource.rows;
    const sourceType = realSource.source;
    const pyeongTypes = buildPyeongTypeList(sourceRows, {
      areaBandStep: 0.01,
      minUnits: 1,
      includePriceStats: sourceType === 'vworld' || sourceType === 'local-csv',
      enforceResidentialArea: true
    });

    return res.json({
      ok: true,
      query: q,
      source: sourceType,
      building: normalized.building,
      pnu: toPnuFromParcel(normalized.parcel),
      count: pyeongTypes.length,
      pyeongTypes
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.response?.data?.message || error.message || '평형 타입 조회 실패'
    });
  }
});

app.get('/api/location/real-pyeong', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ ok: false, error: 'q(query) 파라미터가 필요합니다.' });
  }

  try {
    if (!KAKAO_REST_API_KEY) {
      return res.status(500).json({ ok: false, error: 'KAKAO_REST_API_KEY 누락' });
    }
    const normalized = await resolveBestAddressWithKakao(q);
    const [registry, vworld, localCsv] = await Promise.all([
      fetchBuildingRegistryDetails(normalized.parcel),
      fetchVworldApartPriceUnits(normalized.parcel),
      fetchLocalCsvHousingUnits(normalized.parcel)
    ]);
    const realSource = pickRealPyeongSourceRows(localCsv, vworld, registry);
    const pyeongTypes = buildPyeongTypeList(realSource.rows, {
      areaBandStep: 0.01,
      minUnits: 1,
      includePriceStats: realSource.source === 'vworld' || realSource.source === 'local-csv',
      enforceResidentialArea: true
    });

    return res.json({
      ok: true,
      query: q,
      building: normalized.building,
      pnu: toPnuFromParcel(normalized.parcel),
      source: realSource.source,
      count: pyeongTypes.length,
      pyeongTypes
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.response?.data?.message || error.message || '실제 평형 조회 실패'
    });
  }
});

app.post('/api/location/map-listings', async (req, res) => {
  const q = String(req.body?.q || '').trim();
  const listings = Array.isArray(req.body?.listings) ? req.body.listings : [];
  const publicHoCandidatesRaw = Array.isArray(req.body?.hoCandidates) ? req.body.hoCandidates : [];
  const publicPyeongTypesRaw = Array.isArray(req.body?.pyeongTypes) ? req.body.pyeongTypes : [];
  if (!listings.length) {
    return res.status(400).json({ ok: false, error: 'listings 배열이 비어 있습니다.' });
  }
  if (publicHoCandidatesRaw.length || publicPyeongTypesRaw.length) {
    const hoCandidates = pickRepresentativeUnits(normalizePublicHoCandidates(publicHoCandidatesRaw));
    const pyeongTypes = normalizePublicPyeongTypes(publicPyeongTypesRaw);
    const finalPyeongTypes = pyeongTypes.length
      ? pyeongTypes
      : buildPyeongTypeList(hoCandidates, {
          areaBandStep: 0.01,
          minUnits: 1,
          includePriceStats: false,
          enforceResidentialArea: true
        });
    const mapped = mapListingsWithRealUnits(listings, hoCandidates, finalPyeongTypes);
    return res.json({
      ok: true,
      query: q || null,
      source: {
        pyeong: 'public-payload',
        units: 'public-payload'
      },
      count: mapped.length,
      mapped
    });
  }

  if (!q) {
    return res.status(400).json({ ok: false, error: 'q(query) 값 또는 hoCandidates/pyeongTypes가 필요합니다.' });
  }
  if (!KAKAO_REST_API_KEY) {
    return res.status(500).json({ ok: false, error: 'KAKAO_REST_API_KEY 누락' });
  }

  try {
    const normalized = await resolveBestAddressWithKakao(q);
    const [registry, vworld, localCsv] = await Promise.all([
      fetchBuildingRegistryDetails(normalized.parcel),
      fetchVworldApartPriceUnits(normalized.parcel),
      fetchLocalCsvHousingUnits(normalized.parcel)
    ]);
    const housingPipeline = await fetchHousingUnitPipeline(normalized, registry, null, vworld, localCsv);
    const realSource = pickRealPyeongSourceRows(localCsv, vworld, registry);
    const pyeongTypes = buildPyeongTypeList(realSource.rows, {
      areaBandStep: 0.01,
      minUnits: 1,
      includePriceStats: realSource.source === 'vworld' || realSource.source === 'local-csv',
      enforceResidentialArea: true
    });
    const hoCandidates = pickRepresentativeUnits(Array.isArray(housingPipeline?.hoCandidates) ? housingPipeline.hoCandidates : []);
    const mapped = mapListingsWithRealUnits(listings, hoCandidates, pyeongTypes);
    return res.json({
      ok: true,
      query: q,
      building: normalized.building,
      source: {
        pyeong: realSource.source,
        units: housingPipeline?.source || 'none'
      },
      count: mapped.length,
      mapped
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.response?.data?.message || error.message || '매물 매핑 중 오류가 발생했습니다.'
    });
  }
});

app.get('/api/location/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const detailed = String(req.query.detail || '0').trim() === '1';
  const requestStart = Date.now();
  if (!q) {
    return res.status(400).json({
      ok: false,
      error: 'q(query) 파라미터가 필요합니다.'
    });
  }

  const cacheKey = `${detailed ? 'detail1' : 'detail0'}:${q}`;
  const cached = getSearchCache(cacheKey);
  if (cached) {
    return res.json({
      ok: true,
      ...cached,
      cached: true
    });
  }

  try {
    let providerResult;
    let mobility = null;
    let registry = null;
    let vworldAptPrice = null;
    let localCsvAptPrice = null;
    let housingPipeline = null;
    let registryLinkage = null;
    let descriptionHints = null;

    if (KAKAO_REST_API_KEY) {
      const normalized = await resolveBestAddressWithKakao(q);
      providerResult = {
        provider: normalized.provider,
        building: normalized.building
      };

      if (!detailed) {
        const centerFast = {
          lat: normalized.building.lat,
          lng: normalized.building.lng
        };
        const elapsedAfterResolve = Date.now() - requestStart;
        const remain = Math.max(300, SEARCH_FAST_BUDGET_MS - elapsedAfterResolve);
        const registryFastFallback = {
          available: false,
          reason: '빠른조회 시간제한으로 생략됨',
          summary: null,
          dongInfo: [],
          hoInfo: []
        };
        const mobilityFastFallback = buildEmptyMobilityResult();
        const [registryFast, mobilityFast] = await Promise.all([
          resolveWithin(
            fetchBuildingRegistryDetails(normalized.parcel),
            Math.floor(remain * 0.55),
            registryFastFallback
          ),
          resolveWithin(
            fetchMobilityAndRoad(centerFast),
            Math.floor(remain * 0.55),
            mobilityFastFallback
          )
        ]);
        const summaryFast = registryFast?.summary || {};
        providerResult.building.use = summaryFast.mainPurpose && summaryFast.mainPurpose !== '-'
          ? summaryFast.mainPurpose
          : providerResult.building.use;
        const housingResult = {
          source: 'fast-minimal',
          hoCandidates: [],
          dongCandidates: [],
          note: '2초 빠른조회 모드에서는 동/호/평형 보강을 생략합니다. 상세조회는 detail=1'
        };
        const fastPayload = {
          ok: true,
          provider: providerResult.provider,
          building: providerResult.building,
          registry: registryFast,
          rebAptId: {
            available: false,
            reason: '빠른조회 모드에서 생략',
            complex: null,
            dongInfo: []
          },
          vworldAptPrice: {
            available: false,
            reason: '빠른조회 모드에서 생략',
            year: null,
            pnu: null,
            hoCandidates: []
          },
          localCsvAptPrice: {
            available: false,
            reason: '빠른조회 모드에서 생략',
            filePath: LOCAL_HOUSING_CSV_PATH || null,
            hoCandidates: []
          },
          pyeongSource: 'none',
          pyeongTypes: [],
          housingPipeline: housingResult,
          registryLinkage: buildRegistryLinkageInfo(normalized, registryFast, housingResult),
          descriptionHints: null,
          roadAccess: mobilityFast?.roadAccess || mobilityFastFallback.roadAccess,
          transit: mobilityFast?.transit || mobilityFastFallback.transit,
          nearbyItems: mobilityFast?.nearbyItems || [],
          performance: {
            fastMode: true,
            budgetMs: SEARCH_FAST_BUDGET_MS,
            elapsedMs: Date.now() - requestStart
          }
        };
        setSearchCache(cacheKey, fastPayload);
        return res.json(fastPayload);
      }

      const center = { lat: normalized.building.lat, lng: normalized.building.lng };
      const [registryResult, mobilityResult, rebAptId, localCsvResult, descriptionHintsResult] = await Promise.all([
        fetchBuildingRegistryDetails(normalized.parcel),
        fetchMobilityAndRoad(center).catch(() => buildEmptyMobilityResult()),
        fetchRebAptIdDetails(normalized).catch((error) => ({
          available: false,
          reason: `REB 단지식별 조회 실패: ${error.response?.data?.msg || error.message}`,
          complex: null,
          dongInfo: []
        })),
        fetchLocalCsvHousingUnits(normalized.parcel).catch((error) => ({
          available: false,
          reason: `로컬 CSV 조회 실패: ${error.message}`,
          filePath: LOCAL_HOUSING_CSV_PATH || null,
          hoCandidates: []
        })),
        fetchDescriptionHints(center, normalized?.building?.region || '').catch(() => null)
      ]);
      const vworldResult = {
        available: false,
        reason: '조회 비활성화: 전유공용면적 JSON 단일 원천 모드',
        year: null,
        pnu: null,
        hoCandidates: []
      };
      const housingResult = await fetchHousingUnitPipeline(normalized, registryResult, rebAptId, vworldResult, localCsvResult);
      registry = registryResult;
      mobility = mobilityResult;
      housingPipeline = housingResult;
      vworldAptPrice = vworldResult;
      localCsvAptPrice = localCsvResult;
      providerResult.rebAptId = rebAptId;
      registryLinkage = buildRegistryLinkageInfo(normalized, registryResult, housingResult);
      descriptionHints = descriptionHintsResult;
    } else {
      const osmResult = await searchWithOsm(q);
      providerResult = osmResult;
      const center = { lat: osmResult.building.lat, lng: osmResult.building.lng };
      mobility = await fetchMobilityAndRoad(center).catch(() => buildEmptyMobilityResult());
      registry = {
        available: false,
        reason: 'KAKAO_REST_API_KEY 및 BUILDING_REGISTRY_SERVICE_KEY 설정 시 건축물대장 상세 제공',
        summary: null,
        dongInfo: [],
        hoInfo: []
      };
      vworldAptPrice = {
        available: false,
        reason: 'KAKAO_REST_API_KEY 설정 시 VWorld 공동주택가격 연동을 사용할 수 있습니다.',
        year: null,
        pnu: null,
        hoCandidates: []
      };
      localCsvAptPrice = {
        available: false,
        reason: '카카오 필지코드가 있어야 로컬 CSV 매칭이 가능합니다.',
        filePath: LOCAL_HOUSING_CSV_PATH || null,
        hoCandidates: []
      };
      housingPipeline = {
        source: 'none',
        hoCandidates: [],
        dongCandidates: [],
        note: 'KAKAO_REST_API_KEY 설정 시 동/호/평형 보강 파이프라인을 사용할 수 있습니다.'
      };
      providerResult.rebAptId = {
        available: false,
        reason: 'KAKAO_REST_API_KEY 설정 시 REB 단지/동 보강을 사용할 수 있습니다.',
        complex: null,
        dongInfo: []
      };
      registryLinkage = {
        usableForRegistryWorkflow: false,
        sourceType: 'none',
        confidence: 'none',
        note: '카카오 주소 정규화/필지코드가 없어 등기 연계용 키를 만들 수 없습니다.',
        parcelKey: null
      };
      descriptionHints = null;
    }

    const summary = registry?.summary || {};
    providerResult.building.use = summary.mainPurpose && summary.mainPurpose !== '-'
      ? summary.mainPurpose
      : providerResult.building.use;

    const pyeongRows = pickRepresentativeUnits(Array.isArray(housingPipeline?.hoCandidates) ? housingPipeline.hoCandidates : []);
    const pyeongTypes = buildPyeongTypeList(pyeongRows, {
      areaBandStep: 0.01,
      minUnits: 1,
      includePriceStats: false,
      enforceResidentialArea: true
    });

    const payload = {
      ok: true,
      provider: providerResult.provider,
      building: providerResult.building,
      registry,
      rebAptId: providerResult.rebAptId || null,
      vworldAptPrice,
      localCsvAptPrice,
      pyeongSource: String(housingPipeline?.source || 'none'),
      pyeongTypes,
      housingPipeline,
      registryLinkage,
      descriptionHints,
      roadAccess: mobility?.roadAccess || null,
      transit: mobility?.transit || null,
      nearbyItems: mobility?.nearbyItems || providerResult.nearbyItems || []
    };
    setSearchCache(cacheKey, payload);
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.response?.data?.message || error.message || '주소 검색 중 오류가 발생했습니다.',
      detail: error.response?.data || null
    });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

async function start() {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start app:', error.message);
  process.exit(1);
});
