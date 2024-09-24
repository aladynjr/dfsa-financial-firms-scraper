const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const clc = require('cli-color');

async function getPassportFundsList(page = 1) {
  let config = {
    method: 'get',
    maxBodyLength: Infinity,
    url: `https://www.dfsa.ae/public-register/passport-funds?page=${page}&fundType=&type=&jurisdiction=&status=&keywords=&isAjax=true`,
    headers: { 
      'accept': 'text/html, */*; q=0.01', 
      'accept-language': 'en-US,en;q=0.9,be;q=0.8,ar;q=0.7', 
      'cache-control': 'no-cache', 
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', 
      'x-requested-with': 'XMLHttpRequest'
    }
  };
  try {
    const response = await axios.request(config);
    const $ = cheerio.load(response.data);
    const funds = [];

    $('a.table-row').each((index, element) => {
      const name = $(element).find('div.col p').first().text().replace('Name:', '').trim();
      const referenceNumber = $(element).find('div.col p.grey').first().text().replace('Reference number:', '').trim();
      const dateOfRegistration = $(element).find('div.col p.grey').eq(1).text().replace('Date of Registration:', '').trim();
      const status = $(element).find('div.col p.grey').last().text().replace('Status:', '').trim();
      const href = $(element).attr('href');
      funds.push({ name, referenceNumber, dateOfRegistration, status, href });
    });

    return funds;
  } catch (error) {
    console.log(error);
    return [];
  }
}

function getFullUrl(href) {
  return `https://www.dfsa.ae${href}`;
}

function ensureDirectoryExistence(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function scrapePassportedFundsList() {
  console.log(clc.cyan('Starting Passported Funds List scraper...'));

  const listsDir = path.join('lists');
  ensureDirectoryExistence(listsDir);

  console.log(clc.cyan('Scraping Passported Funds List...'));

  let page = 1;
  let allFunds = [];
  let currentPageFunds;

  do {
    console.log(clc.yellow(`Scraping page ${page}...`));
    currentPageFunds = await getPassportFundsList(page);
    
    if (currentPageFunds.length > 0) {
      allFunds = allFunds.concat(currentPageFunds);
      console.log(clc.green(`Found ${currentPageFunds.length} funds on page ${page}`));
      page++;
    } else {
      console.log(clc.yellow(`No more funds found on page ${page}. Finishing scraping.`));
    }
  } while (currentPageFunds.length > 0);

  const passportedFundsListWithUrls = allFunds.map(fund => ({
    ...fund,
    url: getFullUrl(fund.href)
  }));

  fs.writeFileSync(path.join(listsDir, 'passported_funds_list.json'), JSON.stringify(passportedFundsListWithUrls, null, 2));
  console.log(clc.green(`Scraped and saved ${passportedFundsListWithUrls.length} passported funds to passported_funds_list.json`));
}

module.exports = scrapePassportedFundsList;

if (require.main === module) {
  scrapePassportedFundsList().catch(console.error);
}