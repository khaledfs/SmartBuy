const cheerio = require('cheerio');
const axios = require('axios');

class CHPClient {
    constructor() {
        this.http = axios.create({
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.6'
            }
        });
        this.MAX_REASONABLE_PRICE = 300; // tweak if needed
    }

    async _get(url) {
        return this.http.get(url);
    }

    _stripInvisible(s) {
        if (!s) return '';
        return s.replace(/[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, '');
    }

    _cleanHumanText(s) {
        s = this._stripInvisible(String(s || ''));
        s = s.normalize('NFKC')
            .replace(/[^\p{L}\p{N} .,'"()\-:/#&\u0590-\u05FF]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return s.length > 120 ? s.slice(0, 120) : s;
    }

    _toNumber(txt) {
        if (!txt) return NaN;
        const cleaned = this._stripInvisible(String(txt))
            .replace(/\u00A0|\u202F|\u2009/g, ' ')
            .replace(/[^\d.,\- ]/g, '')
            .replace(/(\d)[.,](?=\d{3}\b)/g, '$1')
            .replace(/\s+/g, '')
            .replace(',', '.');
        const n = parseFloat(cleaned);
        if (!Number.isFinite(n)) return NaN;
        if (n <= 0 || n > this.MAX_REASONABLE_PRICE) return NaN;
        return n;
    }

    async searchCHP(city, barcode) {
        console.log(`🔍 CHP search for barcode ${barcode} in city ${city}`);
        const url = `https://chp.co.il/${encodeURIComponent(city)}/0/0/${barcode}/0`;

        try {
            const { data } = await this._get(url);
            const $ = cheerio.load(data);

            $('*[style*="display:none"], *[style*="visibility:hidden"], .hidden, .sr-only, [aria-hidden="true"]').remove();

            const rows = $('#results-table > tbody > tr');
            const results = [];
            if (rows.length === 0) return results;

            const seen = new Set();

            rows.each((i, row) => {
                const cells = $(row).find('td');
                if (cells.length < 5) return;

                const marketName = this._cleanHumanText(cells.eq(0).text());
                const branch = this._cleanHumanText(cells.eq(1).text());
                const address = this._cleanHumanText(cells.eq(2).text());

                const p4 = this._toNumber(cells.eq(3).text());
                const p5 = this._toNumber(cells.eq(4).text());
                const price = Number.isFinite(p4) ? p4 : (Number.isFinite(p5) ? p5 : NaN);
                if (!Number.isFinite(price)) return;

                const key = `${marketName}|${branch}|${address}|${price}`;
                if (seen.has(key)) return;
                seen.add(key);

                results.push({
                    source: 'chp',
                    marketName,
                    branch,
                    address,
                    price,
                    quantity: 1,
                    searchTerm: barcode
                });
            });

            return results;
        } catch (error) {
            console.error('CHP scraping error:', error.message);
            return [];
        }
    }
}

// ✅ sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- example: multiple barcodes, flattened ---
(async () => {
    const client = new CHPClient();
    const city = "רמת גן";
    const barcodes = ["7290110566579", "7290000042435", "7296073310193"];

    const all = [];
    for (const code of barcodes) {
        await sleep(2000); // ⏳ wait 3 seconds politely
        const r = await client.searchCHP(city, code);
        all.push(...r);
    }
    console.log('Results:', all);
})();
