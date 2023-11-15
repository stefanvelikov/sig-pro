const axios = require('axios');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');

const sitemapUrl = 'https://agota-studio.webflow.io/sitemap.xml';
const outputFolder = 'website';

// Main function to fetch and process the sitemap
async function fetchSitemap() {
  try {
    // Clear the contents of the website folder (excluding .htaccess)
    clearFolder(outputFolder);

    // Fetch the sitemap XML
    const response = await axios.get(sitemapUrl);

    // Parse XML to JavaScript object
    const parser = new xml2js.Parser();
    const sitemapObj = await parser.parseStringPromise(response.data);

    // Extract URLs from the sitemap
    const urls = sitemapObj.urlset.url.map(url => url.loc[0]);

    // Create the output folder if it doesn't exist
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder);
    }

    // Fetch and save content for each URL
    for (const url of urls) {
      try {
        const pageContent = await axios.get(url);

        // Customize this regex pattern as needed to remove specific attributes
        let cleanedContent = pageContent.data;

        // Check if the current URL is contact.html, and skip attribute removal
        if (!url.includes('contact')) {
          cleanedContent = cleanedContent.replace(/data-wf-domain="[^"]*"/g, '').replace(/data-wf-page="[^"]*"/g, '').replace(/data-wf-site="[^"]*"/g, '');
        }

        // Parse the URL to extract path segments
        const parsedUrl = new URL(url);
        const pathSegments = parsedUrl.pathname.split('/').filter(segment => segment);

        // Create nested folders based on the URL path segments
        let currentFolderPath = outputFolder;
        for (let i = 0; i < pathSegments.length - 1; i++) { // Exclude the last segment (filename)
          const segment = pathSegments[i];
          currentFolderPath = path.join(currentFolderPath, segment);
          if (!fs.existsSync(currentFolderPath)) {
            fs.mkdirSync(currentFolderPath);
          }
        }

        // Generate a filename by adding .html to the last non-empty path segment
        let fileName = pathSegments.length > 0 ? pathSegments.filter(segment => segment)[pathSegments.length - 1] + '.html' : 'index.html';

        // Check if a folder with the same name exists and rename the file to index.html
        if (fs.existsSync(path.join(currentFolderPath, fileName)) && fs.lstatSync(path.join(currentFolderPath, fileName)).isDirectory()) {
          fileName = 'index.html';
        }

        // Save the content to a file in the output folder
        const outputPath = path.join(currentFolderPath, fileName);
        fs.writeFileSync(outputPath, cleanedContent);

        console.log(`Content for ${url} fetched and saved to ${outputPath}`);
      } catch (error) {
        console.error(`Error fetching content for ${url}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Error fetching sitemap:', error.message);
  }
}

// Function to clear folder contents (excluding .htaccess)
function clearFolder(folderPath) {
  const files = fs.readdirSync(folderPath);

  for (const file of files) {
    if (file !== '.htaccess') {
      const filePath = path.join(folderPath, file);
      if (fs.lstatSync(filePath).isDirectory()) {
        clearFolder(filePath);
        fs.rmdirSync(filePath);
      } else {
        fs.unlinkSync(filePath);
      }
    }
  }
}

// Run the function
fetchSitemap();