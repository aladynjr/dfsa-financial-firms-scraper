const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const clc = require('cli-color');

async function getFundsList(page = 1) {
  let config = {
    method: 'get',
    maxBodyLength: Infinity,
    url: `https://www.dfsa.ae/public-register/funds?page=${page}&fundType=&type=&jurisdiction=&status=&keywords=&isAjax=true`,
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
      const fundType = $(element).find('div.col p.grey').last().text().replace('Fund Type:', '').trim();
      const href = $(element).attr('href');
      funds.push({ name, referenceNumber, fundType, href });
    });

    return funds;
  } catch (error) {
    console.error(`Error fetching page ${page}:`, error.message);
    return null;
  }
}


function ensureDirectoryExistence(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function scrapeFundsList() {
  console.log(clc.cyan('Starting Funds List scraper...'));

  const listsDir = path.join('lists');
  ensureDirectoryExistence(listsDir);

  console.log(clc.cyan('Scraping Funds List...'));

  let page = 1;
  let allFunds = [];
  let hasMorePages = true;

  while (hasMorePages) {
    console.log(clc.yellow(`Scraping page ${page}...`));
    const fundsList = await getFundsList(page);
    
    if (fundsList === null) {
      console.log(clc.red(`Error occurred while scraping page ${page}. Stopping.`));
      break;
    }

    if (fundsList.length === 0) {
      console.log(clc.green('Reached the end of the list.'));
      hasMorePages = false;
    } else {
      allFunds = allFunds.concat(fundsList);
      console.log(clc.green(`Scraped ${fundsList.length} funds from page ${page}`));
      page++;
    }
  }


  fs.writeFileSync(path.join(listsDir, 'funds_list.json'), JSON.stringify(allFunds, null, 2));
  console.log(clc.green(`Scraped and saved ${allFunds.length} funds to funds_list.json`));
}

if (require.main === module) {
  scrapeFundsList().catch(console.error);
}

module.exports = scrapeFundsList;