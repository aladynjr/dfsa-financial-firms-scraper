const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { parse } = require('json2csv');
const clc = require('cli-color');

const CSRF_TOKEN = '1727189943%3A88b5754d9766896012c8df0dea487681';

async function getProhibitedIndividualsList(page = 1) {
  let config = {
    method: 'get',
    maxBodyLength: Infinity,
    url: `https://www.dfsa.ae/public-register/prohibited-individuals?page=${page}&status=&keywords=&isAjax=true`,
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
    const individuals = [];

    $('a.table-row').each((index, element) => {
      const dateOfRestriction = $(element).find('div.col p').first().text().replace('Date of Restriction / Prohibition:', '').trim();
      const name = $(element).find('div.col p.grey').first().text().replace('Name', '').trim();
      const status = $(element).find('div.col p.grey').last().text().replace('Status of Restriction / Prohibition (Ongoing / Past)', '').trim();
      const href = $(element).attr('href');
      individuals.push({ dateOfRestriction, name, status, href });
    });

    return individuals;
  } catch (error) {
    console.log(error);
  }
}

// Note: The original script didn't include a function to get details of prohibited individuals.
// If you need to scrape more detailed information, you would add a function here similar to the other scrapers.

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

async function scrapeProhibitedIndividuals() {
  console.log(clc.cyan('Starting Prohibited Individuals scraper...'));

  const resultsDir = path.join('results');
  const prohibitedIndividualsDir = path.join(resultsDir, 'prohibited_individuals');
  ensureDirectoryExistence(prohibitedIndividualsDir);

  console.log(clc.cyan('Scraping Prohibited Individuals...'));

  const prohibitedIndividualsList = await getProhibitedIndividualsList(1);
  fs.writeFileSync(path.join(prohibitedIndividualsDir, 'prohibited_individuals_list.csv'), parse(prohibitedIndividualsList.map(individual => ({
    ...formatData(individual),
    url: getFullUrl(individual.href)
  }))));
  console.log(clc.green(`Scraped ${prohibitedIndividualsList.length} prohibited individuals`));

  // Note: If you decide to add a function to get more detailed information about each prohibited individual,
  // you would add a loop here similar to the other scrapers to get and save those details.
}

module.exports = scrapeProhibitedIndividuals;

if (require.main === module) {
  scrapeProhibitedIndividuals().catch(console.error);
}