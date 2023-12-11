const axios = require('axios');
const xml2js = require('xml2js');
const fs = require('fs').promises;
const path = require('path');
const { JSDOM } = require('jsdom');

const processingDomain = 'https://signaturepro.webflow.io';
const sitemapRealDomain = 'https://signaturedesign.pro';
const sitemapUrl = `${processingDomain}/sitemap.xml`;
const outputFolder = 'website';
const sitemapFileName = 'sitemap.xml';

async function clearFolder(folderPath, excludeFiles = []) {
  try {
    const files = await fs.readdir(folderPath);

    for (const file of files) {
      if (!excludeFiles.includes(file)) {
        const filePath = path.join(folderPath, file);
        if (await isDirectory(filePath)) {
          await clearFolder(filePath, excludeFiles);
          await fs.rmdir(filePath);
        } else {
          await fs.unlink(filePath);
        }
      }
    }
  } catch (error) {
    console.error(`Error clearing folder ${folderPath}:`, error.message);
  }
}

async function fetchSitemap() {
  try {
    await clearFolder(outputFolder, [`.htaccess`, sitemapFileName]);

    const response = await axios.get(sitemapUrl);
    const parser = new xml2js.Parser();
    const sitemapObj = await parser.parseStringPromise(response.data);

    const urls = sitemapObj.urlset.url.map(url => url.loc[0]);

    await fs.mkdir(outputFolder, { recursive: true });

    const updatedSitemapObj = {
      ...sitemapObj,
      urlset: {
        ...sitemapObj.urlset,
        url: urls.map(url => {
          const trimmedUrl = url.trim();
          const absoluteUrl = new URL(trimmedUrl, processingDomain);
          return { loc: `${sitemapRealDomain}${absoluteUrl.pathname}` };
        }),
      },
    };

    const builder = new xml2js.Builder();
    const updatedSitemapXml = builder.buildObject(updatedSitemapObj);

    const sitemapFilePath = path.join(outputFolder, sitemapFileName);
    await fs.writeFile(sitemapFilePath, updatedSitemapXml);

    console.log(`Updated sitemap saved to ${sitemapFilePath}`);

    for (const url of urls) {
      try {
        const pageContent = await axios.get(url.trim());
        const dom = new JSDOM(pageContent.data);
        const hasFormTag = dom.window.document.querySelector('form');

        let cleanedContent = pageContent.data;

        if (!hasFormTag) {
          cleanedContent = cleanedContent.replace(/data-wf-domain="[^"]*"/g, '')
            .replace(/data-wf-page="[^"]*"/g, '')
            .replace(/data-wf-site="[^"]*"/g, '');
        }

        const parsedUrl = new URL(url.trim());
        const pathSegments = parsedUrl.pathname.split('/').filter(segment => segment);

        let currentFolderPath = outputFolder;
        for (let i = 0; i < pathSegments.length - 1; i++) {
          const segment = pathSegments[i];
          currentFolderPath = path.join(currentFolderPath, segment);
          await fs.mkdir(currentFolderPath, { recursive: true });
        }

        let fileName = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] + '.html' : 'index.html';
        const filePath = path.join(currentFolderPath, fileName);

        if (await isDirectory(filePath)) {
          fileName = 'index.html';
        }

        await fs.writeFile(filePath, cleanedContent);

        console.log(`Content for ${url} fetched and saved to ${filePath}`);
      } catch (error) {
        console.error(`Error fetching content for ${url}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Error fetching or processing sitemap:', error.message);
  }
}

async function isDirectory(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isDirectory();
  } catch (error) {
    return false;
  }
}

fetchSitemap();