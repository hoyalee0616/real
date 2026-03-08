const axios = require('axios');

const YOUTUBE_BASE = 'https://www.googleapis.com/youtube/v3';
const DEFAULT_CATEGORY_IDS = [
  '1',
  '2',
  '10',
  '15',
  '17',
  '19',
  '20',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '28'
];

const WINDOW_MAP = {
  '1h': { label: '최근 1시간', ms: 60 * 60 * 1000 },
  '1w': { label: '최근 1주일', ms: 7 * 24 * 60 * 60 * 1000 },
  '30d': { label: '최근 30일', ms: 30 * 24 * 60 * 60 * 1000 }
};

const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

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

function parseDurationSeconds(iso) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function getWindow(window) {
  return WINDOW_MAP[window] || WINDOW_MAP['1w'];
}

async function youtubeGet(path, params) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new Error('YOUTUBE_API_KEY is missing');
  }

  const response = await axios.get(`${YOUTUBE_BASE}/${path}`, {
    params: { ...params, key }
  });
  return response.data;
}

async function getCategoryMap(regionCode) {
  const cacheKey = `categories:${regionCode}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const data = await youtubeGet('videoCategories', {
    part: 'snippet',
    regionCode
  });

  const map = {};
  for (const item of data.items || []) {
    map[item.id] = item.snippet?.title || `Category ${item.id}`;
  }

  setCached(cacheKey, map);
  return map;
}

function buildTrendingItem(video, windowMs) {
  const snippet = video.snippet || {};
  const stats = video.statistics || {};
  const publishedAt = new Date(snippet.publishedAt);
  const ageMs = Math.max(Date.now() - publishedAt.getTime(), 1);
  const views = Number(stats.viewCount || 0);
  const likes = Number(stats.likeCount || 0);
  const comments = Number(stats.commentCount || 0);
  const hoursSincePublish = Math.max(ageMs / (1000 * 60 * 60), 1 / 60);

  const trendScore = views / hoursSincePublish + likes * 3 + comments * 5;
  const normalizedScore = trendScore * (windowMs / (24 * 60 * 60 * 1000));

  return {
    videoId: video.id,
    title: snippet.title,
    channelTitle: snippet.channelTitle,
    publishedAt: snippet.publishedAt,
    categoryId: snippet.categoryId,
    thumbnailUrl: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || null,
    url: `https://www.youtube.com/shorts/${video.id}`,
    durationSeconds: parseDurationSeconds(video.contentDetails?.duration || ''),
    views,
    likes,
    comments,
    trendScore: Number(normalizedScore.toFixed(2))
  };
}

async function fetchCategoryShorts({ regionCode, categoryId, publishedAfter, maxPerCategory, windowMs, keyword }) {
  const searchTerm = keyword ? `${keyword} #shorts` : '#shorts';
  const searchData = await youtubeGet('search', {
    part: 'id',
    type: 'video',
    order: 'viewCount',
    q: searchTerm,
    videoDuration: 'short',
    maxResults: Math.max(maxPerCategory * 2, 10),
    publishedAfter,
    regionCode,
    videoCategoryId: categoryId
  });

  const ids = (searchData.items || []).map((item) => item.id?.videoId).filter(Boolean);
  if (!ids.length) return [];

  const videoData = await youtubeGet('videos', {
    part: 'snippet,contentDetails,statistics',
    id: ids.join(','),
    maxResults: ids.length
  });

  const filtered = (videoData.items || [])
    .filter((video) => {
      const seconds = parseDurationSeconds(video.contentDetails?.duration || '');
      const published = new Date(video.snippet?.publishedAt).getTime();
      return seconds > 0 && seconds <= 70 && published >= new Date(publishedAfter).getTime();
    })
    .map((video) => buildTrendingItem(video, windowMs))
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, maxPerCategory);

  return filtered;
}

function sampleData(window, regionCode, keyword) {
  return {
    source: 'sample',
    window,
    windowLabel: getWindow(window).label,
    regionCode,
    keyword,
    generatedAt: new Date().toISOString(),
    categories: [
      {
        categoryId: '24',
        categoryName: 'Entertainment',
        items: [
          {
            videoId: 'sample1',
            title: '샘플 쇼츠 1',
            channelTitle: 'Demo Channel',
            publishedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
            categoryId: '24',
            thumbnailUrl: null,
            url: 'https://www.youtube.com/shorts/sample1',
            durationSeconds: 32,
            views: 120000,
            likes: 5300,
            comments: 190,
            trendScore: 155000
          }
        ]
      }
    ]
  };
}

async function getTrendingByCategory({ window = '1w', regionCode = 'KR', keyword = '' } = {}) {
  const selectedWindow = getWindow(window);
  const selectedRegionCode = String(regionCode || 'KR').toUpperCase();
  const selectedKeyword = String(keyword || '').trim();
  const maxPerCategory = Number(process.env.MAX_RESULTS_PER_CATEGORY || 10);
  const publishedAfter = new Date(Date.now() - selectedWindow.ms).toISOString();
  const cacheKey = `trending:${window}:${selectedRegionCode}:${maxPerCategory}:${selectedKeyword}`;

  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const categoryMap = await getCategoryMap(selectedRegionCode);
    const categoryIds = DEFAULT_CATEGORY_IDS.filter((id) => categoryMap[id]);

    const results = await Promise.all(
      categoryIds.map(async (categoryId) => {
        const items = await fetchCategoryShorts({
          regionCode: selectedRegionCode,
          categoryId,
          publishedAfter,
          maxPerCategory,
          windowMs: selectedWindow.ms,
          keyword: selectedKeyword
        });

        return {
          categoryId,
          categoryName: categoryMap[categoryId],
          items
        };
      })
    );

    const payload = {
      source: 'youtube',
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
      source: 'sample',
      error: error.message
    };
  }
}

module.exports = {
  getTrendingByCategory,
  getWindow
};
