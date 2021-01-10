#!/usr/bin/env node

const cheerio = require('cheerio');
const fetch = require('node-fetch');
const fromMarkdown = require('mdast-util-from-markdown');
const fs = require('fs');
const slug = require('slug');
const toMarkdown = require('mdast-util-to-markdown');

const ADD_HEADER = true;
const DATE_REGEXP = /\{\{\s?(?:Jag)?Update\|\s?date\s?=\s?(.+)\}\}/i;
const IMAGE_REGEXP = /\[\[File\:(.+?)(:?\|.+?)?]\]/i;
const CATEGORY_REGEXP = /\[\[category:(.+?)\]\]/gi;
const LINK_REGEXP = /\[\[(.+?)\|(.+?)\]\]/i;
const EXT_LINK_REGEXP = /[^\[]\[http\:(.+?) (.+?)\]/i;

const CATEGORY_IDS = {
    GAME_UPDATES: 0,
    WEBSITE: 1,
    CUSTOMER_SUPPORT: 2,
    TECHNICAL: 3,
    COMMUNITY: 4,
    BEHIND_THE_SCENES: 5,
    POLLS: 6
};

const WIKI_CATEGORIES = [
    { name: 'Behind The Scenes', id: 5 },
    { name: 'Technical updates', id: 3 },
    { name: 'Game Updates', id: 0 },
    { name: 'Support updates', id: 2 },
    { name: 'Community', id: 4 },
    { name: 'Website', id: 1 }
];

WIKI_CATEGORIES.forEach((category) => {
    category.regexp = new RegExp(`\\[\\[category:${category.name}\\]\\]`, 'i');
});

const directory = process.argv[2] || './wikitext';
const output = process.argv[3] || './markdown';

const wikiFiles = fs.readdirSync(directory);

function formatDate(date) {
    return date.toLocaleString('default', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

async function getWikiImageURL(fileName) {
    const res = await fetch(
        `https://classic.runescape.wiki/w/File:${fileName}`
    );

    const html = await res.text();
    const $ = cheerio.load(html);

    return $('a.internal').attr('href');
}

async function downloadImage(url, fileName) {
    const res = await fetch(url);
    const buffer = await res.buffer();

    if (buffer) {
        await fs.promises.writeFile(`./images/${fileName}`, buffer);
    }
}

class Page {
    constructor(name, source) {
        this.date = null;
        this.name = name;
        this.source = source;
        this.markdownSource = source;
        this.category = 0;
    }

    getDate() {
        const match = this.source.match(DATE_REGEXP);

        if (!match) {
            throw new Error(`unable to extract date from ${this.name}`);
        }

        this.markdownSource = this.markdownSource.replace(match[0], '').trim();

        return new Date(match[1]);
    }

    getImages() {
        const images = [];

        while (true) {
            const match = this.markdownSource.match(IMAGE_REGEXP);

            if (match) {
                const file = match[1];
                images.push(file);

                const alignMatch = match[0]
                    .replace(file, '')
                    .match(/(right|left)/i);

                const thumbMatch = /thumb/i.test(match[0].replace(file, ''));

                const align = alignMatch ? ` align="${alignMatch[1]}"` : '';
                const thumb = thumbMatch ? ' rsc-image-thumb' : '';

                this.markdownSource = this.markdownSource.replace(
                    match[0],
                    `<a class="rsc-image${thumb}" href="/images/${file}">` +
                        `<img src="/images/${file}"${align}></a>`
                );
            } else {
                break;
            }
        }

        return images;
    }

    formatSic() {
        this.markdownSource = this.markdownSource.replace(
            /\{\{sic\}\}/gi,
            '<sup>sic</sup>'
        );
    }

    getCategory() {
        for (const { id, regexp } of WIKI_CATEGORIES) {
            const match = this.markdownSource.match(regexp);

            if (match) {
                this.category = id;
            }
        }

        this.markdownSource = this.markdownSource
            .replace(CATEGORY_REGEXP, '')
            .trim();
    }

    formatLinks() {
        while (true) {
            const linkMatches = this.markdownSource.match(LINK_REGEXP);

            if (linkMatches) {
                const page = encodeURIComponent(linkMatches[1]);
                const text = linkMatches[2];

                this.markdownSource = this.markdownSource.replace(
                    linkMatches[0],
                    `[${text}](https://classic.runescape.wiki/w/${page})`
                );
            } else {
                break;
            }
        }

        this.markdownSource = this.markdownSource.replace(
            /\[\[(.+?)\]\]/gi,
            '$1'
        );
    }

    formatExtLinks() {
        while (true) {
            const linkMatches = this.markdownSource.match(EXT_LINK_REGEXP);

            if (linkMatches) {
                const url = linkMatches[1];
                const text = linkMatches[2];

                this.markdownSource = this.markdownSource.replace(
                    linkMatches[0],
                    ` [${text}](http://http:${url})`
                );
            } else {
                break;
            }
        }
    }

    formatBreaks() {
        this.markdownSource = this.markdownSource.replace(
            /\<br\s?\/?>/gi,
            '\n'
        );
    }

    formatHeaders() {
        this.markdownSource = this.markdownSource
            .replace(/\=\=\=/g, ' ### ')
            .replace(/\=\=/g, ' ## ');
    }

    formatLists() {
        this.markdownSource = this.markdownSource.replace(
            /\*([^ ])|#/g,
            '* $1'
        );
    }

    removeTitles() {
        this.markdownSource = this.markdownSource
            .replace(/'''(.+?)'''((\<br\s?\/?>)|\n)/i, '')
            .trim();
    }

    convertTextStyles() {
        this.markdownSource = this.markdownSource
            .replace(/'''''(.+?)'''''/gi, '***$1***')
            .replace(/'''(.+?)'''/gi, '**$1**')
            .replace(/''(.+?)''/gi, '*$1*');
    }

    reformatMarkdown() {
        this.markdownSource = toMarkdown(fromMarkdown(this.markdownSource));
    }

    formatPage() {
        this.formatSic();
        this.date = this.getDate();
        this.images = this.getImages();
        this.getCategory();
        this.removeTitles();
        this.formatBreaks();
        this.formatLinks();
        this.formatExtLinks();
        this.formatLists();
        this.formatHeaders();
        this.convertTextStyles();
        this.reformatMarkdown();
    }
}

//const images = new Set();
const markdownPages = [];

// { id: { date, title } }
//const metaData = {};
const dump = [];

for (const fileName of wikiFiles) {
    const pageSource = fs.readFileSync(`${directory}/${fileName}`).toString();

    let pageName = decodeURIComponent(fileName)
        .replace(/_/g, ' ')
        .replace('.wiki', '')
        .replace(/ \((.+?)\)/, '');

    // strip the date from the title
    if (/^latest runescape news/i.test(pageName)) {
        pageName = 'Latest RuneScape News';
    }

    const page = new Page(pageName, pageSource);
    page.formatPage();
    markdownPages.push(page);

    /*const pageImages = page.images;
    pageImages.forEach((image) => images.add(image));*/
}

markdownPages
    .sort((a, b) => {
        if (a.date > b.date) {
            return 1;
        }

        if (a.date < b.date) {
            return -1;
        }

        return 0;
    })
    .forEach((page, index) => {
        dump.push({
            id: index,
            date: Math.floor(page.date / 1000),
            title: page.name,
            category: page.category,
            body: page.markdownSource
        });

        fs.writeFileSync(
            `${output}/${index}-${slug(page.name)}.md`,
            (ADD_HEADER
                ? `# ${page.name}\n*Published ${formatDate(page.date)}*\n\n`
                : '') + page.markdownSource
        );
    });

fs.writeFileSync('./markdown-dump.json', JSON.stringify(dump));

/*console.log(images);

(async () => {
    for (const image of images) {
        const url = await getWikiImageURL(encodeURIComponent(image.replace(/ /g, '_')));

        if (url) {
            await downloadImage(`https://classic.runescape.wiki/${url}`, image);
            console.log('downloaded', image);
            await new Promise((resolve) => setTimeout(resolve, 1500));
        } else {
            console.log('unable to find url for', image);
        }
    }
})();*/
