// public/_worker.js

// Cloudflare Pages 环境变量会自动注入到 `env` 对象中
// env.VALID_KEYS: 逗号分隔的有效密钥列表
// env.ADMIN_PASSWORD: 管理员密码
// env.ADULT_CONTENT_KEYS: 逗号分隔的允许访问成人内容的密钥列表

const ADULT_KEYWORDS = [
  "伦理", "情色", "三级", "写真", "AV", "福利", "成人", "激情", "限制级", "无码", "番号",
  "淫", "骚", "性", "乱伦", "强奸", "偷窥", "SM", "调教", "变态", "口交", "肛交", "手淫",
  "自慰", "高潮", "潮吹", "熟女", "萝莉", "巨乳", "丝袜", "制服", "诱惑", "裸体", "肉搏",
  "痴汉", "痴女", "同性", "Gay", "Lesbian", "BDSM", "捆绑", "虐待", "束缚", "性幻想",
  "性游戏", "性癖", "黄色", "H片", "A片", "偷拍", "偷情", "出轨", "淫荡", "荡妇", "妓女",
  "卖淫", "援交", "春宫", "露点", "暴露", "强暴", "人妻", "偷拍", "偷情", "出轨"
];

// 优质且通常无广告的资源站白名单 (根据您的需求和之前对config.json的分析)
// 这里列出的是在MoonTV config.json中存在的且相对靠谱的源
const SAFE_API_SOURCES = [
    "dyttzy", "ruyi", "bfzy", "tyyszy", "ffzy", "zy360", "wolong", "jisu", "dbzy", "mozhua",
    "mdzy", "zuid", "yinghua", "wujin", "wwzy", "ikun"
];

async function handleRequest(request, env) {
    const url = new URL(request.url);
    const key = url.searchParams.get('key'); // 从URL参数获取密钥
    const path = url.pathname;

    const validKeys = env.VALID_KEYS ? env.VALID_KEYS.split(',') : [];
    const adminPassword = env.ADMIN_PASSWORD;
    const adultContentKeys = env.ADULT_CONTENT_KEYS ? env.ADULT_CONTENT_KEYS.split(',') : [];

    // --- 密钥验证逻辑 ---
    if (!key || !validKeys.includes(key) && key !== adminPassword) {
        // 如果没有提供密钥，或者密钥无效，直接返回403 Forbidden
        // 确保连logo图标都看不到，只返回一个空页面或简单错误信息
        return new Response('Access Denied: Invalid or missing key.', {
            status: 403,
            headers: { 'Content-Type': 'text/plain' }
        });
    }

    // --- 管理员访问逻辑 ---
    if (key === adminPassword) {
        // 管理员访问，不进行内容过滤，直接代理所有请求
        // 保持原始的config.json和所有API响应
        return fetch(request);
    }

    // --- 普通用户 (fyqnb) 访问逻辑 ---
    // 1. 拦截对 config.json 的请求，过滤广告源
    if (path === '/config.json') {
        const originalResponse = await fetch(request);
        const originalConfig = await originalResponse.json();

        const filteredConfig = {};
        for (const sourceKey in originalConfig) {
            if (SAFE_API_SOURCES.includes(sourceKey)) {
                filteredConfig[sourceKey] = originalConfig[sourceKey];
            }
        }
        return new Response(JSON.stringify(filteredConfig), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // 2. 拦截对视频API的请求，根据影片标题过滤成人内容
    // 假设视频API的路径通常包含 '/api/' 或 '/collect/'
    // 需要更精确的判断，可以根据 config.json 中实际的 api_site URL结构来调整
    // MoonTV的api_site结构是直接的域名，所以这里需要更通用地匹配所有出站API请求
    const isApiRequest = request.headers.get('Accept').includes('application/json') &&
                         (url.hostname.includes('api') || url.hostname.includes('collect') || url.hostname.includes('zyapi')); // 粗略判断API请求

    if (isApiRequest && request.method === 'GET' && !adultContentKeys.includes(key)) {
        const response = await fetch(request);
        const contentType = response.headers.get('Content-Type');

        if (contentType && contentType.includes('application/json')) {
            try {
                const data = await response.json();
                let filteredData = data;

                // 检查返回的数据结构，通常影片列表会在 'list' 或 'data' 数组中
                // 这是一个通用的尝试，可能需要根据具体API返回结构微调
                let itemsToFilter = [];
                if (Array.isArray(data.list)) {
                    itemsToFilter = data.list;
                } else if (Array.isArray(data.data)) {
                    itemsToFilter = data.data;
                } else if (Array.isArray(data.vod_list)) { // 针对某些视频API的特定结构
                    itemsToFilter = data.vod_list;
                }
                // 如果是单个影片详情，其title可能直接在根对象
                else if (typeof data.vod_name === 'string') {
                    if (ADULT_KEYWORDS.some(keyword => data.vod_name.includes(keyword))) {
                        return new Response(JSON.stringify({ message: "Content filtered." }), {
                            status: 200, // 返回200，但内容为空或提示，避免直接报错影响用户体验
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                }


                if (itemsToFilter.length > 0) {
                    const originalCount = itemsToFilter.length;
                    const cleanItems = itemsToFilter.filter(item => {
                        const title = item.vod_name || item.name || item.title || ''; // 尝试多种字段获取标题
                        return !ADULT_KEYWORDS.some(keyword => title.includes(keyword));
                    });

                    if (Array.isArray(data.list)) {
                        filteredData.list = cleanItems;
                    } else if (Array.isArray(data.data)) {
                        filteredData.data = cleanItems;
                    } else if (Array.isArray(data.vod_list)) {
                        filteredData.vod_list = cleanItems;
                    }

                    if (cleanItems.length < originalCount) {
                         console.log(`Filtered ${originalCount - cleanItems.length} adult items.`);
                    }
                    return new Response(JSON.stringify(filteredData), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

            } catch (e) {
                console.error("Error parsing API response or filtering content:", e);
                // 发生错误时，返回原始响应，避免中断服务
                return response;
            }
        }
    }

    // 其他所有请求（包括HTML、JS、CSS、图片等），直接代理
    return fetch(request);
}

// Cloudflare Pages Functions 的入口点
export const onRequest = handleRequest;
