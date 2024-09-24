
require('dotenv').config();

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { parse } = require('json2csv');
const clc = require('cli-color');
const HttpsProxyAgent = require('https-proxy-agent');

const proxyHost = process.env.PROXY_HOST || 'shared-datacenter.geonode.com';
const proxyPort = Math.floor(Math.random() * 11 + 9000).toString();
const proxyUser = process.env.PROXY_USER || 'geonode_9JCPZiW1CD';
const proxyPass = process.env.PROXY_PASS || 'e6c374e4-13ed-4f4a-9ed1-8f31e7920485';
const proxyUrl = `http://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}`;
const httpsAgent = new HttpsProxyAgent(proxyUrl);
const resultsDir = path.join('results');
const firmsDir = path.join(resultsDir, 'firms');

let totalFirms = 0;
let processedFirms = 0;


async function getFirmDetails(firmId) {
    let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://www.dfsa.ae/public-register/firms/${firmId}`,
        headers: {
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'upgrade-insecure-requests': '1',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        },
     //   httpsAgent: httpsAgent
    };

    const maxRetries = 3;
    let retries = 0;

    while (retries < maxRetries) {
        try {
            console.log(clc.blue(`Sending request for firm ID: ${firmId}`));
            const response = await axios.request(config);
            console.log(clc.green(`Received response for firm ID: ${firmId}`));
            const $ = cheerio.load(response.data);
            const data = {
                firmDetails: {
                    financialServices: [],
                    investments: []
                },
                individuals: [],
                regulatoryActions: []
            };

            function addUnique(arr, item) {
                if (!arr.includes(item)) {
                    arr.push(item);
                }
            }

            $('#firms .table-row.row_with_padding').each((i, row) => {
                const cols = $(row).find('.col');
                cols.each((j, col) => {
                    const key = $(col).find('.small.grey').text().trim().replace(':', '');
                    const value = $(col).find('p:not(.small.grey)').text().trim();
                    if (key && value) {
                        data.firmDetails[key] = value;
                    }
                });
            });

            $('#firms .spcl_row1, #firms .spcl_row2').each((i, row) => {
                const serviceCol = $(row).find('.col:first-child p').text().trim();
                const investmentCol = $(row).find('.col:nth-child(3) p').text().trim();

                if (serviceCol) {
                    addUnique(data.firmDetails.financialServices, serviceCol);
                }

                if (investmentCol) {
                    investmentCol.split(',').forEach(investment => {
                        addUnique(data.firmDetails.investments, investment.trim());
                    });
                }
            });

            const restrictions = $('#firms .border-bottom-0 p:not(.small.grey)').text().trim();
            if (restrictions) {
                data.firmDetails['Restrictions'] = restrictions;
            }

            $('#individuals .table-row').each((i, row) => {
                const individual = {
                    name: $(row).find('.col:nth-child(1) p').text().trim(),
                    referenceNumber: $(row).find('.col:nth-child(2) p').text().trim(),
                    typeOfIndividual: $(row).find('.col:nth-child(3) p').text().trim(),
                    effectiveDate: $(row).find('.col:nth-child(4) p').text().trim(),
                    dateWithdrawn: $(row).find('.col:nth-child(5) p').text().trim()
                };
                data.individuals.push(individual);
            });

            $('#regulatory .table-row').each((i, row) => {
                const action = {
                    title: $(row).find('.col:nth-child(1) p').text().trim(),
                    category: $(row).find('.col:nth-child(2) p').text().trim(),
                    dateOfUse: $(row).find('.col:nth-child(3) p').text().trim()
                };
                data.regulatoryActions.push(action);
            });

            return data;
        } catch (error) {
            console.log(`Error fetching firm details (Attempt ${retries + 1}/${maxRetries}):`, error.message);
            retries++;
            if (retries === maxRetries) {
                console.log(`Max retries reached for firm ${firmId}. Giving up.`);
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 2000 * retries)); // Exponential backoff
        }
    }
}


function ensureDirectoryExistence(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function getExistingFirmsCount() {
    if (!fs.existsSync(firmsDir)) {
        return 0;
    }
    return fs.readdirSync(firmsDir).filter(file => file.endsWith('.json')).length;
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

function formatIndividuals(individuals) {
    return individuals.map(individual => 
        Object.entries(individual).map(([key, value]) => `${key}: ${value}`).join('\n       ')
    ).join('\n\n');
}

function formatRegulatoryActions(actions) {
    return actions.map(action => 
        Object.entries(action).map(([key, value]) => `${key}: ${value}`).join('\n       ')
    ).join('\n\n');
}

async function processFirm(firm) {
    console.log(clc.cyan(`Scraping details for firm: ${firm.name}`));
    const firmDetails = await getFirmDetails(firm.href.split('/').pop());
    
    if (!firmDetails) return null;

    const combinedData = {
        ...formatData(firm, 'firm_list'),
        ...formatData(firmDetails.firmDetails, 'firm_details'),
        individuals: formatIndividuals(firmDetails.individuals),
        regulatory_actions: formatRegulatoryActions(firmDetails.regulatoryActions)
    };

    const sanitizedName = firm.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    // Save individual firm JSON
    console.log(clc.yellow(`Saving JSON for firm: ${firm.name}`));
    fs.writeFileSync(path.join(firmsDir, `${sanitizedName}.json`), JSON.stringify(combinedData, null, 2));
    console.log(clc.green(`JSON saved for firm: ${firm.name}`));

    // Save individual firm CSV
    console.log(clc.yellow(`Saving CSV for firm: ${firm.name}`));
    const fields = Object.keys(combinedData);
    const csvContent = parse([combinedData], { fields });
    fs.writeFileSync(path.join(firmsDir, `${sanitizedName}.csv`), csvContent);
    console.log(clc.green(`CSV saved for firm: ${firm.name}`));

    processedFirms++;
    const progress = (processedFirms / totalFirms) * 100;
    console.log(clc.magenta(`Progress: ${processedFirms}/${totalFirms} (${progress.toFixed(2)}%)`));

    return combinedData;
}


async function processBatch(batch) {
    const batchPromises = batch.map(firm => processFirm(firm));
    const batchResults = await Promise.all(batchPromises);
    return batchResults.filter(result => result !== null);
}

async function scrapeFirms() {
    console.log(clc.cyan('Starting Firms scraper...'));

    ensureDirectoryExistence(resultsDir);
    ensureDirectoryExistence(firmsDir);

    console.log(clc.cyan('Reading firms list from JSON file...'));

    const firmsListPath = path.join(resultsDir, 'firms_list.json');
    const firmsList = JSON.parse(fs.readFileSync(firmsListPath, 'utf8'));

    totalFirms = firmsList.length;
    console.log(clc.green(`Found ${totalFirms} firms in the JSON file`));

    const existingFirmsCount = getExistingFirmsCount();
    console.log(clc.yellow(`Found ${existingFirmsCount} existing firm JSON files`));

    const remainingFirms = firmsList.slice(existingFirmsCount);
    console.log(clc.blue(`Resuming scraping from firm ${existingFirmsCount + 1}`));

    const allFirmsData = [];
    const batchSize = 1;
    processedFirms = existingFirmsCount;

    for (let i = 0; i < remainingFirms.length; i += batchSize) {
        const batch = remainingFirms.slice(i, i + batchSize);
        console.log(clc.yellow(`Processing batch ${Math.floor((i + existingFirmsCount) / batchSize) + 1}`));
        const batchResults = await processBatch(batch);
        allFirmsData.push(...batchResults);

        const remainingFirmsCount = totalFirms - processedFirms;
        const remainingPercentage = (remainingFirmsCount / totalFirms) * 100;
        console.log(clc.blue(`Remaining: ${remainingFirmsCount} firms (${remainingPercentage.toFixed(2)}%)`));
    }

    console.log(clc.green(`Scraped and saved details for ${allFirmsData.length} new firms`));

    // Create consolidated JSON file
    console.log(clc.yellow('Creating consolidated JSON file...'));
    const allExistingFirms = fs.readdirSync(firmsDir)
        .filter(file => file.endsWith('.json'))
        .map(file => JSON.parse(fs.readFileSync(path.join(firmsDir, file), 'utf8')));
    
    fs.writeFileSync(path.join(resultsDir, 'all_firms.json'), JSON.stringify(allExistingFirms, null, 2));
    console.log(clc.green('Created consolidated JSON file: all_firms.json'));

    // Convert consolidated JSON to CSV
    console.log(clc.yellow('Converting consolidated JSON to CSV...'));
    const fields = [...new Set(allExistingFirms.flatMap(Object.keys))];
    const allFirmsCsvContent = parse(allExistingFirms, { fields });
    fs.writeFileSync(path.join(resultsDir, 'all_firms.csv'), allFirmsCsvContent);
    console.log(clc.green('Created consolidated CSV file: all_firms.csv'));
}

module.exports = scrapeFirms;

if (require.main === module) {
    scrapeFirms().catch(console.error);
}