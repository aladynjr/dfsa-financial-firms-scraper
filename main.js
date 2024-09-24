const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const { parse } = require('json2csv');
const clc = require('cli-color');
const path = require('path');

const CSRF_TOKEN = '1727189943%3A88b5754d9766896012c8df0dea487681'
async function getFirmsList(page = 1) {
  let config = {
    method: 'get',
    maxBodyLength: Infinity,
    url: `https://www.dfsa.ae/public-register/firms?page=${page}&type=&financial_service=&keywords=&legal_status=&endorsement=&isAjax=true&csrf_token=${CSRF_TOKEN}`,
    headers: { 
      'accept': 'text/html, */*; q=0.01', 
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', 
      'x-requested-with': 'XMLHttpRequest', 
    }
  };
    try {
      const response = await axios.request(config);
      const $ = cheerio.load(response.data);
      const firms = [];

      $('a.table-row').each((index, element) => {
        const name = $(element).find('div.col p').first().text().replace('Name:', '').trim();
        const referenceNumber = $(element).find('div.col p.grey').first().text().replace('Reference number:', '').trim();
        const firmType = $(element).find('div.col p.grey').last().text().replace('Firm Type:', '').trim();
        const href = $(element).attr('href');
        firms.push({ name, referenceNumber, firmType, href });
      });


      return firms 
    } catch (error) {
      console.log(error);
    }
  

}

async function getFirmDetails(firmId = 'julius-baer-middle-east-limited') {
    let config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `https://www.dfsa.ae/public-register/firms/${firmId}`,
      headers: { 
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7', 
        'upgrade-insecure-requests': '1', 
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', 
      }
    };
  
    try {
      const response = await axios.request(config);
      const $ = cheerio.load(response.data);
      const data = {
        firmDetails: {
          financialServices: [],
          investments: []
        },
        individuals: [],
        regulatoryActions: []
      };
      
      // Helper function to add unique items to an array
      function addUnique(arr, item) {
        if (!arr.includes(item)) {
          arr.push(item);
        }
      }
      
      // Parse Firm Details
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
      
      // Parse Financial Services and Investments
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
      
      // Parse Restrictions
      const restrictions = $('#firms .border-bottom-0 p:not(.small.grey)').text().trim();
      if (restrictions) {
        data.firmDetails['Restrictions'] = restrictions;
      }
      
      // Parse Individuals
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
  
      // Parse Regulatory Actions
      $('#regulatory .table-row').each((i, row) => {
        const action = {
          title: $(row).find('.col:nth-child(1) p').text().trim(),
          category: $(row).find('.col:nth-child(2) p').text().trim(),
          dateOfUse: $(row).find('.col:nth-child(3) p').text().trim()
        };
        data.regulatoryActions.push(action);
      });
  
      console.log(data);
      return data;
    } catch (error) {
      console.log(error);
    }
  }

  async function getIndividualsList(page = 1) {
  let config = {
    method: 'get',
    maxBodyLength: Infinity,
    url: `https://www.dfsa.ae/public-register/individuals?page=${page}&key_individual_function=&authorised_individual_function=&audit_principal_function=&keywords=&isAjax=true&csrf_token=${CSRF_TOKEN}`,
    headers: { 
      'accept': 'text/html, */*; q=0.01', 
      'accept-language': 'en-US,en;q=0.9,be;q=0.8,ar;q=0.7', 
      'cache-control': 'no-cache', 
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', 
      'x-requested-with': 'XMLHttpRequest', 
    }
  };

  try {
    const response = await axios.request(config);
    const html = response.data;
    const $ = cheerio.load(html);
    const individuals = [];

    $('a.table-row').each((i, element) => {
      const href = $(element).attr('href');
      const name = $(element).find('.col:nth-child(1) p').text().replace('Name:', '').trim();
      const referenceNumber = $(element).find('.col:nth-child(2) p').text().replace('Reference number:', '').trim();
      const individualType = $(element).find('.col:nth-child(3) p').text().replace('Individual Type:', '').trim();

      individuals.push({
        href: href,
        name: name,
        referenceNumber: referenceNumber,
        individualType: individualType
      });
    });

    console.log(individuals);
    return individuals;
  } catch (error) {
    console.log(error);
  }
  }
 
   
async function getIndividualDetails(individualId = 'ms-rola-seifeddine') {
  let config = {
    method: 'get',
    maxBodyLength: Infinity,
    url: `https://www.dfsa.ae/public-register/individuals/${individualId}`,
    headers: {
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'accept-language': 'en-US,en;q=0.9,be;q=0.8,ar;q=0.7',
      'upgrade-insecure-requests': '1',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    }
  };

  try {
    const response = await axios.request(config);
    const $ = cheerio.load(response.data);

    // Individual Details
    const individualDetails = {
      Name: $('.tab-pane#individuals .table-row:nth-child(1) .col:first-child p:nth-child(2)').text().trim().split('\n')[0], // Split by newline and take the first part
      'DFSA Reference Number': $('.tab-pane#individuals .table-row:nth-child(1) .col:nth-child(2) p:nth-child(2)').text().trim().replace(/Authorised Individuals/g, ''),
      'Firm Name': $('.tab-pane#individuals .table-row.row_with_padding .col:first-child p:nth-child(2) a').text().trim(),
      'Individual type': $('.tab-pane#individuals .table-row.row_with_padding .col:nth-child(2) p:nth-child(2)').text().trim(),
      Functions: $('.tab-pane#individuals .table-row.row_with_padding .col:nth-child(3) p:nth-child(2)').text().trim(),
      'Effective Date': $('.tab-pane#individuals .table-row.row_with_padding .col:nth-child(4) p:nth-child(2)').text().trim(),
      'Withdrawal Date': $('.tab-pane#individuals .table-row.row_with_padding .col:nth-child(5) p:nth-child(2)').text().trim(),
      Comments: $('.tab-pane#individuals .table-row.row_with_padding .col:nth-child(6) p:nth-child(2)').text().trim(),
    };

    // Firms
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

    // Regulatory Action
    const regulatoryActions = [];
    $('.tab-pane#regulatory .table-row').each((i, el) => {
      const action = {
        Title: $(el).find('.col:nth-child(1) p').text().trim(),
        Category: $(el).find('.col:nth-child(2) p').text().trim(),
        'Date of Use': $(el).find('.col:nth-child(3) p').text().trim(),
      };
      regulatoryActions.push(action);
    });

    const extractedData = {
      individualDetails,
      firms,
      regulatoryActions,
    };

    console.log(JSON.stringify(extractedData, null, 2));
    return extractedData;
  } catch (error) {
    console.log(error);
  }
}
  


  async function getFundsList(page = 1) {
    let config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `https://www.dfsa.ae/public-register/funds?page=${page}&fundType=&type=&jurisdiction=&status=&keywords=&isAjax=true`,
     // url: 'https://www.dfsa.ae/public-register/funds?page=2&fundType=&type=&jurisdiction=&status=&keywords=&isAjax=true',
      headers: { 
        'accept': 'text/html, */*; q=0.01', 
        'accept-language': 'en-US,en;q=0.9,be;q=0.8,ar;q=0.7', 
        'cache-control': 'no-cache', 
        'cookie': 'visited=1; DFSALOGIN=cdh4p0eudhk50r4avdcv0avtno; DFSALOGIN=chs7fcfk68fujumm232f60b1v4', 
        'dnt': '1', 
        'pragma': 'no-cache', 
        'priority': 'u=1, i', 
        'referer': 'https://www.dfsa.ae/public-register/funds', 
        'sec-ch-ua': '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"', 
        'sec-ch-ua-mobile': '?0', 
        'sec-ch-ua-platform': '"Windows"', 
        'sec-fetch-dest': 'empty', 
        'sec-fetch-mode': 'cors', 
        'sec-fetch-site': 'same-origin', 
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

      console.log(funds);
      return funds;
    } catch (error) {
      console.log(error);
    }

}
async function getFundDetails(fundUrl = 'https://www.dfsa.ae/public-register/funds/mashreq-capital-shariah-compliant-funds-oeic-limited') {
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

    // Fund Details
    const fundDetails = {
      Name: $('.tab-pane#funds .table-row.row_with_padding .col:nth-child(1) p:nth-child(2)').text().trim(),
      'Legal Status': $('.tab-pane#funds .table-row.row_with_padding .col:nth-child(2) p:nth-child(2)').text().trim(),
      'DFSA Reference Number': $('.tab-pane#funds .table-row.row_with_padding .col:nth-child(3) p:nth-child(2)').text().trim(),
      Address: $('.tab-pane#funds .table-row.row_with_padding .col:nth-child(4) p:nth-child(2)').text().trim(),
      'Telephone Number': $('.tab-pane#funds .table-row.row_with_padding .col:nth-child(5) p:nth-child(2)').text().trim(),
      'Fax Number': $('.tab-pane#funds .table-row.row_with_padding .col:nth-child(6) p:nth-child(2)').text().trim(),
      'Date of Incorporation': $('.tab-pane#funds .table-row.row_with_padding .col:nth-child(7) p:nth-child(2)').text().trim(),
      'Appointed Agent': $('.tab-pane#funds .table-row.row_with_padding .col:nth-child(8) p:nth-child(2)').text().trim(),
      'Appointed Agent Address': $('.tab-pane#funds .table-row.row_with_padding .col:nth-child(9) p:nth-child(2)').text().trim(),
      'Fund Type': $('.tab-pane#funds .table-row.row_with_padding .col:nth-child(10) p:nth-child(2)').text().trim(),
      'Fund Manager': $('.tab-pane#funds .table-row.row_with_padding .col:nth-child(11) p:nth-child(2)').text().trim(),
      Jurisdiction: $('.tab-pane#funds .table-row.row_with_padding .col:nth-child(12) p:nth-child(2)').text().trim()
    };

    // Sub Funds
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

    const extractedData = {
      fundDetails,
      subFunds
    };

    return extractedData;
  } catch (error) {
    console.log(error);
  }
}

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

    console.log(funds);
    return funds;
  } catch (error) {
    console.log(error);
  }
}


async function getPassportFundDetails(passportId = '19024') {
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

    console.log(JSON.stringify(passportFundDetails, null, 2));
    return passportFundDetails;
  } catch (error) {
    console.log(error);
  }
}


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

      console.log(individuals);
      return individuals;
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
  
  async function main() {
    console.log(clc.cyan('Starting scraper...'));
  
    const resultsDir = path.join('results');
    ensureDirectoryExistence(resultsDir);
  
    // Firms
    if (1) {
      console.log(clc.cyan('Scraping Firms...'));
      const firmsDir = path.join(resultsDir, 'firms');
      ensureDirectoryExistence(firmsDir);
  
      const firmsList = await getFirmsList(1);
      fs.writeFileSync(path.join(firmsDir, 'firms_list.csv'), parse(firmsList.map(firm => ({
        ...formatData(firm),
        url: getFullUrl(firm.href)
      }))));
      console.log(clc.green(`Scraped ${firmsList.length} firms`));
  
      for (let i = 0; i < Math.min(firmsList.length, 5); i++) {
        const firm = firmsList[i];
        console.log(clc.cyan(`Scraping details for firm ${i + 1}/${Math.min(firmsList.length, 5)}: ${firm.name}`));
        const firmDetails = await getFirmDetails(firm.href.split('/').pop());
        
        const sanitizedName = firm.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        const formattedFirmDetails = formatData({
          ...firmDetails.firmDetails,
          url: getFullUrl(firm.href)
        });
        fs.writeFileSync(path.join(firmsDir, `${sanitizedName}_DETAILS.csv`), parse([formattedFirmDetails]));
        
        if (firmDetails.individuals && firmDetails.individuals.length > 0) {
          const formattedIndividuals = firmDetails.individuals.map(individual => ({
            ...formatData(individual),
            firm_url: getFullUrl(firm.href)
          }));
          fs.writeFileSync(path.join(firmsDir, `${sanitizedName}_INDIVIDUALS.csv`), parse(formattedIndividuals));
        }
        
        if (firmDetails.regulatoryActions && firmDetails.regulatoryActions.length > 0) {
          const formattedActions = firmDetails.regulatoryActions.map(action => ({
            ...formatData(action),
            firm_url: getFullUrl(firm.href)
          }));
          fs.writeFileSync(path.join(firmsDir, `${sanitizedName}_regulatory_actions.csv`), parse(formattedActions));
        }
      }
      console.log(clc.green(`Scraped and saved details for ${Math.min(firmsList.length, 5)} firms`));
    }
    // Individuals
    if (0) {
      console.log(clc.cyan('Scraping Individuals...'));
      const individualsDir = path.join(resultsDir, 'individuals');
      ensureDirectoryExistence(individualsDir);
  
      const individualsList = await getIndividualsList(1);
      fs.writeFileSync(path.join(individualsDir, 'individuals_list.csv'), parse(individualsList.map(individual => ({
        ...formatData(individual),
        url: getFullUrl(individual.href)
      }))));
      console.log(clc.green(`Scraped ${individualsList.length} individuals`));
  
      for (let i = 0; i < Math.min(individualsList.length, 5); i++) {
        const individual = individualsList[i];
        console.log(clc.cyan(`Scraping details for individual ${i + 1}/${Math.min(individualsList.length, 5)}: ${individual.name}`));
        const individualDetails = await getIndividualDetails(individual.href.split('/').pop());
        
        const sanitizedName = individual.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        const formattedIndividualDetails = formatData({
          ...individual,
          ...individualDetails.individualDetails,
          firms: individualDetails.firms.map(firm => firm.Name).join(', '),
          url: getFullUrl(individual.href)
        });
        fs.writeFileSync(path.join(individualsDir, `${sanitizedName}_DETAILS.csv`), parse([formattedIndividualDetails]));
        
        if (individualDetails.firms && individualDetails.firms.length > 0) {
          const formattedFirms = individualDetails.firms.map(firm => ({
            ...formatData(firm),
            individual_url: getFullUrl(individual.href)
          }));
          fs.writeFileSync(path.join(individualsDir, `${sanitizedName}_FIRMS.csv`), parse(formattedFirms));
        }
        
        if (individualDetails.regulatoryActions && individualDetails.regulatoryActions.length > 0) {
          const formattedActions = individualDetails.regulatoryActions.map(action => ({
            ...formatData(action),
            individual_url: getFullUrl(individual.href)
          }));
          fs.writeFileSync(path.join(individualsDir, `${sanitizedName}_regulatory_actions.csv`), parse(formattedActions));
        }
      }
      console.log(clc.green(`Scraped and saved details for ${Math.min(individualsList.length, 5)} individuals`));
    }
  
    // Funds
    if (true) {
      console.log(clc.cyan('Scraping Funds...'));
      const fundsDir = path.join(resultsDir, 'funds');
      ensureDirectoryExistence(fundsDir);
  
      const fundsList = await getFundsList(1);
      fs.writeFileSync(path.join(fundsDir, 'funds_list.csv'), parse(fundsList.map(fund => ({
        ...formatData(fund),
        url: getFullUrl(fund.href)
      }))));
      console.log(clc.green(`Scraped ${fundsList.length} funds`));
  
      for (let i = 0; i < Math.min(fundsList.length, 5); i++) {
        const fund = fundsList[i];
        console.log(clc.cyan(`Scraping details for fund ${i + 1}/${Math.min(fundsList.length, 5)}: ${fund.name}`));
        const fundDetails = await getFundDetails(fund.href);
        
        const sanitizedName = fund.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        const formattedFundDetails = formatData({
          ...fund,
          ...fundDetails.fundDetails,
          url: getFullUrl(fund.href)
        });
        fs.writeFileSync(path.join(fundsDir, `${sanitizedName}_DETAILS.csv`), parse([formattedFundDetails]));
        
        if (fundDetails.subFunds && fundDetails.subFunds.length > 0) {
          const formattedSubFunds = fundDetails.subFunds.map(subFund => ({
            ...formatData(subFund),
            fund_url: getFullUrl(fund.href)
          }));
          fs.writeFileSync(path.join(fundsDir, `${sanitizedName}_SUB_FUNDS.csv`), parse(formattedSubFunds));
        }
      }
      console.log(clc.green(`Scraped and saved details for ${Math.min(fundsList.length, 5)} funds`));
    }
  
    // Passported Funds
    if (true) {
      console.log(clc.cyan('Scraping Passported Funds...'));
      const passportedFundsDir = path.join(resultsDir, 'passported_funds');
      ensureDirectoryExistence(passportedFundsDir);
  
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
  
    // Prohibited Individuals
    if (true) {
      console.log(clc.cyan('Scraping Prohibited Individuals...'));
      const prohibitedIndividualsDir = path.join(resultsDir, 'prohibited_individuals');
      ensureDirectoryExistence(prohibitedIndividualsDir);
  
      const prohibitedIndividualsList = await getProhibitedIndividualsList(1);
      fs.writeFileSync(path.join(prohibitedIndividualsDir, 'prohibited_individuals_list.csv'), parse(prohibitedIndividualsList.map(individual => ({
        ...formatData(individual),
        url: getFullUrl(individual.href)
      }))));
      console.log(clc.green(`Scraped ${prohibitedIndividualsList.length} prohibited individuals`));
    }
  
    console.log(clc.green('Scraping completed successfully!'));
  }
  
  
  
  main().catch(console.error);