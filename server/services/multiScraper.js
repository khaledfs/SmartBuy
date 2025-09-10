// server/services/multiScraper.js
const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

class MultiScraper {
  constructor() {
    this.sources = {
      chp: {
        name: 'CHP Price Comparison',
        baseUrl: 'https://chp.co.il/main_page/compare_results',
        enabled: true,
      }
    };

    const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 10 });
    this.http = axios.create({
      httpsAgent: keepAliveAgent,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
        'Referer': 'https://chp.co.il/'
      }
    });

    this._queue = [];
    this._inflight = 0;
    this._MAX_CONCURRENCY = 2;
    this._MIN_GAP_MS = 350;
    this._lastStart = 0;
  }

  _schedule(fn) {
    return new Promise((resolve, reject) => {
      this._queue.push({ fn, resolve, reject });
      this._drain();
    });
  }

  async _drain() {
    if (this._inflight >= this._MAX_CONCURRENCY) return;
    const next = this._queue.shift();
    if (!next) return;

    const since = Date.now() - this._lastStart;
    const wait = Math.max(0, this._MIN_GAP_MS - since);
    await new Promise(r => setTimeout(r, wait));

    this._inflight++;
    this._lastStart = Date.now();

    next.fn()
      .then(res => next.resolve(res))
      .catch(err => next.reject(err))
      .finally(() => {
        this._inflight--;
        this._drain();
      });
  }

  async _get(url, config = {}, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await this._schedule(() => this.http.get(url, config));
        if (typeof res.data === 'string' && res.data.length < 1000) {
          throw new Error('CHP short response (likely throttled)');
        }
        return res;
      } catch (err) {
        if (attempt === retries) throw err;
        const delay = 250 + attempt * 250 + Math.floor(Math.random() * 200);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  async searchProduct(city, searchTerm) {
    const results = [];
    for (const [sourceKey, source] of Object.entries(this.sources)) {
      if (!source.enabled) continue;
      try {
        const sourceResults = await this.searchInSource(sourceKey, city, searchTerm);
        if (sourceResults?.length) results.push(...sourceResults);
      } catch (error) {
        console.error(`❌ Error with ${source.name}:`, error.message);
      }
    }
    return results;
  }

  async searchInSource(sourceKey, city, searchTerm) {
    switch (sourceKey) {
      case 'chp':
        return this.searchCHP(city, searchTerm);
      default:
        return [];
    }
  }

  async searchCHP(city, barcode) {
    console.log(`🔍 CHP search for barcode ${barcode} in city ${city}` + 'here');
    const url = `https://chp.co.il/${encodeURIComponent(city)}/0/0/${barcode}/0`;

    try {
      const { data } = await this._get(url);

      const $ = cheerio.load(data);
      const rows = $('#results-table > tbody > tr');
      const results = [];
      if (rows.length === 0) return results;

      const toNumber = (txt) => {
        if (!txt) return NaN;
        const cleaned = String(txt)
          .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
          .replace(/\u00A0|\u202F|\u2009/g, ' ')
          .replace(/[^\d.,\- ]/g, '')                  // remove currency/letters
          .replace(/(\d)[.,](?=\d{3}\b)/g, '$1')       // drop thousands sep
          .replace(/\s+/g, '')
          .replace(',', '.');
        const n = parseFloat(cleaned);
        return Number.isFinite(n) ? n : NaN;
      };

      rows.each((i, row) => {
        const cells = $(row).find('td');
        if (cells.length < 5) return;

        const marketName = cells.eq(0).text().trim();
        const branch = cells.eq(1).text().trim();
        const address = cells.eq(2).text().trim();

        const col4Text = cells.eq(3).text().trim();
        const col5Text = cells.eq(4).text().trim();

        const p4 = toNumber(col4Text);
        const p5 = toNumber(col5Text);
        const price =
          (Number.isFinite(p4) && p4 > 0) ? p4 :
            (Number.isFinite(p5) && p5 > 0) ? p5 : NaN;

        if (!Number.isFinite(price)) return;

        results.push({
          source: 'chp',
          marketName,
          branch: marketName,
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

  aggregateResults(allResults) {
    const storeMap = new Map();
    for (const result of allResults) {
      const storeKey = `${result.source}_${result.address}`;
      if (!storeMap.has(storeKey)) {
        storeMap.set(storeKey, {
          source: result.source,
          branch: result.branch,
          address: result.address,
          totalPrice: 0,
          itemsFound: 0,
          itemPrices: {},
          productDetails: {},
        });
      }
      const store = storeMap.get(storeKey);
      store.totalPrice += result.price;
      store.itemsFound += 1;
      store.itemPrices[result.searchTerm] = result.price;
      store.productDetails[result.searchTerm] = {
        name: result.searchTerm,
        price: result.price,
        quantity: result.quantity,
      };
    }
    return Array.from(storeMap.values());
  }
}

module.exports = MultiScraper;
