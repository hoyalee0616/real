const axios = require('axios');

const WINDOW_MAP = {
  '1h': { label: '최근 1시간', ms: 60 * 60 * 1000 },
  '1w': { label: '최근 1주일', ms: 7 * 24 * 60 * 60 * 1000 },
  '30d': { label: '최근 30일', ms: 30 * 24 * 60 * 60 * 1000 }
};

const CATEGORY_HASHTAGS = {
  entertainment: ['reels', 'funny', 'viral', 'challenge'],
  music: ['music', 'kpop', 'dance', 'cover'],
  sports: ['sports', 'fitness', 'football', 'workout'],
  food: ['food', 'mukbang', 'recipe', 'cooking'],
  beauty_style: ['beauty', 'fashion', 'style', 'makeup'],
  travel: ['travel', 'trip', 'explore', 'vacation'],
  pets: ['pets', 'dog', 'cat', 'animal'],
  tech: ['tech', 'gadgets', 'ai', 'coding']
};

const CATEGORY_LABELS = {
  entertainment: '엔터테인먼트',
  music: '음악/댄스',
  sports: '스포츠/피트니스',
  food: '푸드/먹방',
  beauty_style: '뷰티/스타일',
  travel: '여행',
  pets: '반려동물',
  tech: '테크'
};

const REGION_HINT_TAGS = {
  KR: ['korea', 'korean', 'kpop', 'kfood'],
  US: ['usa', 'america'],
  JP: ['japan', 'japanese'],
  GB: ['uk', 'british'],
  IN: ['india', 'indian'],
  BR: ['brazil', 'brasil']
};

const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getWindow(window) {
  return WINDOW_MAP[window] || WINDOW_MAP['1w'];
}

function getCached(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function setCached(key, value) {
  cache.set(key, { timestamp: Date.now(), value });
}

function getGraphBase() {
  const version = process.env.INSTAGRAM_GRAPH_VERSION || 'v22.0';
  return `https://graph.facebook.com/${version}`;
}

function getAuthParams() {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  if (!accessToken) {
    throw new Error('INSTAGRAM_ACCESS_TOKEN is missing');
  }
  if (!igUserId) {
    throw new Error('INSTAGRAM_BUSINESS_ACCOUNT_ID is missing');
  }

  return { accessToken, igUserId };
}

function normalizeTag(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/#/g, '')
    .replace(/[^a-z0-9_\u3131-\uD79D]/g, '')
    .trim();
}

async function graphGet(path, params) {
  const response = await axios.get(`${getGraphBase()}${path}`, { params });
  return response.data;
}

async function getHashtagId(tag, igUserId, accessToken) {
  const normalized = normalizeTag(tag);
  if (!normalized) return null;

  const cacheKey = `hashtag:${igUserId}:${normalized}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const data = await graphGet('/ig_hashtag_search', {
    user_id: igUserId,
    q: normalized,
    access_token: accessToken
  });

  const id = data.data?.[0]?.id || null;
  if (id) setCached(cacheKey, id);
  return id;
}

function buildItem(media, windowMs) {
  const publishedAt = new Date(media.timestamp || Date.now());
  const ageMs = Math.max(Date.now() - publishedAt.getTime(), 1);
  const hours = Math.max(ageMs / (1000 * 60 * 60), 1 / 60);
  const likes = Number(media.like_count || 0);
  const comments = Number(media.comments_count || 0);
  const interactions = likes * 3 + comments * 5;
  const normalizedScore = (interactions / hours) * (windowMs / (24 * 60 * 60 * 1000));
  const caption = String(media.caption || '').trim();

  return {
    videoId: media.id,
    title: caption ? caption.split('\n')[0].slice(0, 120) : 'Untitled Reel',
    channelTitle: media.username || 'instagram',
    publishedAt: media.timestamp,
    thumbnailUrl: media.thumbnail_url || media.media_url || null,
    url: media.permalink,
    views: 0,
    likes,
    comments,
    trendScore: Number(normalizedScore.toFixed(2))
  };
}

async function fetchHashtagMedia(hashtagId, igUserId, accessToken) {
  const data = await graphGet(`/${hashtagId}/recent_media`, {
    user_id: igUserId,
    fields: [
      'id',
      'caption',
      'media_type',
      'media_product_type',
      'media_url',
      'thumbnail_url',
      'permalink',
      'timestamp',
      'like_count',
      'comments_count',
      'username'
    ].join(','),
    limit: 50,
    access_token: accessToken
  });

  return data.data || [];
}

async function fetchCategoryReels({ categoryId, hashtags, publishedAfter, maxPerCategory, windowMs, igUserId, accessToken }) {
  const itemMap = new Map();

  for (const tag of hashtags) {
    const hashtagId = await getHashtagId(tag, igUserId, accessToken);
    if (!hashtagId) continue;

    let mediaList = [];
    try {
      mediaList = await fetchHashtagMedia(hashtagId, igUserId, accessToken);
    } catch (_err) {
      continue;
    }

    for (const media of mediaList) {
      const published = new Date(media.timestamp || '').getTime();
      if (!published || published < new Date(publishedAfter).getTime()) continue;

      const productType = String(media.media_product_type || '').toUpperCase();
      const mediaType = String(media.media_type || '').toUpperCase();
      const isReel = productType === 'REELS' || mediaType === 'VIDEO';
      if (!isReel) continue;

      if (!media.permalink) continue;
      itemMap.set(media.id, buildItem(media, windowMs));
    }
  }

  return Array.from(itemMap.values())
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, maxPerCategory)
    .map((item) => ({ ...item, categoryId }));
}

function categoryQueryTags(regionCode, keyword) {
  const regionTags = REGION_HINT_TAGS[regionCode] || [];
  const customTag = normalizeTag(keyword);

  const entries = Object.entries(CATEGORY_HASHTAGS).map(([categoryId, tags]) => {
    const combined = [...tags, ...regionTags];
    if (customTag) combined.push(customTag);

    return {
      categoryId,
      categoryName: CATEGORY_LABELS[categoryId] || categoryId,
      hashtags: Array.from(new Set(combined))
    };
  });

  return entries;
}

function sampleData(window, regionCode, keyword) {
  return {
    source: 'sample',
    provider: 'instagram',
    window,
    windowLabel: getWindow(window).label,
    regionCode,
    keyword,
    generatedAt: new Date().toISOString(),
    categories: [
      {
        categoryId: 'entertainment',
        categoryName: '엔터테인먼트',
        items: [
          {
            videoId: 'sample1',
            title: '샘플 릴스 1',
            channelTitle: 'demo_account',
            publishedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            categoryId: 'entertainment',
            thumbnailUrl: null,
            url: 'https://www.instagram.com/reel/sample1/',
            views: 0,
            likes: 5300,
            comments: 190,
            trendScore: 22000
          }
        ]
      }
    ]
  };
}

async function getTrendingByCategory({ window = '1w', regionCode = 'KR', keyword = '' } = {}) {
  const { accessToken, igUserId } = getAuthParams();
  const selectedWindow = getWindow(window);
  const selectedRegionCode = String(regionCode || 'KR').toUpperCase();
  const selectedKeyword = String(keyword || '').trim();
  const maxPerCategory = Number(process.env.MAX_RESULTS_PER_CATEGORY || 10);
  const publishedAfter = new Date(Date.now() - selectedWindow.ms).toISOString();
  const cacheKey = `ig:${window}:${selectedRegionCode}:${selectedKeyword}:${maxPerCategory}`;

  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const categories = categoryQueryTags(selectedRegionCode, selectedKeyword);

    const results = await Promise.all(
      categories.map(async (category) => {
        const items = await fetchCategoryReels({
          categoryId: category.categoryId,
          hashtags: category.hashtags,
          publishedAfter,
          maxPerCategory,
          windowMs: selectedWindow.ms,
          igUserId,
          accessToken
        });

        return {
          categoryId: category.categoryId,
          categoryName: category.categoryName,
          items
        };
      })
    );

    const payload = {
      source: 'instagram',
      provider: 'instagram',
      window,
      windowLabel: selectedWindow.label,
      regionCode: selectedRegionCode,
      keyword: selectedKeyword,
      generatedAt: new Date().toISOString(),
      categories: results
        .filter((row) => row.items.length > 0)
        .sort((a, b) => (b.items[0]?.trendScore || 0) - (a.items[0]?.trendScore || 0))
    };

    setCached(cacheKey, payload);
    return payload;
  } catch (error) {
    return {
      ...sampleData(window, selectedRegionCode, selectedKeyword),
      error: error.message
    };
  }
}

module.exports = {
  getTrendingByCategory,
  getWindow
};
