# rsc-news-archives
archived news posts from jagex for runescape classic. sourced from
[the runescape classic wiki](https://classic.runescape.wiki/w/Updates) and
[runescape.com](https://secure.runescape.com/m=news/list) and converted to
markdown (with HTML).

![](./doc/screenshot.png?raw=true)

## install

    $ npm install @2003scape/rsc-news-archives

## news
```javascript
[
    {
        body: '...',
        category: 0, // see below
        date: 973836000,
        title: '...'
    }
]
```

## categories
```javascript
const CATEGORY_IDS = {
    GAME_UPDATES: 0,
    WEBSITE: 1,
    CUSTOMER_SUPPORT: 2,
    TECHNICAL: 3,
    COMMUNITY: 4,
    BEHIND_THE_SCENES: 5,
    POLLS: 6
}
```

## license
CC-BY-SA-4.0 https://creativecommons.org/licenses/by-sa/4.0/legalcode
