const axios = require('axios');
const cheerio = require('cheerio');
const HttpsProxyAgent = require('https-proxy-agent');
const fs = require('fs').promises;
const path = require('path');

const BATCH_SIZE = 10;
const RATE_LIMIT_DELAY = 10; // 1 second delay between batches
const MAX_RETRIES = 3;
const RETRY_DELAY = 20; // 2 seconds delay between retries
const TARGET_INDIVIDUALS = 8000; // Stop when we reach this many individuals
const SAVE_THRESHOLD = 100; // Save every 1000 individuals

// Proxy configuration
const proxyHost = process.env.PROXY_HOST || 'shared-datacenter.geonode.com';
const proxyPort = Math.floor(Math.random() * 11 + 9000).toString();
const proxyUser = process.env.PROXY_USER || 'geonode_9JCPZiW1CD';
const proxyPass = process.env.PROXY_PASS || 'e6c374e4-13ed-4f4a-9ed1-8f31e7920485';
const proxyUrl = `http://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}`;
const httpsAgent = new HttpsProxyAgent(proxyUrl);

// Global variables
let allIndividuals = [];
let totalIndividuals = 0;
let lastSaveCount = 0;

async function fetchPageWithRetry(prefix, letter, page, retries = 0) {
  const url = `https://www.dfsa.ae/public-register/individuals?page=${page}&key_individual_function=&authorised_individual_function=Senior%2520Executive%2520Officer%2CCompliance%2520Officer%2CMoney%2520Laundering%2520Reporting%2520Officer%2CFinance%2520Officer%2CResponsible%2520Officer%2CLicensed%2520Representative%2CLicensed%2520Partner%2CLicensed%2520Director%2CSenior%2520Manager&audit_principal_function=&keywords=${prefix}%20${letter}&isAjax=true&csrf_token=1727205794%3A8d7cd20bc41b8aaef470291a1433a143`;

  console.log(`Fetching ${prefix} ${letter} page ${page} (Attempt ${retries + 1}/${MAX_RETRIES + 1})`);

  const config = {
    method: 'get',
    maxBodyLength: Infinity,
    url: url,
    headers: {
      'accept': 'text/html, */*; q=0.01',
      'accept-language': 'en-US,en;q=0.9,be;q=0.8,ar;q=0.7',
      'cache-control': 'no-cache',
      'cookie': 'visited=1; DFSALOGIN=cdh4p0eudhk50r4avdcv0avtno; *ga=GA1.1.1324461434.1727201686; *ga_V8Z90VXCTK=GS1.1.1727201685.1.1.1727206104.0.0.0; DFSALOGIN=chs7fcfk68fujumm232f60b1v4',
      'dnt': '1',
      'pragma': 'no-cache',
      'priority': 'u=1, i',
      'referer': 'https://www.dfsa.ae/public-register/individuals',
      'sec-ch-ua': '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
      'x-requested-with': 'XMLHttpRequest'
    },
    // httpsAgent: httpsAgent // Use the proxy
  };

  try {
    const response = await axios.request(config);
    const $ = cheerio.load(response.data);

    let pageIndividuals = [];
    $('a.table-row').each((i, element) => {
      const href = $(element).attr('href');
      const name = $(element).find('.col:nth-child(1) p').text().replace('Name:', '').trim();
      const referenceNumber = $(element).find('.col:nth-child(2) p').text().replace('Reference number:', '').trim();
      const individualType = $(element).find('.col:nth-child(3) p').text().replace('Individual Type:', '').trim();

      pageIndividuals.push({
        href: href,
        name: name,
        referenceNumber: referenceNumber,
        individualType: individualType
      });
    });

    console.log(`Successfully fetched ${prefix} ${letter} page ${page}: ${pageIndividuals.length} individuals found`);
    return pageIndividuals;
  } catch (error) {
    console.error(`Error fetching ${prefix} ${letter} page ${page}:`, error.message);
    if (retries < MAX_RETRIES) {
      console.log(`Retrying ${prefix} ${letter} page ${page} in ${RETRY_DELAY / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return fetchPageWithRetry(prefix, letter, page, retries + 1);
    } else {
      console.error(`Max retries reached for ${prefix} ${letter} page ${page}. Moving on.`);
      return [];
    }
  }
}

function removeDuplicates(individuals) {
  const beforeCount = individuals.length;
  console.log(`Before removing duplicates: ${beforeCount} individuals`);

  const uniqueIndividuals = Array.from(new Set(individuals.map(JSON.stringify))).map(JSON.parse);
  const afterCount = uniqueIndividuals.length;
  console.log(`After removing duplicates: ${afterCount} individuals`);
  console.log(`Removed ${beforeCount - afterCount} duplicates`);

  return uniqueIndividuals;
}

async function saveResults() {
  try {
    const listsDir = path.join(__dirname, '..', 'lists');
    await fs.mkdir(listsDir, { recursive: true });
    const filePath = path.join(listsDir, 'individuals_list.json');

    // Remove duplicates before saving
    const uniqueIndividuals = removeDuplicates(allIndividuals);

    await fs.writeFile(filePath, JSON.stringify(uniqueIndividuals, null, 2));
    console.log(`Results saved to ${filePath}`);

    // Update allIndividuals and totalIndividuals with deduplicated data
    allIndividuals = uniqueIndividuals;
    totalIndividuals = allIndividuals.length;
    lastSaveCount = totalIndividuals;

    console.log(`Updated total after deduplication: ${totalIndividuals} individuals`);
  } catch (error) {
    console.error('Error saving results to file:', error);
  }
}

async function searchAndParse() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const prefixes = ['Mr', 'Ms'];
  let startTime = new Date();

  console.log('Starting search process...');
  console.log(`Using proxy: ${proxyUrl}`);
  console.log(`Target: ${TARGET_INDIVIDUALS} individuals`);

  outerLoop:
  for (const prefix of prefixes) {
    for (const letter of alphabet) {
      let page = 0;
      let hasMorePages = true;

      console.log(`\nSearching for ${prefix} ${letter}...`);

      while (hasMorePages) {
        let batchPromises = [];
        for (let i = 0; i < BATCH_SIZE && hasMorePages; i++) {
          batchPromises.push(fetchPageWithRetry(prefix, letter, page + i));
        }

        const batchResults = await Promise.all(batchPromises);

        for (const individuals of batchResults) {
          if (individuals.length === 0) {
            hasMorePages = false;
          } else {
            allIndividuals = allIndividuals.concat(individuals);
            totalIndividuals = allIndividuals.length;
            console.log(`  Found ${individuals.length} individuals on page ${page}`);
            console.log(`  Current total: ${totalIndividuals} individuals`);
            page++;

            // Check if we need to save results
            if (totalIndividuals - lastSaveCount >= SAVE_THRESHOLD) {
              await saveResults();
            }

            if (totalIndividuals >= TARGET_INDIVIDUALS) {
              console.log(`Reached target of ${TARGET_INDIVIDUALS} individuals. Stopping search.`);
              break outerLoop;
            }
          }
        }

        if (hasMorePages) {
          console.log(`Waiting ${RATE_LIMIT_DELAY / 1000} seconds before next batch...`);
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
        }
      }

      console.log(`${prefix} ${letter}: ${totalIndividuals} individuals found so far`);

      // Log progress percentage
      const progress = ((prefixes.indexOf(prefix) * alphabet.length + alphabet.indexOf(letter) + 1) / (prefixes.length * alphabet.length)) * 100;
      console.log(`Overall progress: ${progress.toFixed(2)}%`);

      // Log elapsed time
      const elapsedTime = (new Date() - startTime) / 1000;
      console.log(`Elapsed time: ${elapsedTime.toFixed(2)} seconds`);
    }
  }

  console.log('\nSearch process completed.');
  console.log(`Total individuals found: ${totalIndividuals}`);
  const totalTime = (new Date() - startTime) / 1000;
  console.log(`Total execution time: ${totalTime.toFixed(2)} seconds`);

  // Save final results
  await saveResults();
}
searchAndParse();