const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const clc = require('cli-color');

const CSRF_TOKEN = '1727200262%3A439ae136805f343e70eed555a5522c69';

async function getFirmsList(page = 1) {
    let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://www.dfsa.ae/public-register/firms?page=${page}&type=&financial_service=&keywords=&legal_status=&endorsement=&isAjax=true&csrf_token=${CSRF_TOKEN}`,
        headers: {
            'accept': 'text/html, */*; q=0.01',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
            'x-requested-with': 'XMLHttpRequest',
        }
    };

    try {
        const response = await axios.request(config);
        const $ = cheerio.load(response.data);
        const firms = [];

        $('a.table-row').each((index, element) => {
            const name = $(element).find('div.col p').first().text().replace('Name:', '').trim();
            const referenceNumber = $(element).find('div.col p.grey').first().text().replace('Reference number:', '').trim();
            const firmType = $(element).find('div.col p.grey').last().text().replace('Firm Type:', '').trim();
            const href = $(element).attr('href');
            firms.push({ name, referenceNumber, firmType, href });
        });

        return firms;
    } catch (error) {
        console.log(error);
        return [];
    }
}

function ensureDirectoryExistence(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

async function scrapeAllFirmsList() {
    console.log(clc.cyan('Starting Firms List scraper...'));

    const resultsDir = path.join('results');
    ensureDirectoryExistence(resultsDir);

    const allFirms = [];
    const totalPages = 95;

    for (let page = 1; page <= totalPages; page++) {
        console.log(clc.cyan(`Scraping page ${page}/${totalPages}`));
        const firms = await getFirmsList(page);
        allFirms.push(...firms);
        console.log(clc.green(`Found ${firms.length} firms on page ${page}`));
        
        // Optional: Add a delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(clc.green(`Total firms scraped: ${allFirms.length}`));

    // Save the results as JSON
    const jsonContent = JSON.stringify(allFirms, null, 2);
    fs.writeFileSync(path.join(resultsDir, 'firms_list.json'), jsonContent);
    console.log(clc.green('Saved results to results/firms_list.json'));
}

module.exports = scrapeAllFirmsList;

if (require.main === module) {
    scrapeAllFirmsList().catch(console.error);
}