# dfsa-financial-firms-scraper

<img src="images/website.png" alt="DFSA Public Register Website" width="600">

A Node.js project for scraping financial firm data from the Dubai Financial Services Authority (DFSA) public register.

## Project Structure

- `scrapers_list/`: Contains scripts for scraping lists of firms, funds, and individuals
- `scrapers_details/`: Contains scripts for scraping detailed information about firms, funds, and individuals
- `lists/`: Directory where scraped list data is saved
- `results/`: Directory where detailed scraped data is saved
- `images/`: Contains images used in the README

## Prerequisites

- Node.js (version 12 or higher recommended)
- npm (comes with Node.js)

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/dfsa-financial-firms-scraper.git
   cd dfsa-financial-firms-scraper
   ```

2. Install dependencies:
   ```
   npm install
   ```

## Usage

### Scraping Lists

To scrape lists of firms, funds, or individuals:

1. Run the firms list scraper:
   ```
   node scrapers_list/firms_list_scraper.js
   ```

2. Run the funds list scraper:
   ```
   node scrapers_list/funds_list_scraper.js
   ```

3. Run the individuals list scraper:
   ```
   node scrapers_list/individuals_list_scraper.js
   ```

### Scraping Details

After scraping the lists, you can scrape detailed information:

1. Run the firms details scraper:
   ```
   node scrapers_details/firms_details_scraper.js
   ```

2. Run the funds details scraper:
   ```
   node scrapers_details/funds_details_scraper.js
   ```

3. Run the individuals details scraper:
   ```
   node scrapers_details/individuals_details_scraper.js
   ```

## Output

- List data is saved as JSON files in the `lists/` directory
- Detailed data is saved as individual JSON and CSV files in the `results/` directory
- Consolidated data for each category is saved as `all_firms.json`, `all_funds.json`, and `all_individuals.json` in the `results/` directory

## Example Data

You can view an example of the scraped firms data in this Google Sheets document:
[DFSA Firms Data Example](https://docs.google.com/spreadsheets/d/1T_iGUWwiSYMq7J_raVzwJWpeKadonTjyyWJ_R4lHPIs/edit?gid=0#gid=0)

This spreadsheet provides a sample of the type and structure of data that the scraper collects.

## Customization

This scraper was developed for a specific client and their particular requirements. As such, you may need to customize the code to fit your specific needs or to adapt to any changes in the DFSA website structure. Please review and modify the scraper scripts as necessary before use.

## Notes

- This scraper is designed for educational and research purposes only
- Be mindful of the DFSA website's terms of service and rate limiting
- Consider adding appropriate delays between requests to avoid overwhelming the server

## License

[MIT License](LICENSE)