require('dotenv').config();
const path = require('path');
const express = require('express');
const axios = require('axios');
const ratesBatchService = require('./ratesBatchService');

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

app.get('/api/batch/status', (_req, res) => {
  res.json({
    ok: true,
    status: ratesBatchService.getStatus()
  });
});

app.post('/api/batch/run', async (_req, res) => {
  const result = await ratesBatchService.runBatch('manual-api');
  if (!result.ok) {
    return res.status(500).json(result);
  }
  return res.json(result);
});

app.get('/api/rates', (req, res) => {
  const rows = ratesBatchService.queryRates({
    type: String(req.query.type || 'deposit').toLowerCase(),
    sort: String(req.query.sort || 'maxRate'),
    order: String(req.query.order || 'desc').toLowerCase(),
    q: String(req.query.q || ''),
    limit: String(req.query.limit || '50')
  });

  res.json({
    ok: true,
    rows,
    status: ratesBatchService.getStatus()
  });
});

const KAKAO_REST_API_KEY = String(process.env.KAKAO_REST_API_KEY || '').trim();
const BUILDING_REGISTRY_SERVICE_KEY = String(process.env.BUILDING_REGISTRY_SERVICE_KEY || '').trim();
const KAKAO_MAP_JS_KEY = String(process.env.KAKAO_MAP_JS_KEY || '').trim();
const KAKAO_BASE_URL = 'https://dapi.kakao.com/v2/local';
const BLD_REGISTRY_BASE_URL = 'https://apis.data.go.kr/1613000/BldRgstHubService';

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
    retries = 1
  } = options;

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await axios.get(`${BLD_REGISTRY_BASE_URL}/${operation}`, {
        params: {
          serviceKey: BUILDING_REGISTRY_SERVICE_KEY,
          sigunguCd: parcel.sigunguCd,
          bjdongCd: parcel.bjdongCd,
          platGbCd: parcel.platGbCd,
          bun: parcel.bun,
          ji: parcel.ji,
          numOfRows,
          pageNo: 1,
          _type: 'json'
        },
        timeout: timeoutMs
      });
      return normalizeItemsFromApi(response);
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
      }
    }
  }
  throw lastError || new Error('건축물대장 API 호출 실패');
}

function mapBuildingRegistrySummary(titleItem, recapItem) {
  const merged = { ...(recapItem || {}), ...(titleItem || {}) };
  const groundFloors = toInteger(pickFirst(merged, ['grndFlrCnt']));
  const undergroundFloors = toInteger(pickFirst(merged, ['ugrndFlrCnt']));
  const heightNumber = toNumber(pickFirst(merged, ['heit']));
  const elevatorCount = toInteger(pickFirst(merged, ['rideUseElvtCnt']));
  const parkingCount = toInteger(pickFirst(merged, ['totPkngCnt', 'totParkngCnt']));
  const archArea = toNumber(pickFirst(merged, ['archArea']));
  const totalArea = toNumber(pickFirst(merged, ['totArea']));

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

function mapDongInfo(floorItems, titleItems = []) {
  const grouped = new Map();
  floorItems.forEach((item) => {
    const dongName = String(pickFirst(item, ['dongNm', 'bldNm'], '동 미상'));
    if (!grouped.has(dongName)) {
      grouped.set(dongName, {
        dongName,
        floorCount: 0,
        maxFloor: null,
        minFloor: null
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
  if (grouped.size > 0) return [...grouped.values()];

  // Fallback: some parcels return no floor outline rows, but title rows still include dong names.
  titleItems.forEach((item) => {
    const dongName = String(pickFirst(item, ['dongNm', 'bldNm'], '')).trim();
    if (!dongName) return;
    if (!grouped.has(dongName)) {
      grouped.set(dongName, {
        dongName,
        floorCount: 0,
        maxFloor: null,
        minFloor: null
      });
    }
  });
  return [...grouped.values()];
}

function mapHoInfo(exclusiveItems) {
  return exclusiveItems
    .map((item) => {
      const area = toNumber(pickFirst(item, ['area']));
      return {
        dongName: String(pickFirst(item, ['dongNm'], '동 미상')),
        hoName: String(pickFirst(item, ['hoNm'], '-')),
        floorNumber: toInteger(pickFirst(item, ['flrNo'])),
        floorType: String(pickFirst(item, ['flrGbCdNm'], '-')),
        areaSquareMeter: area
      };
    })
    .filter((item) => item.hoName !== '-')
    .slice(0, 600);
}

async function fetchBuildingRegistryDetails(parcel) {
  if (!BUILDING_REGISTRY_SERVICE_KEY || !parcel) {
    return {
      available: false,
      reason: 'BUILDING_REGISTRY_SERVICE_KEY 누락 또는 지번 파라미터 부족',
      summary: null,
      dongInfo: [],
      hoInfo: []
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

    const summary = mapBuildingRegistrySummary(titleItems[0] || null, recapItems[0] || null);
    const dongInfo = mapDongInfo(floorItems, titleItems);
    const hoInfo = mapHoInfo(exclusiveItems);
    const noCoreData = !titleItems.length && !recapItems.length && !floorItems.length && !exclusiveItems.length;
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
      debug: {
        titleCount: titleItems.length,
        recapCount: recapItems.length,
        floorCount: floorItems.length,
        exclusiveCount: exclusiveItems.length
      }
    };
  } catch (error) {
    return {
      available: false,
      reason: `건축물대장 API 조회 실패: ${error.response?.data?.response?.header?.resultMsg || error.message}`,
      summary: null,
      dongInfo: [],
      hoInfo: [],
      debug: null
    };
  }
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

async function fetchTransitWithKakao(center) {
  if (!KAKAO_REST_API_KEY) return null;
  const [bus, subway, parking, elementary, middle, high] = await Promise.all([
    searchNearestKakaoKeyword(center, {
      query: '버스정류장',
      radius: 2500,
      filterFn: (doc) => {
        const text = `${doc.place_name || ''} ${doc.category_name || ''} ${doc.category_group_name || ''}`;
        return /버스정류장|정류소|버스스탑|버스정류/.test(text);
      },
      fallbackName: '가까운 버스정류장'
    }),
    searchNearestKakaoKeyword(center, {
      query: '지하철역',
      radius: 4000,
      filterFn: (doc) => String(doc.category_group_code || '') === 'SW8'
        || /지하철역|전철역/.test(`${doc.place_name || ''} ${doc.category_name || ''}`),
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

  const response = await axios.post('https://overpass-api.de/api/interpreter', query, {
    headers: { 'Content-Type': 'text/plain' },
    timeout: 15000
  });
  const elements = response.data?.elements || [];

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
    bus: limitByDistance(chooseCloserItem(kakaoTransit?.bus, osmTransit.bus), 1000) || mapNearestResult(null, '가까운 버스정류장'),
    subway: limitByDistance(chooseCloserItem(kakaoTransit?.subway, osmTransit.subway), 1000) || mapNearestResult(null, '가까운 지하철역'),
    parking: limitByDistance(chooseCloserItem(kakaoTransit?.parking, osmTransit.parking), 1000) || mapNearestResult(null, '인근 주차장'),
    schools: {
      elementary: limitByDistance(chooseCloserItem(kakaoTransit?.schools?.elementary, osmTransit.schools.elementary), 1000) || mapNearestResult(null, '가까운 초등학교'),
      middle: limitByDistance(chooseCloserItem(kakaoTransit?.schools?.middle, osmTransit.schools.middle), 1000) || mapNearestResult(null, '가까운 중학교'),
      high: limitByDistance(chooseCloserItem(kakaoTransit?.schools?.high, osmTransit.schools.high), 1000) || mapNearestResult(null, '가까운 고등학교')
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
    const normalized = await resolveAddressWithKakao(query);
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

app.get('/api/location/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({
      ok: false,
      error: 'q(query) 파라미터가 필요합니다.'
    });
  }

  try {
    let providerResult;
    let mobility = null;
    let registry = null;

    if (KAKAO_REST_API_KEY) {
      const normalized = await resolveAddressWithKakao(q);
      providerResult = {
        provider: normalized.provider,
        building: normalized.building
      };
      const center = { lat: normalized.building.lat, lng: normalized.building.lng };
      const [registryResult, mobilityResult] = await Promise.all([
        fetchBuildingRegistryDetails(normalized.parcel),
        fetchMobilityAndRoad(center)
      ]);
      registry = registryResult;
      mobility = mobilityResult;
    } else {
      const osmResult = await searchWithOsm(q);
      providerResult = osmResult;
      const center = { lat: osmResult.building.lat, lng: osmResult.building.lng };
      mobility = await fetchMobilityAndRoad(center);
      registry = {
        available: false,
        reason: 'KAKAO_REST_API_KEY 및 BUILDING_REGISTRY_SERVICE_KEY 설정 시 건축물대장 상세 제공',
        summary: null,
        dongInfo: [],
        hoInfo: []
      };
    }

    const summary = registry?.summary || {};
    providerResult.building.use = summary.mainPurpose && summary.mainPurpose !== '-'
      ? summary.mainPurpose
      : providerResult.building.use;

    return res.json({
      ok: true,
      provider: providerResult.provider,
      building: providerResult.building,
      registry,
      roadAccess: mobility?.roadAccess || null,
      transit: mobility?.transit || null,
      nearbyItems: mobility?.nearbyItems || providerResult.nearbyItems || []
    });
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
  await ratesBatchService.init();
  app.listen(port, () => {
    console.log(`Rates dashboard running on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start app:', error.message);
  process.exit(1);
});
