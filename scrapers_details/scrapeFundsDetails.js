const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { parse } = require('json2csv');
const clc = require('cli-color');

const resultsDir = path.join('results');
const listsDir = path.join('lists');
const fundsDir = path.join(resultsDir, 'funds');
let totalFunds = 0;
let processedFunds = 0;

async function getFundDetails(fundUrl) {
  let config = {
    method: 'get',
    maxBodyLength: Infinity,
    url: fundUrl,
    headers: { 
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7', 
      'accept-language': 'en-US,en;q=0.9,be;q=0.8,ar;q=0.7', 
      'cache-control': 'no-cache', 
      'upgrade-insecure-requests': '1', 
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
    }
  };

  try {
    const response = await axios.request(config);
    const $ = cheerio.load(response.data);

    const isSubFund = $('#sub-funds-tab').parent().hasClass('active');

    if (isSubFund) {
      return parseSubFundPage($);
    } else {
      return parseMainFundPage($);
    }
  } catch (error) {
    console.log(error);
    return null;
  }
}

function parseMainFundPage($) {
  const fundDetails = {};
  $('.tab-pane#funds .table-row.row_with_padding .col').each((i, el) => {
    const label = $(el).find('p.small.grey').text().trim().replace(':', '');
    const value = $(el).find('p:nth-child(2)').text().trim();
    if (label && value) {
      fundDetails[label] = value;
    }
  });

  const subFunds = [];
  $('.tab-pane#sub-funds .table-row').each((i, el) => {
    const subFund = {
      Name: $(el).find('.col:nth-child(1) p').text().trim(),
      'Reference Number': $(el).find('.col:nth-child(2) p').text().trim(),
      'Type of Fund': $(el).find('.col:nth-child(3) p').text().trim(),
      'Start Date': $(el).find('.col:nth-child(4) p').text().trim()
    };
    subFunds.push(subFund);
  });

  return {
    fundDetails,
    subFunds,
    isSubFund: false
  };
}

function parseSubFundPage($) {
  const subFundDetails = {};
  $('.tab-pane#sub-funds .table-row.row_with_padding .col').each((i, el) => {
    const label = $(el).find('p.small.grey').text().trim().replace(':', '');
    const value = $(el).find('p:nth-child(2)').text().trim();
    if (label && value) {
      subFundDetails[label] = value;
    }
  });

  const funds = {};
  $('.tab-pane#funds .table-row').each((i, el) => {
    funds['Name'] = $(el).find('.col:nth-child(1) p').text().trim();
    funds['Reference Number'] = $(el).find('.col:nth-child(2) p').text().trim();
    funds['Type of Fund'] = $(el).find('.col:nth-child(3) p').text().trim();
    funds['Start Date'] = $(el).find('.col:nth-child(4) p').text().trim();
  });

  return {
    fundDetails: subFundDetails,
    funds,
    isSubFund: true
  };
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

function formatSubFunds(subFunds) {
  return subFunds.map(subFund => 
    Object.entries(subFund).map(([key, value]) => `${key}: ${value}`).join('\n       ')
  ).join('\n\n');
}

function ensureDirectoryExistence(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getExistingFundsCount() {
  if (!fs.existsSync(fundsDir)) {
    return 0;
  }
  return fs.readdirSync(fundsDir).filter(file => file.endsWith('.json')).length;
}

async function processFund(fund) {
  console.log(clc.cyan(`Scraping details for fund: ${fund.name}`));
  const fundDetails = await getFundDetails(fund.href);
  
  if (!fundDetails) return null;

  let combinedData;
  if (fundDetails.isSubFund) {
    combinedData = {
      ...formatData(fund, 'fund_list'),
      ...formatData(fundDetails.fundDetails, 'sub_fund_details'),
      ...formatData(fundDetails.funds, 'funds')
    };
  } else {
    combinedData = {
      ...formatData(fund, 'fund_list'),
      ...formatData(fundDetails.fundDetails, 'fund_details'),
      sub_funds: formatSubFunds(fundDetails.subFunds)
    };
  }

  const sanitizedName = fund.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  
  // Save individual fund JSON
  console.log(clc.yellow(`Saving JSON for fund: ${fund.name}`));
  fs.writeFileSync(path.join(fundsDir, `${sanitizedName}.json`), JSON.stringify(combinedData, null, 2));
  console.log(clc.green(`JSON saved for fund: ${fund.name}`));

  // Save individual fund CSV
  console.log(clc.yellow(`Saving CSV for fund: ${fund.name}`));
  const fields = Object.keys(combinedData);
  const csvContent = parse([combinedData], { fields });
  fs.writeFileSync(path.join(fundsDir, `${sanitizedName}.csv`), csvContent);
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
function getAllFields(data) {
  const fields = new Set();
  data.forEach(item => {
    Object.keys(item).forEach(key => {
      if (typeof item[key] === 'object' && item[key] !== null) {
        Object.keys(item[key]).forEach(nestedKey => {
          fields.add(`${key}.${nestedKey}`);
        });
      } else {
        fields.add(key);
      }
    });
  });
  return Array.from(fields);
}

function flattenObject(obj, prefix = '') {
  const flattened = {};
  Object.keys(obj).forEach(key => {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      Object.assign(flattened, flattenObject(obj[key], `${prefix}${key}.`));
    } else {
      flattened[`${prefix}${key}`] = obj[key];
    }
  });
  return flattened;
}

function sortAndGroupFields(fields) {
  // Group fields by their prefix
  const groupedFields = fields.reduce((acc, field) => {
    const prefix = field.split('.')[0];
    if (!acc[prefix]) {
      acc[prefix] = [];
    }
    acc[prefix].push(field);
    return acc;
  }, {});

  // Sort fields within each group
  Object.keys(groupedFields).forEach(prefix => {
    groupedFields[prefix].sort();
  });

  // Sort the prefixes
  const sortedPrefixes = Object.keys(groupedFields).sort();

  // Flatten the grouped and sorted fields
  return sortedPrefixes.flatMap(prefix => groupedFields[prefix]);
}
async function scrapeFundsDetails() {
  console.log(clc.cyan('Starting Funds Details scraper...'));

  ensureDirectoryExistence(listsDir);
  ensureDirectoryExistence(resultsDir);
  ensureDirectoryExistence(fundsDir);

  console.log(clc.cyan('Reading funds list from JSON file...'));

  const fundsListPath = path.join(listsDir, 'funds_list.json');
  const fundsList = JSON.parse(fs.readFileSync(fundsListPath, 'utf8'));

  totalFunds = fundsList.length;
  console.log(clc.green(`Found ${totalFunds} funds in the JSON file`));

  const existingFundsCount = getExistingFundsCount();
  console.log(clc.yellow(`Found ${existingFundsCount} existing fund JSON files`));

  if (existingFundsCount === totalFunds) {
    console.log(clc.green('All funds have already been processed. Skipping fetching step.'));
  } else {
    const remainingFunds = fundsList.slice(existingFundsCount);
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
  }

  // Create consolidated JSON file
  console.log(clc.yellow('Creating consolidated JSON file...'));
  const allExistingFunds = fs.readdirSync(fundsDir)
    .filter(file => file.endsWith('.json'))
    .map(file => JSON.parse(fs.readFileSync(path.join(fundsDir, file), 'utf8')));
  
  fs.writeFileSync(path.join(resultsDir, 'all_funds.json'), JSON.stringify(allExistingFunds, null, 2));
  console.log(clc.green('Created consolidated JSON file: all_funds.json'));

  // Convert consolidated JSON to CSV
  console.log(clc.yellow('Converting consolidated JSON to CSV...'));
  let fields = getAllFields(allExistingFunds);
  fields = sortAndGroupFields(fields);

  const flattenedFunds = allExistingFunds.map(fund => {
    const flattened = flattenObject(fund);
    fields.forEach(field => {
      if (!(field in flattened)) {
        flattened[field] = 'N/A';
      }
    });
    return flattened;
  });

  const allFundsCsvContent = parse(flattenedFunds, { fields });
  fs.writeFileSync(path.join(resultsDir, 'all_funds.csv'), allFundsCsvContent);
  console.log(clc.green('Created consolidated CSV file: all_funds.csv'));
}

if (require.main === module) {
  scrapeFundsDetails().catch(console.error);
}

module.exports = scrapeFundsDetails;