const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const clc = require('cli-color');
const { parse } = require('json2csv');

const resultsDir = path.join('results');
const listsDir = path.join('lists');
const passportedFundsDir = path.join(resultsDir, 'passported_funds');
let totalFunds = 0;
let processedFunds = 0;

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

    const passportFundDetails = {};

    $('.tab-pane#funds .table-row.row_with_padding .col').each((i, el) => {
      const label = $(el).find('p.small.grey').text().trim();
      const value = $(el).find('p:nth-child(2)').text().trim();

      passportFundDetails[label] = value;
    });

    return passportFundDetails;
  } catch (error) {
    console.log(error);
    return null;
  }
}

function ensureDirectoryExistence(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getExistingFundsCount() {
  if (!fs.existsSync(passportedFundsDir)) {
    return 0;
  }
  return fs.readdirSync(passportedFundsDir).filter(file => file.endsWith('.json')).length;
}

function formatData(data, prefix = '') {
  const formatted = {};
  for (const [key, value] of Object.entries(data)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value)) {
      formatted[newKey] = value.join(', ');
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(formatted, formatData(value, newKey));
    } else {
      formatted[newKey] = value;
    }
  }
  return formatted;
}

async function processFund(fund) {
  console.log(clc.cyan(`Scraping details for fund: ${fund.name}`));
  const fundDetails = await getPassportFundDetails(fund.href.split('/').pop());
  
  if (!fundDetails) return null;

  const combinedData = {
    ...formatData(fund, 'fund_list'),
    ...formatData(fundDetails, 'fund_details')
  };

  const sanitizedName = fund.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  
  // Save individual fund JSON
  console.log(clc.yellow(`Saving JSON for fund: ${fund.name}`));
  fs.writeFileSync(path.join(passportedFundsDir, `${sanitizedName}.json`), JSON.stringify(combinedData, null, 2));
  console.log(clc.green(`JSON saved for fund: ${fund.name}`));

  // Save individual fund CSV
  console.log(clc.yellow(`Saving CSV for fund: ${fund.name}`));
  const fields = Object.keys(combinedData);
  const csvContent = parse([combinedData], { fields });
  fs.writeFileSync(path.join(passportedFundsDir, `${sanitizedName}.csv`), csvContent);
  console.log(clc.green(`CSV saved for fund: ${fund.name}`));

  processedFunds++;
  const progress = (processedFunds / totalFunds) * 100;
  console.log(clc.magenta(`Progress: ${processedFunds}/${totalFunds} (${progress.toFixed(2)}%)`));

  return combinedData;
}

async function processBatch(batch) {
  const batchPromises = batch.map(fund => processFund(fund));
  const batchResults = await Promise.all(batchPromises);
  return batchResults.filter(result => result !== null);
}

async function scrapePassportedFundsDetails() {
  console.log(clc.cyan('Starting Passported Funds Details scraper...'));

  ensureDirectoryExistence(resultsDir);
  ensureDirectoryExistence(passportedFundsDir);

  console.log(clc.cyan('Reading passported funds list from JSON file...'));

  const passportedFundsListPath = path.join(listsDir, 'passported_funds_list.json');
  if (!fs.existsSync(passportedFundsListPath)) {
    console.log(clc.red('Error: passported_funds_list.json not found. Please run scrapePassportedFundsList first.'));
    return;
  }

  const passportedFundsList = JSON.parse(fs.readFileSync(passportedFundsListPath, 'utf8'));

  totalFunds = passportedFundsList.length;
  console.log(clc.green(`Found ${totalFunds} funds in the JSON file`));

  const existingFundsCount = getExistingFundsCount();
  console.log(clc.yellow(`Found ${existingFundsCount} existing fund JSON files`));

  const remainingFunds = passportedFundsList.slice(existingFundsCount);
  console.log(clc.blue(`Resuming scraping from fund ${existingFundsCount + 1}`));

  const allFundsData = [];
  const batchSize = 1;
  processedFunds = existingFundsCount;

  for (let i = 0; i < remainingFunds.length; i += batchSize) {
    const batch = remainingFunds.slice(i, i + batchSize);
    console.log(clc.yellow(`Processing batch ${Math.floor((i + existingFundsCount) / batchSize) + 1}`));
    const batchResults = await processBatch(batch);
    allFundsData.push(...batchResults);

    const remainingFundsCount = totalFunds - processedFunds;
    const remainingPercentage = (remainingFundsCount / totalFunds) * 100;
    console.log(clc.blue(`Remaining: ${remainingFundsCount} funds (${remainingPercentage.toFixed(2)}%)`));
  }

  console.log(clc.green(`Scraped and saved details for ${allFundsData.length} new funds`));

  // Create consolidated JSON file
  console.log(clc.yellow('Creating consolidated JSON file...'));
  const allExistingFunds = fs.readdirSync(passportedFundsDir)
    .filter(file => file.endsWith('.json'))
    .map(file => JSON.parse(fs.readFileSync(path.join(passportedFundsDir, file), 'utf8')));
  
  fs.writeFileSync(path.join(resultsDir, 'all_passported_funds.json'), JSON.stringify(allExistingFunds, null, 2));
  console.log(clc.green('Created consolidated JSON file: all_passported_funds.json'));

  // Convert consolidated JSON to CSV
  console.log(clc.yellow('Converting consolidated JSON to CSV...'));
  const fields = [...new Set(allExistingFunds.flatMap(Object.keys))];
  const allFundsCsvContent = parse(allExistingFunds, { fields });
  fs.writeFileSync(path.join(resultsDir, 'all_passported_funds.csv'), allFundsCsvContent);
  console.log(clc.green('Created consolidated CSV file: all_passported_funds.csv'));
}

module.exports = scrapePassportedFundsDetails;

if (require.main === module) {
  scrapePassportedFundsDetails().catch(console.error);
}