const fs = require('fs');
const news = require('./news');
const slug = require('slug');

function formatDate(date) {
    date = new Date(date*1000);

    return date.toLocaleString('default', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

for (const [i, page] of news.entries()) {
    fs.writeFileSync(
        `${__dirname}/markdown/${i}-${slug(page.title)}.md`,
        `# ${page.title}\n*Published ${formatDate(page.date)}*\n\n` + page.body
    );
}
