const puppeteer = require('puppeteer');

class EmailExtractor {
    constructor() {
        this.browser = null;
        this.emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        this.ignoredExtensions = [
            '.png', '.jpg', '.jpeg', '.gif', '.css', '.js', '.webp', '.svg', 
            '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mp3', '.pdf', '.zip', 
            '.rar', '.exe', '.apk', '.dmg', '.iso', '.bmp', '.ico', '.tiff'
        ];
        this.interestingKeywords = ['contact', 'about', 'team', 'support', 'help', 'privacy', 'terms', 'impressum', 'reach'];
    }

    async init() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    async extractEmailsFromUrl(url) {
        if (!this.browser) await this.init();
        
        let page = null;
        const results = {
            url: url,
            status: 'success',
            emails: [],
            scraped_pages: 0,
            error: null
        };
        const uniqueEmails = new Set();
        const queuedLinks = new Set();

        try {
            // Normalize URL
            if (url) url = url.trim();
            if (!url.startsWith('http')) url = 'https://' + url;
            const domain = new URL(url).hostname;

            page = await this.browser.newPage();
            // Block images and fonts to speed up
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                const resourceType = req.resourceType();
                if (['image', 'font', 'stylesheet', 'media'].includes(resourceType)) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            // 1. Visit Homepage
            console.log(`Navigating to ${url}...`);
            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            } catch (navError) {
                // If direct nav fails, try adding www or removing it? 
                // For now, fail gracefully but keep trying if redirected
                console.error(`Navigation error for ${url}: ${navError.message}`);
                results.status = 'error';
                results.error = `Could not access site: ${navError.message}`;
                try { if (page && !page.isClosed()) await page.close(); } catch(e) {}
                return results;
            }
            results.scraped_pages++;

            // Extract from Homepage
            await this.scrapePageContent(page, uniqueEmails);

            // 2. Find Interesting Links
            const links = await page.$$eval('a', (anchors) => 
                anchors.map(a => ({ href: a.href, text: a.innerText }))
            );

            const interestingLinks = links.filter(link => {
                if (!link.href) return false;
                try {
                    const linkUrl = new URL(link.href, url);
                    if (linkUrl.hostname !== domain) return false; // Stay on same domain
                    const lowerHref = link.href.toLowerCase();
                    const lowerText = link.text.toLowerCase();
                    
                    // Specific keyword check
                    return this.interestingKeywords.some(keyword => 
                        lowerHref.includes(keyword) || lowerText.includes(keyword)
                    );
                } catch (e) {
                    return false;
                }
            }).map(l => l.href);

            // Dedup links
            const uniqueInterestingLinks = [...new Set(interestingLinks)].slice(0, 3); // Max 3 subpages

            // 3. Visit Interesting Pages
            for (const link of uniqueInterestingLinks) {
                if (link === url || link === url + '/') continue;
                console.log(`Visiting subpage: ${link}`);
                try {
                    await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    results.scraped_pages++;
                    await this.scrapePageContent(page, uniqueEmails);
                } catch (e) {
                    console.log(`Failed to visit ${link}: ${e.message}`);
                }
            }

        } catch (error) {
            console.error(`Fatal error scraping ${url}:`, error);
            results.status = 'error';
            results.error = error.message;
        } finally {
            if (page) {
                try {
                    if (!page.isClosed()) await page.close();
                } catch (e) {
                    console.error(`Error closing page for ${url}:`, e.message);
                }
            }
        }

        results.emails = Array.from(uniqueEmails).map(email => ({
            email: email,
            valid_mx: true // Stub for now, can implement DNS check if needed
        }));
        
        return results;
    }

    async scrapePageContent(page, emailSet) {
        // Method 1: Mailto links (most accurate)
        try {
            const mailtoEmails = await page.$$eval('a[href^="mailto:"]', (links) => 
                links.map(a => decodeURIComponent(a.href.replace('mailto:', '').split('?')[0]))
            );
            mailtoEmails.forEach(e => this.addEmailIfValid(e, emailSet));
        } catch (e) {
            console.warn("Error extracting mailto links", e);
        }

        // Method 2: Regex on full text
        try {
            const content = await page.evaluate(() => document.body.innerText);
            const matches = content.match(this.emailRegex) || [];
            matches.forEach(e => this.addEmailIfValid(e, emailSet));
        } catch (e) {
             console.warn("Error extracting text content", e);
        }
    }

    addEmailIfValid(email, set) {
        if (!email) return;
        email = email.toLowerCase().trim();
        
        // Filter garbage
        if (this.ignoredExtensions.some(ext => email.endsWith(ext))) return;
        
        // Basic structure check
        const parts = email.split('@');
        if (parts.length !== 2) return;
        if (!parts[1].includes('.')) return;
        if (parts[1].startsWith('.') || parts[1].endsWith('.')) return;

        set.add(email);
    }
}

module.exports = EmailExtractor;
