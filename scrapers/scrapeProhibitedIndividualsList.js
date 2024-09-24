const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const clc = require('cli-color');
const { stringify } = require('csv-stringify/sync');

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
    return []; // Return an empty array in case of error
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

async function scrapeProhibitedIndividualsList() {
  console.log(clc.cyan('Starting Prohibited Individuals List scraper...'));

  const listsDir = path.join('lists', 'prohibited_individuals');
  ensureDirectoryExistence(listsDir);

  console.log(clc.cyan('Scraping Prohibited Individuals List...'));

  let page = 1;
  let allIndividuals = [];
  let currentPageIndividuals;

  do {
    console.log(clc.yellow(`Scraping page ${page}...`));
    currentPageIndividuals = await getProhibitedIndividualsList(page);
    
    if (currentPageIndividuals.length > 0) {
      allIndividuals = allIndividuals.concat(currentPageIndividuals);
      console.log(clc.green(`Found ${currentPageIndividuals.length} individuals on page ${page}`));
      page++;
    } else {
      console.log(clc.yellow(`No more individuals found on page ${page}. Finishing scraping.`));
    }
  } while (currentPageIndividuals.length > 0);

  // Convert the data to CSV format
  const csvData = stringify(allIndividuals, {
    header: true,
    columns: ['dateOfRestriction', 'name', 'status', 'href']
  });

  // Save the CSV file
  const filePath = path.join(listsDir, 'prohibited_individuals_list.csv');
  fs.writeFileSync(filePath, csvData);
  console.log(clc.green(`Scraped and saved ${allIndividuals.length} prohibited individuals to ${filePath}`));
}

module.exports = scrapeProhibitedIndividualsList;

if (require.main === module) {
  scrapeProhibitedIndividualsList().catch(console.error);
}