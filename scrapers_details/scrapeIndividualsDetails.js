const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const { parse } = require('json2csv');
const clc = require('cli-color');
const path = require('path');

const resultsDir = path.join('results');
const listsDir = path.join('lists');
const individualsDir = path.join(resultsDir, 'individuals');
let totalIndividuals = 0;
let processedIndividuals = 0;

function ensureDirectoryExistence(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function getExistingIndividualsCount() {
    if (!fs.existsSync(individualsDir)) {
        return 0;
    }
    return fs.readdirSync(individualsDir).filter(file => file.endsWith('.json')).length;
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

function formatFirms(firms) {
    return firms.map(firm => 
        Object.entries(firm).map(([key, value]) => `${key}: ${value}`).join('\n       ')
    ).join('\n\n');
}

function formatRegulatoryActions(actions) {
    return actions.map(action => 
        Object.entries(action).map(([key, value]) => `${key}: ${value}`).join('\n       ')
    ).join('\n\n');
}

async function getIndividualDetails(individualId) {
    let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://www.dfsa.ae/public-register/individuals/${individualId}`,
        headers: {
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        }
    };

    try {
        const response = await axios.request(config);
        const $ = cheerio.load(response.data);

        const individualDetails = {
            Name: $('.tab-pane#individuals .table-row:nth-child(1) .col:first-child p:nth-child(2)').text().trim().split('\n')[0],
            'DFSA Reference Number': $('.tab-pane#individuals .table-row:nth-child(1) .col:nth-child(2) p:nth-child(2)').text().trim().replace(/Authorised Individuals/g, ''),
            'Firm Name': $('.tab-pane#individuals .table-row.row_with_padding .col:first-child p:nth-child(2) a').text().trim(),
            'Individual type': $('.tab-pane#individuals .table-row.row_with_padding .col:nth-child(2) p:nth-child(2)').text().trim(),
            Functions: $('.tab-pane#individuals .table-row.row_with_padding .col:nth-child(3) p:nth-child(2)').text().trim(),
            'Effective Date': $('.tab-pane#individuals .table-row.row_with_padding .col:nth-child(4) p:nth-child(2)').text().trim(),
            'Withdrawal Date': $('.tab-pane#individuals .table-row.row_with_padding .col:nth-child(5) p:nth-child(2)').text().trim(),
            Comments: $('.tab-pane#individuals .table-row.row_with_padding .col:nth-child(6) p:nth-child(2)').text().trim(),
        };

        const firms = [];
        $('.tab-pane#firms .table-row').each((i, el) => {
            const firm = {
                Name: $(el).find('.col:nth-child(1) p').text().trim(),
                'Reference Number': $(el).find('.col:nth-child(2) p').text().trim(),
                'Type of Firm': $(el).find('.col:nth-child(3) p').text().trim(),
                'Date Withdrawn': $(el).find('.col:nth-child(4) p').text().trim(),
            };
            firms.push(firm);
        });

        const regulatoryActions = [];
        $('.tab-pane#regulatory .table-row').each((i, el) => {
            const action = {
                Title: $(el).find('.col:nth-child(1) p').text().trim(),
                Category: $(el).find('.col:nth-child(2) p').text().trim(),
                'Date of Use': $(el).find('.col:nth-child(3) p').text().trim(),
            };
            regulatoryActions.push(action);
        });

        return { individualDetails, firms, regulatoryActions };
    } catch (error) {
        console.log(error);
        return null;
    }
}

async function processIndividual(individual) {
    console.log(clc.cyan(`Scraping details for individual: ${individual.name}`));
    const individualDetails = await getIndividualDetails(individual.href.split('/').pop());
    
    if (!individualDetails) return null;

    const combinedData = {
        ...formatData(individual, 'individual_list'),
        ...formatData(individualDetails.individualDetails, 'individual_details'),
        firms: formatFirms(individualDetails.firms),
        regulatory_actions: formatRegulatoryActions(individualDetails.regulatoryActions)
    };

    const sanitizedName = individual.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    // Save individual JSON
    console.log(clc.yellow(`Saving JSON for individual: ${individual.name}`));
    fs.writeFileSync(path.join(individualsDir, `${sanitizedName}.json`), JSON.stringify(combinedData, null, 2));
    console.log(clc.green(`JSON saved for individual: ${individual.name}`));

    // Save individual CSV
    console.log(clc.yellow(`Saving CSV for individual: ${individual.name}`));
    const fields = Object.keys(combinedData);
    const csvContent = parse([combinedData], { fields });
    fs.writeFileSync(path.join(individualsDir, `${sanitizedName}.csv`), csvContent);
    console.log(clc.green(`CSV saved for individual: ${individual.name}`));

    processedIndividuals++;
    const progress = (processedIndividuals / totalIndividuals) * 100;
    console.log(clc.magenta(`Progress: ${processedIndividuals}/${totalIndividuals} (${progress.toFixed(2)}%)`));

    return combinedData;
}

async function processBatch(batch) {
    const batchPromises = batch.map(individual => processIndividual(individual));
    const batchResults = await Promise.all(batchPromises);
    return batchResults.filter(result => result !== null);
}

async function scrapeIndividuals() {
    console.log(clc.cyan('Starting Individuals scraper...'));

    ensureDirectoryExistence(resultsDir);
    ensureDirectoryExistence(individualsDir);

    console.log(clc.cyan('Reading individuals list from JSON file...'));

    const individualsListPath = path.join(listsDir, 'individuals_list.json');
    const individualsList = JSON.parse(fs.readFileSync(individualsListPath, 'utf8'));

    totalIndividuals = individualsList.length;
    console.log(clc.green(`Found ${totalIndividuals} individuals in the JSON file`));

    const existingIndividualsCount = getExistingIndividualsCount();
    console.log(clc.yellow(`Found ${existingIndividualsCount} existing individual JSON files`));

    const remainingIndividuals = individualsList.slice(existingIndividualsCount);
    console.log(clc.blue(`Resuming scraping from individual ${existingIndividualsCount + 1}`));

    const allIndividualsData = [];
    const batchSize = 10;
    processedIndividuals = existingIndividualsCount;

    for (let i = 0; i < remainingIndividuals.length; i += batchSize) {
        const batch = remainingIndividuals.slice(i, i + batchSize);
        console.log(clc.yellow(`Processing batch ${Math.floor((i + existingIndividualsCount) / batchSize) + 1}`));
        const batchResults = await processBatch(batch);
        allIndividualsData.push(...batchResults);

        const remainingIndividualsCount = totalIndividuals - processedIndividuals;
        const remainingPercentage = (remainingIndividualsCount / totalIndividuals) * 100;
        console.log(clc.blue(`Remaining: ${remainingIndividualsCount} individuals (${remainingPercentage.toFixed(2)}%)`));
    }

    console.log(clc.green(`Scraped and saved details for ${allIndividualsData.length} new individuals`));

    // Create consolidated JSON file
    console.log(clc.yellow('Creating consolidated JSON file...'));
    const allExistingIndividuals = fs.readdirSync(individualsDir)
        .filter(file => file.endsWith('.json'))
        .map(file => JSON.parse(fs.readFileSync(path.join(individualsDir, file), 'utf8')));
    
    fs.writeFileSync(path.join(resultsDir, 'all_individuals.json'), JSON.stringify(allExistingIndividuals, null, 2));
    console.log(clc.green('Created consolidated JSON file: all_individuals.json'));

    // Convert consolidated JSON to CSV
    console.log(clc.yellow('Converting consolidated JSON to CSV...'));
    const fields = [...new Set(allExistingIndividuals.flatMap(Object.keys))];
    const allIndividualsCsvContent = parse(allExistingIndividuals, { fields });
    fs.writeFileSync(path.join(resultsDir, 'all_individuals.csv'), allIndividualsCsvContent);
    console.log(clc.green('Created consolidated CSV file: all_individuals.csv'));
}

module.exports = scrapeIndividuals;

if (require.main === module) {
    scrapeIndividuals().catch(console.error);
}