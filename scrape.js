#!/usr/bin/env node

const cheerio = require('cheerio');
const fetch = require('node-fetch');
const fs = require('fs').promises;
const process = require('process');

async function getWikiSource(pageTitle, type = 'classic') {
    const res = await fetch(
        `https://${type}.runescape.wiki/w/${pageTitle}?action=edit`
    );

    const html = await res.text();
    const $ = cheerio.load(html);

    return $('textarea').text();
}

async function getNewsPages(
    url = 'https://classic.runescape.wiki/w/Category:Updates'
) {
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);

    return $('.mw-category a')
        .toArray()
        .map((link) => link.attribs.href.replace(/^\/w\//, ''));
}

const url = process.argv[2];
const outputDirectory = process.argv[3];
const skip = process.argv[4] ? +process.argv[4] : -1;

(async () => {
    let updatePages = await getNewsPages(url);

    if (skip > 0) {
        updatePages = updatePages.slice(skip);
    }

    for (const pageName of updatePages) {
        const source = await getWikiSource(pageName);
        const fileName = encodeURIComponent(pageName.replace('Update:', ''));
        await fs.writeFile(`${outputDirectory}/${fileName}.wiki`, source);
        console.log('scraped ', pageName);
        await new Promise((resolve) => setTimeout(resolve, 1500));
    }
})();
