// index.js - Playwright only version (no Puppeteer)
import 'dotenv/config';
import { chromium } from 'playwright';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// OpenAI client initialization
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Load system prompt from file
 */
async function loadSystemPrompt() {
  try {
    const systemPrompt = await fs.readFile(path.join(__dirname, 'systemprompt.md'), 'utf-8');
    return systemPrompt;
  } catch (error) {
    console.error('Error loading system prompt:', error);
    throw error;
  }
}

/**
 * Load target URLs from environment or system prompt
 */
async function loadTargetURLs() {
  // First try from environment variable
  if (process.env.TARGET_URLS) {
    return process.env.TARGET_URLS.split(',').map(url => url.trim());
  }
  
  // Otherwise extract from system prompt
  const systemPrompt = await loadSystemPrompt();
  const urlPattern = /TARGET_URLS:\s*\n((?:- .*\n)+)/;
  const match = systemPrompt.match(urlPattern);
  
  if (match) {
    return match[1]
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim());
  }
  
  // Default URLs if none specified
  return [
    'https://www.google.com/finance/quote/VIX:INDEXCBOE'
  ];
}

/**
 * Scrape content from a single URL
 */
async function scrapeURL(url) {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'] // GitHub Actions対応
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const page = await context.newPage();
  
  try {
    console.log(`Scraping: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for content to load
    await page.waitForTimeout(2000);
    
    // Extract page data
    const pageData = await page.evaluate(() => {
      // Remove script and style elements
      const scripts = document.querySelectorAll('script, style');
      scripts.forEach(el => el.remove());
      
      // Get main content
      const title = document.title;
      const bodyText = document.body.innerText;
      
      // Try to find structured data
      const structuredData = {};
      
      // For financial data (like VIX)
      const priceElement = document.querySelector('[data-last-price], .YMlKec.fxKbKc, [class*="price"]');
      if (priceElement) {
        structuredData.price = priceElement.textContent.trim();
      }
      
      // For weather data
      const tempElements = document.querySelectorAll('.weather-telop, .temp, [class*="temperature"]');
      if (tempElements.length > 0) {
        structuredData.weather = Array.from(tempElements).map(el => el.textContent.trim());
      }
      
      return {
        title,
        bodyText: bodyText.substring(0, 5000), // Limit text length
        structuredData,
        url: window.location.href
      };
    });
    
    return pageData;
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return {
      url,
      error: error.message,
      title: 'Error',
      bodyText: `Failed to scrape: ${error.message}`
    };
  } finally {
    await browser.close();
  }
}

/**
 * Generate report content using OpenAI
 */
async function generateReport(scrapedData, systemPrompt) {
  const userContent = `
以下のウェブページからスクレイピングしたデータを分析し、HTMLレポートを作成してください。
グラフやチャートが適切な場合は、Chart.jsを使用してください。

スクレイピングデータ:
${JSON.stringify(scrapedData, null, 2)}

要件:
1. データを視覚的にわかりやすく表示
2. 重要な数値や情報をハイライト
3. 必要に応じてグラフやチャートを含める
4. レスポンシブなレイアウト
5. 見やすい配色とデザイン

完全なHTMLコード（Chart.jsのCDNを含む）を生成してください。
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API error:', error);
    // Fallback HTML if API fails
    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scraping Report</title>
    <style>
        body { font-family: sans-serif; padding: 20px; line-height: 1.6; }
        .error { color: red; padding: 20px; border: 1px solid red; }
        .data-section { margin: 20px 0; padding: 15px; background: #f5f5f5; }
        h1 { color: #333; }
        pre { background: #f0f0f0; padding: 10px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>Scraping Report - ${new Date().toLocaleString('ja-JP')}</h1>
    <div class="error">
        <h2>Error generating report</h2>
        <p>${error.message}</p>
    </div>
    <div class="data-section">
        <h2>Raw Data</h2>
        <pre>${JSON.stringify(scrapedData, null, 2)}</pre>
    </div>
</body>
</html>
    `;
  }
}

/**
 * Convert HTML to PNG using Playwright (not Puppeteer!)
 */
async function htmlToPNG(htmlContent, outputPath) {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'] // GitHub Actions対応
  });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 }
  });
  const page = await context.newPage();
  
  try {
    // Set HTML content
    await page.setContent(htmlContent, { waitUntil: 'networkidle' });
    
    // Wait for any charts to render
    await page.waitForTimeout(3000);
    
    // Take screenshot
    await page.screenshot({
      path: outputPath,
      fullPage: true
    });
    
    console.log(`Report saved to: ${outputPath}`);
  } catch (error) {
    console.error('Error generating PNG:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('Starting web scraping report generator...\n');
    
    // Load configuration
    const systemPrompt = await loadSystemPrompt();
    const urls = await loadTargetURLs();
    
    console.log(`Target URLs: ${urls.join(', ')}\n`);
    
    // Scrape all URLs
    const scrapedData = [];
    for (const url of urls) {
      const data = await scrapeURL(url);
      scrapedData.push(data);
    }
    
    // Generate report HTML
    console.log('\nGenerating report with OpenAI...');
    const reportHTML = await generateReport(scrapedData, systemPrompt);
    
    // Save HTML for debugging
    const htmlPath = path.join(__dirname, 'report.html');
    await fs.writeFile(htmlPath, reportHTML);
    console.log(`HTML saved to: ${htmlPath}`);
    
    // Convert to PNG
    console.log('\nConverting to PNG...');
    const pngPath = path.join(__dirname, 'report.png');
    await htmlToPNG(reportHTML, pngPath);
    
    console.log('\n✅ Report generation complete!');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (process.argv[1] === __filename) {
  main();
}
