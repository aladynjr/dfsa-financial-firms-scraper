const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { parse } = require('json2csv');
const clc = require('cli-color');

const CSRF_TOKEN = '1727189943%3A88b5754d9766896012c8df0dea487681';

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
  }
}

async function getPassportFundDetails(passportId) {
  let config = {
    method: 'get',
    maxBodyLength: Infinity,
    url: `https://www.dfsa.ae/public-register/passport-funds/${passportId}`,
    headers: {
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'accept-language': 'en-US,en;q=0.9,be;q=0.8,ar;q=0.7',
      'cache-control': 'no-cache',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
    }
  };

  try {
    const response = await axios.request(config);
    const $ = cheerio.load(response.data);

    // Passport Fund Details
    const passportFundDetails = {};

    $('.tab-pane#funds .table-row.row_with_padding .col').each((i, el) => {
      const label = $(el).find('p.small.grey').text().trim();
      const value = $(el).find('p:nth-child(2)').text().trim();

      passportFundDetails[label] = value;
    });

    return passportFundDetails;
  } catch (error) {
    console.log(error);
  }
}

function formatData(data) {
  const formatted = { ...data };
  for (const key in formatted) {
    if (Array.isArray(formatted[key])) {
      formatted[key] = formatted[key].join(', ');
    } else if (typeof formatted[key] === 'object' && formatted[key] !== null) {
      formatted[key] = JSON.stringify(formatted[key]);
    }
  }
  return formatted;
}

function getFullUrl(href) {
  return `https://www.dfsa.ae${href}`;
}

function ensureDirectoryExistence(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function scrapePassportedFunds() {
  console.log(clc.cyan('Starting Passported Funds scraper...'));

  const resultsDir = path.join('results');
  const passportedFundsDir = path.join(resultsDir, 'passported_funds');
  ensureDirectoryExistence(passportedFundsDir);

  console.log(clc.cyan('Scraping Passported Funds...'));

  const passportedFundsList = await getPassportFundsList(1);
  fs.writeFileSync(path.join(passportedFundsDir, 'passported_funds_list.csv'), parse(passportedFundsList.map(fund => ({
    ...formatData(fund),
    url: getFullUrl(fund.href)
  }))));
  console.log(clc.green(`Scraped ${passportedFundsList.length} passported funds`));

  for (let i = 0; i < Math.min(passportedFundsList.length, 5); i++) {
    const fund = passportedFundsList[i];
    console.log(clc.cyan(`Scraping details for passported fund ${i + 1}/${Math.min(passportedFundsList.length, 5)}: ${fund.name}`));
    const fundDetails = await getPassportFundDetails(fund.href.split('/').pop());
    
    const sanitizedName = fund.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    const formattedFundDetails = formatData({
      ...fund,
      ...fundDetails,
      url: getFullUrl(fund.href)
    });
    fs.writeFileSync(path.join(passportedFundsDir, `${sanitizedName}_DETAILS.csv`), parse([formattedFundDetails]));
  }
  console.log(clc.green(`Scraped and saved details for ${Math.min(passportedFundsList.length, 5)} passported funds`));
}

module.exports = scrapePassportedFunds;

if (require.main === module) {
  scrapePassportedFunds().catch(console.error);
}