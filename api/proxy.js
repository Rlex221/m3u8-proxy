const axios = require('axios');

module.exports = async (req, res) => {
    // CORS ခွင့်ပြုရန်
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({ error: 'URL parameter is missing' });
    }

    try {
        const response = await axios({
            method: 'get',
            url: targetUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Referer': 'http://203.81.84.130/'
            }
        });

        const contentType = response.headers['content-type'] || '';
        res.setHeader('Content-Type', contentType);

        // အကယ်၍ ထွက်လာတဲ့ Response က .m3u8 Playlist ဖိုင်ဖြစ်နေပါက အတွင်းပါ .ts လင့်ခ်များကို Proxy ပုံစံ ပြောင်းပေးမည်
        if (targetUrl.endsWith('.m3u8') || contentType.includes('mpegurl') || contentType.includes('text')) {
            let data = '';
            response.data.on('data', chunk => {
                data += chunk;
            });

            response.data.on('end', () => {
                // မူလ URL ရဲ့ Base path ကို ရှာခြင်း (ဥပမာ - http://203.81.84.130/hls/mwd_serie/)
                const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
                const host = req.headers['host'];
                const protocol = req.headers['x-forwarded-proto'] || 'https';
                const proxyBase = `${protocol}://${host}/api/proxy?url=`;

                // .ts သို့မဟုတ် ဆက်စပ်ဖိုင် လင့်ခ်များကို Proxy လင့်ခ်အဖြစ် ပြောင်းလဲခြင်း
                const modifiedData = data.replace(/([^\r\n]+\.ts(\?[^\r\n]*)?)/g, (match) => {
                    if (match.startsWith('http')) {
                        return proxyBase + encodeURIComponent(match);
                    }
                    return proxyBase + encodeURIComponent(baseUrl + match);
                });

                res.status(200).send(modifiedData);
            });
        } else {
            // ပုံမှန် .ts ဗီဒီယို ဖိုင်များအတွက်မူ Stream အတိုင်း တိုက်ရိုက်ထုတ်ပေးမည်
            response.data.pipe(res);
        }

    } catch (error) {
        console.error('Proxy Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch the target URL' });
    }
};