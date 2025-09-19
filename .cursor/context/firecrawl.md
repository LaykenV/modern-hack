# Quickstart

> Firecrawl allows you to turn entire websites into LLM-ready markdown

<img className="block" src="https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/turn-websites-into-llm-ready-data--firecrawl.png?fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=4e7b593752a4ff638c1d1dbfddb54a9a" alt="Hero Light" width="1200" height="675" data-path="images/turn-websites-into-llm-ready-data--firecrawl.png" srcset="https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/turn-websites-into-llm-ready-data--firecrawl.png?w=280&fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=e80d7c4a694a930342577283249d461a 280w, https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/turn-websites-into-llm-ready-data--firecrawl.png?w=560&fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=1344a5340ddad90ee50ccf66b088b430 560w, https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/turn-websites-into-llm-ready-data--firecrawl.png?w=840&fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=060bf67f6a5b76002c4b416b165d0dce 840w, https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/turn-websites-into-llm-ready-data--firecrawl.png?w=1100&fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=f89c070acdb98f7e2b91f58209f7a628 1100w, https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/turn-websites-into-llm-ready-data--firecrawl.png?w=1650&fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=0486baeea836b83b6c84e28635b20604 1650w, https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/turn-websites-into-llm-ready-data--firecrawl.png?w=2500&fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=1fe62bc4843cf736d0462e93ae0610c8 2500w" data-optimize="true" data-opv="2" />

## Welcome to Firecrawl

[Firecrawl](https://firecrawl.dev?ref=github) is an API service that takes a URL, crawls it, and converts it into clean markdown. We crawl all accessible subpages and give you clean markdown for each. No sitemap required.

## How to use it?

We provide an easy to use API with our hosted version. You can find the playground and documentation [here](https://firecrawl.dev/playground). You can also self host the backend if you'd like.

Check out the following resources to get started:

* [x] **API**: [Documentation](https://docs.firecrawl.dev/api-reference/introduction)
* [x] **SDKs**: [Python](https://docs.firecrawl.dev/sdks/python), [Node](https://docs.firecrawl.dev/sdks/node)
* [x] **LLM Frameworks**: [Langchain (python)](https://python.langchain.com/docs/integrations/document_loaders/firecrawl/), [Langchain (js)](https://js.langchain.com/docs/integrations/document_loaders/web_loaders/firecrawl), [Llama Index](https://docs.llamaindex.ai/en/latest/examples/data_connectors/WebPageDemo/#using-firecrawl-reader), [Crew.ai](https://docs.crewai.com/), [Composio](https://composio.dev/tools/firecrawl/all), [PraisonAI](https://docs.praison.ai/firecrawl/), [Superinterface](https://superinterface.ai/docs/assistants/functions/firecrawl), [Vectorize](https://docs.vectorize.io/integrations/source-connectors/firecrawl)
* [x] **Low-code Frameworks**: [Dify](https://dify.ai/blog/dify-ai-blog-integrated-with-firecrawl), [Langflow](https://docs.langflow.org/), [Flowise AI](https://docs.flowiseai.com/integrations/langchain/document-loaders/firecrawl), [Cargo](https://docs.getcargo.io/integration/firecrawl), [Pipedream](https://pipedream.com/apps/firecrawl/)
* [x] **Community SDKs**: [Go](https://docs.firecrawl.dev/sdks/go), [Rust](https://docs.firecrawl.dev/sdks/rust) (v1)
* [x] **Others**: [Zapier](https://zapier.com/apps/firecrawl/integrations), [Pabbly Connect](https://www.pabbly.com/connect/integrations/firecrawl/)
* [ ] Want an SDK or Integration? Let us know by opening an issue.

**Self-host:** To self-host refer to guide [here](/contributing/self-host).

### API Key

To use the API, you need to sign up on [Firecrawl](https://firecrawl.dev) and get an API key.

### Features

* [**Scrape**](#scraping): scrapes a URL and get its content in LLM-ready format (markdown, summary, structured data via [json mode](#json-mode), screenshot, html)
* [**Crawl**](#crawling): scrapes all the URLs of a web page and return content in LLM-ready format
* [**Map**](/features/map): input a website and get all the website urls - extremely fast
* [**Search**](/features/search): search the web and get full content from results
* [**Extract**](/features/extract): get structured data from single page, multiple pages or entire websites with AI.

### Powerful Capabilities

* **LLM-ready formats**: markdown, summary, structured data, screenshot, HTML, links, metadata
* **The hard stuff**: proxies, anti-bot mechanisms, dynamic content (js-rendered), output parsing, orchestration
* **Lightning fast**: Get results in seconds—built for speed and high-throughput use cases.
* **Customizability**: exclude tags, crawl behind auth walls with custom headers, max crawl depth, etc...
* **Media parsing**: pdfs, docx, images.
* **Reliability first**: designed to get the data you need - no matter how hard it is.
* **Actions**: click, scroll, input, wait and more before extracting data

You can find all of Firecrawl's capabilities and how to use them in our [documentation](https://docs.firecrawl.dev/api-reference/v2-introduction)

## Installing Firecrawl

<CodeGroup>
  ```python Python
  # pip install firecrawl-py

  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")
  ```

  ```js Node
  # npm install @mendable/firecrawl-js

  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });
  ```
</CodeGroup>

## Scraping

To scrape a single URL, use the `scrape` method. It takes the URL as a parameter and returns the scraped data as a dictionary.

<CodeGroup>
  ```python Python
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")

  # Scrape a website:
  doc = firecrawl.scrape("https://firecrawl.dev", formats=["markdown", "html"])
  print(doc)
  ```

  ```js Node
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  // Scrape a website:
  const doc = await firecrawl.scrape('https://firecrawl.dev', { formats: ['markdown', 'html'] });
  console.log(doc);
  ```

  ```bash cURL
  curl -s -X POST "https://api.firecrawl.dev/v2/scrape" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "url": "https://firecrawl.dev",
      "formats": ["markdown", "html"]
    }'
  ```
</CodeGroup>

### Response

SDKs will return the data object directly. cURL will return the payload exactly as shown below.

```json
{
  "success": true,
  "data" : {
    "markdown": "Launch Week I is here! [See our Day 2 Release 🚀](https://www.firecrawl.dev/blog/launch-week-i-day-2-doubled-rate-limits)[💥 Get 2 months free...",
    "html": "<!DOCTYPE html><html lang=\"en\" class=\"light\" style=\"color-scheme: light;\"><body class=\"__variable_36bd41 __variable_d7dc5d font-inter ...",
    "metadata": {
      "title": "Home - Firecrawl",
      "description": "Firecrawl crawls and converts any website into clean markdown.",
      "language": "en",
      "keywords": "Firecrawl,Markdown,Data,Mendable,Langchain",
      "robots": "follow, index",
      "ogTitle": "Firecrawl",
      "ogDescription": "Turn any website into LLM-ready data.",
      "ogUrl": "https://www.firecrawl.dev/",
      "ogImage": "https://www.firecrawl.dev/og.png?123",
      "ogLocaleAlternate": [],
      "ogSiteName": "Firecrawl",
      "sourceURL": "https://firecrawl.dev",
      "statusCode": 200
    }
  }
}
```

## Crawling

The crawl feature allows you to automatically discover and extract content from a URL and all of its accessible subpages. With our SDKs, simply call the crawl method—this will submit a crawl job, wait for it to finish, and return the complete results for the entire site.

### Usage

<CodeGroup>
  ```python Python
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")

  docs = firecrawl.crawl(url="https://docs.firecrawl.dev", limit=10)
  print(docs)
  ```

  ```js Node
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  const docs = await firecrawl.crawl('https://docs.firecrawl.dev', { limit: 10 });
  console.log(docs);
  ```

  ```bash cURL
  curl -s -X POST "https://api.firecrawl.dev/v2/crawl" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "url": "https://docs.firecrawl.dev",
      "limit": 10
    }'
  ```
</CodeGroup>

If you're using our API directly, cURL or `start crawl` functions on SDKs, this will return an `ID` where you can use to check the status of the crawl.

```json
{
  "success": true,
  "id": "123-456-789",
  "url": "https://api.firecrawl.dev/v2/crawl/123-456-789"
}
```

### Get Crawl Status

Used to check the status of a crawl job and get its result.

<CodeGroup>
  ```python Python
  status = firecrawl.get_crawl_status("<crawl-id>")
  print(status)
  ```

  ```js Node
  const status = await firecrawl.getCrawlStatus("<crawl-id>");
  console.log(status);
  ```

  ```bash cURL
  # After starting a crawl, poll status by jobId
  curl -s -X GET "https://api.firecrawl.dev/v2/crawl/<jobId>" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY"
  ```
</CodeGroup>

#### Response

The response will be different depending on the status of the crawl. For not completed or large responses exceeding 10MB, a `next` URL parameter is provided. You must request this URL to retrieve the next 10MB of data. If the `next` parameter is absent, it indicates the end of the crawl data.

<CodeGroup>
  ```json Scraping
  {
    "status": "scraping",
    "total": 36,
    "completed": 10,
    "creditsUsed": 10,
    "expiresAt": "2024-00-00T00:00:00.000Z",
    "next": "https://api.firecrawl.dev/v2/crawl/123-456-789?skip=10",
    "data": [
      {
        "markdown": "[Firecrawl Docs home page![light logo](https://mintlify.s3-us-west-1.amazonaws.com/firecrawl/logo/light.svg)!...",
        "html": "<!DOCTYPE html><html lang=\"en\" class=\"js-focus-visible lg:[--scroll-mt:9.5rem]\" data-js-focus-visible=\"\">...",
        "metadata": {
          "title": "Build a 'Chat with website' using Groq Llama 3 | Firecrawl",
          "language": "en",
          "sourceURL": "https://docs.firecrawl.dev/learn/rag-llama3",
          "description": "Learn how to use Firecrawl, Groq Llama 3, and Langchain to build a 'Chat with your website' bot.",
          "ogLocaleAlternate": [],
          "statusCode": 200
        }
      },
      ...
    ]
  }
  ```

  ```json Completed
  {
    "status": "completed",
    "total": 36,
    "completed": 36,
    "creditsUsed": 36,
    "expiresAt": "2024-00-00T00:00:00.000Z",
    "next": "https://api.firecrawl.dev/v2/crawl/123-456-789?skip=26",
    "data": [
      {
        "markdown": "[Firecrawl Docs home page![light logo](https://mintlify.s3-us-west-1.amazonaws.com/firecrawl/logo/light.svg)!...",
        "html": "<!DOCTYPE html><html lang=\"en\" class=\"js-focus-visible lg:[--scroll-mt:9.5rem]\" data-js-focus-visible=\"\">...",
        "metadata": {
          "title": "Build a 'Chat with website' using Groq Llama 3 | Firecrawl",
          "language": "en",
          "sourceURL": "https://docs.firecrawl.dev/learn/rag-llama3",
          "description": "Learn how to use Firecrawl, Groq Llama 3, and Langchain to build a 'Chat with your website' bot.",
          "ogLocaleAlternate": [],
          "statusCode": 200
        }
      },
      ...
    ]
  }
  ```
</CodeGroup>

## JSON mode

With JSON mode, you can easily extract structured data from any URL. We support pydantic schemas to make it easier for you too. Here is how you to use it:

<CodeGroup>
  ```python Python
  from firecrawl import Firecrawl
  from pydantic import BaseModel
  app = Firecrawl(api_key="fc-YOUR-API-KEY")

  class JsonSchema(BaseModel):
      company_mission: str
      supports_sso: bool
      is_open_source: bool
      is_in_yc: bool

  result = app.scrape(
      'https://firecrawl.dev',
      formats=[{
        "type": "json",
        "schema": JsonSchema
      }],
      only_main_content=False,
      timeout=120000
  )

  print(result)
  ```

  ```js Node
  import FirecrawlApp from "@mendable/firecrawl-js";
  import { z } from "zod";

  const app = new FirecrawlApp({
    apiKey: "fc-YOUR_API_KEY"
  });

  // Define schema to extract contents into
  const schema = z.object({
    company_mission: z.string(),
    supports_sso: z.boolean(),
    is_open_source: z.boolean(),
    is_in_yc: z.boolean()
  });

  const result = await app.scrape("https://docs.firecrawl.dev/", {
    formats: [{
      type: "json",
      schema: schema
    }],
  });

  console.log(result);
  ```

  ```bash cURL
  curl -X POST https://api.firecrawl.dev/v2/scrape \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_API_KEY' \
      -d '{
        "url": "https://docs.firecrawl.dev/",
        "formats": [ {
          "type": "json",
          "schema": {
            "type": "object",
            "properties": {
              "company_mission": {
                        "type": "string"
              },
              "supports_sso": {
                        "type": "boolean"
              },
              "is_open_source": {
                        "type": "boolean"
              },
              "is_in_yc": {
                        "type": "boolean"
              }
            },
            "required": [
              "company_mission",
              "supports_sso",
              "is_open_source",
              "is_in_yc"
            ]
          }
        } ]
      }'
  ```
</CodeGroup>

Output:

```json JSON
{
    "success": true,
    "data": {
      "json": {
        "company_mission": "AI-powered web scraping and data extraction",
        "supports_sso": true,
        "is_open_source": true,
        "is_in_yc": true
      },
      "metadata": {
        "title": "Firecrawl",
        "description": "AI-powered web scraping and data extraction",
        "robots": "follow, index",
        "ogTitle": "Firecrawl",
        "ogDescription": "AI-powered web scraping and data extraction",
        "ogUrl": "https://firecrawl.dev/",
        "ogImage": "https://firecrawl.dev/og.png",
        "ogLocaleAlternate": [],
        "ogSiteName": "Firecrawl",
        "sourceURL": "https://firecrawl.dev/"
      },
    }
}
```

## Search

Firecrawl's search API allows you to perform web searches and optionally scrape the search results in one operation.

* Choose specific output formats (markdown, HTML, links, screenshots)
* Choose specific sources (web, news, images)
* Search the web with customizable parameters (location, etc.)

For details, see the [Search Endpoint API Reference](/api-reference/endpoint/search).

<CodeGroup>
  ```python Python
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")

  results = firecrawl.search(
      query="firecrawl",
      limit=3,
  )
  print(results)
  ```

  ```js Node
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  const results = await firecrawl.search('firecrawl', {
    limit: 3,
    scrapeOptions: { formats: ['markdown'] }
  });
  console.log(results);
  ```

  ```bash
  curl -s -X POST "https://api.firecrawl.dev/v2/search" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "query": "firecrawl",
      "limit": 3
    }'
  ```
</CodeGroup>

### Response

SDKs will return the data object directly. cURL will return the complete payload.

```json JSON
{
  "success": true,
  "data": {
    "web": [
      {
        "url": "https://www.firecrawl.dev/",
        "title": "Firecrawl - The Web Data API for AI",
        "description": "The web crawling, scraping, and search API for AI. Built for scale. Firecrawl delivers the entire internet to AI agents and builders.",
        "position": 1
      },
      {
        "url": "https://github.com/mendableai/firecrawl",
        "title": "mendableai/firecrawl: Turn entire websites into LLM-ready ... - GitHub",
        "description": "Firecrawl is an API service that takes a URL, crawls it, and converts it into clean markdown or structured data.",
        "position": 2
      },
      ...
    ],
    "images": [
      {
        "title": "Quickstart | Firecrawl",
        "imageUrl": "https://mintlify.s3.us-west-1.amazonaws.com/firecrawl/logo/logo.png",
        "imageWidth": 5814,
        "imageHeight": 1200,
        "url": "https://docs.firecrawl.dev/",
        "position": 1
      },
      ...
    ],
    "news": [
      {
        "title": "Y Combinator startup Firecrawl is ready to pay $1M to hire three AI agents as employees",
        "url": "https://techcrunch.com/2025/05/17/y-combinator-startup-firecrawl-is-ready-to-pay-1m-to-hire-three-ai-agents-as-employees/",
        "snippet": "It's now placed three new ads on YC's job board for “AI agents only” and has set aside a $1 million budget total to make it happen.",
        "date": "3 months ago",
        "position": 1
      },
      ...
    ]
  }
}
```

### Extracting without schema

You can now extract without a schema by just passing a `prompt` to the endpoint. The llm chooses the structure of the data.

<CodeGroup>
  ```python Python
  from firecrawl import Firecrawl

  app = Firecrawl(api_key="fc-YOUR-API-KEY")

  result = app.scrape(
      'https://firecrawl.dev',
      formats=[{
        "type": "json",
        "prompt": "Extract the company mission from the page."
      }],
      only_main_content=False,
      timeout=120000
  )

  print(result)
  ```

  ```js Node
  import FirecrawlApp from "@mendable/firecrawl-js";

  const app = new FirecrawlApp({
    apiKey: "fc-YOUR_API_KEY"
  });

  const result = await app.scrape("https://docs.firecrawl.dev/", {
    formats: [{
      type: "json",
      prompt: "Extract the company mission from the page."
    }]
  });

  console.log(result);
  ```

  ```bash cURL
  curl -X POST https://api.firecrawl.dev/v2/scrape \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_API_KEY' \
      -d '{
        "url": "https://docs.firecrawl.dev/",
        "formats": [{
          "type": "json",
          "prompt": "Extract the company mission from the page."
        }]
      }'
  ```
</CodeGroup>

Output:

```json JSON
{
    "success": true,
    "data": {
      "json": {
        "company_mission": "AI-powered web scraping and data extraction",
      },
      "metadata": {
        "title": "Firecrawl",
        "description": "AI-powered web scraping and data extraction",
        "robots": "follow, index",
        "ogTitle": "Firecrawl",
        "ogDescription": "AI-powered web scraping and data extraction",
        "ogUrl": "https://firecrawl.dev/",
        "ogImage": "https://firecrawl.dev/og.png",
        "ogLocaleAlternate": [],
        "ogSiteName": "Firecrawl",
        "sourceURL": "https://firecrawl.dev/"
      },
    }
}
```

## Interacting with the page with Actions

Firecrawl allows you to perform various actions on a web page before scraping its content. This is particularly useful for interacting with dynamic content, navigating through pages, or accessing content that requires user interaction.

Here is an example of how to use actions to navigate to google.com, search for Firecrawl, click on the first result, and take a screenshot.

It is important to almost always use the `wait` action before/after executing other actions to give enough time for the page to load.

### Example

<CodeGroup>
  ```python Python
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")

  doc = firecrawl.scrape('https://example.com/login', {
    formats=['markdown'],
    actions=[
      { type: 'write', text: 'john@example.com' },
      { type: 'press', key: 'Tab' },
      { type: 'write', text: 'secret' },
      { type: 'click', selector: 'button[type="submit"]' },
      { type: 'wait', milliseconds: 1500 },
      { type: 'screenshot', fullPage: true },
    ],
  });

  print(doc.markdown, doc.screenshot);
  ```

  ```js Node
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  const doc = await firecrawl.scrape('https://example.com/login', {
    formats: ['markdown'],
    actions: [
      { type: 'write', text: 'john@example.com' },
      { type: 'press', key: 'Tab' },
      { type: 'write', text: 'secret' },
      { type: 'click', selector: 'button[type="submit"]' },
      { type: 'wait', milliseconds: 1500 },
      { type: 'screenshot', fullPage: true },
    ],
  });

  console.log(doc.markdown, doc.screenshot);
  ```

  ```bash cURL
  curl -X POST https://api.firecrawl.dev/v2/scrape \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_API_KEY' \
      -d '{
        "url": "https://example.com/login",
        "formats": ["markdown"],
        "actions": [
          { "type": "write", "text": "john@example.com" },
          { "type": "press", "key": "Tab" },
          { "type": "write", "text": "secret" },
          { "type": "click", "selector": "button[type=\"submit\"]" },
          { "type": "wait", "milliseconds": 1500 },
          { "type": "screenshot", "fullPage": true },
        ],
    }'
  ```
</CodeGroup>

### Output

<CodeGroup>
  ```json JSON
  {
    "success": true,
    "data": {
      "markdown": "Our first Launch Week is over! [See the recap 🚀](blog/firecrawl-launch-week-1-recap)...",
      "actions": {
        "screenshots": [
          "https://alttmdsdujxrfnakrkyi.supabase.co/storage/v1/object/public/media/screenshot-75ef2d87-31e0-4349-a478-fb432a29e241.png"
        ],
        "scrapes": [
          {
            "url": "https://www.firecrawl.dev/",
            "html": "<html><body><h1>Firecrawl</h1></body></html>"
          }
        ]
      },
      "metadata": {
        "title": "Home - Firecrawl",
        "description": "Firecrawl crawls and converts any website into clean markdown.",
        "language": "en",
        "keywords": "Firecrawl,Markdown,Data,Mendable,Langchain",
        "robots": "follow, index",
        "ogTitle": "Firecrawl",
        "ogDescription": "Turn any website into LLM-ready data.",
        "ogUrl": "https://www.firecrawl.dev/",
        "ogImage": "https://www.firecrawl.dev/og.png?123",
        "ogLocaleAlternate": [],
        "ogSiteName": "Firecrawl",
        "sourceURL": "http://google.com",
        "statusCode": 200
      }
    }
  }
  ```
</CodeGroup>

## Open Source vs Cloud

Firecrawl is open source available under the [AGPL-3.0 license](https://github.com/mendableai/firecrawl/blob/main/LICENSE).

To deliver the best possible product, we offer a hosted version of Firecrawl alongside our open-source offering. The cloud solution allows us to continuously innovate and maintain a high-quality, sustainable service for all users.

Firecrawl Cloud is available at [firecrawl.dev](https://firecrawl.dev) and offers a range of features that are not available in the open source version:

<img src="https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/open-source-cloud.png?fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=763a6e92c8605d06294ed7ed45df85d0" alt="Firecrawl Cloud vs Open Source" width="2808" height="856" data-path="images/open-source-cloud.png" srcset="https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/open-source-cloud.png?w=280&fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=2e9112d82aec51ca204ceee026b6bad3 280w, https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/open-source-cloud.png?w=560&fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=9fabc257f1caa297b1b8ec68fb13eddc 560w, https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/open-source-cloud.png?w=840&fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=e766290156ea4226df484ee815f5036f 840w, https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/open-source-cloud.png?w=1100&fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=ed02646081bce28427156ba1d8bf4fa2 1100w, https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/open-source-cloud.png?w=1650&fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=41d72e1c116d48ebc0cfa1a3499b3e9e 1650w, https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/open-source-cloud.png?w=2500&fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=0f6f34e97633cabdc17cbc28d7af2bb9 2500w" data-optimize="true" data-opv="2" />

## Contributing

We love contributions! Please read our [contributing guide](https://github.com/mendableai/firecrawl/blob/main/CONTRIBUTING.md) before submitting a pull request.


# Node

> Firecrawl Node SDK is a wrapper around the Firecrawl API to help you easily turn websites into markdown.

## Installation

To install the Firecrawl Node SDK, you can use npm:

```js Node
# npm install @mendable/firecrawl-js

import Firecrawl from '@mendable/firecrawl-js';

const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });
```

## Usage

1. Get an API key from [firecrawl.dev](https://firecrawl.dev)
2. Set the API key as an environment variable named `FIRECRAWL_API_KEY` or pass it as a parameter to the `FirecrawlApp` class.

Here's an example of how to use the SDK with error handling:

```js Node
import Firecrawl from '@mendable/firecrawl-js';

const firecrawl = new Firecrawl({apiKey: "fc-YOUR_API_KEY"});

// Scrape a website
const scrapeResponse = await firecrawl.scrape('https://firecrawl.dev', {
  formats: ['markdown', 'html'],
});

console.log(scrapeResponse)

// Crawl a website
const crawlResponse = await firecrawl.crawl('https://firecrawl.dev', {
  limit: 100,
  scrapeOptions: {
    formats: ['markdown', 'html'],
  }
});

console.log(crawlResponse)
```

### Scraping a URL

To scrape a single URL with error handling, use the `scrapeUrl` method. It takes the URL as a parameter and returns the scraped data as a dictionary.

```js Node
// Scrape a website:
const scrapeResult = await firecrawl.scrape('firecrawl.dev', { formats: ['markdown', 'html'] });

console.log(scrapeResult)
```

### Crawling a Website

To crawl a website with error handling, use the `crawlUrl` method. It takes the starting URL and optional parameters as arguments. The `params` argument allows you to specify additional options for the crawl job, such as the maximum number of pages to crawl, allowed domains, and the output format. See [Pagination](#pagination) for auto/ manual pagination and limiting.

```js Node
const job = await firecrawl.crawl('https://docs.firecrawl.dev', { limit: 5, pollInterval: 1, timeout: 120 });
console.log(job.status);
```

### Start a Crawl

Start a job without waiting using `startCrawl`. It returns a job `ID` you can use to check status. Use `crawl` when you want a waiter that blocks until completion. See [Pagination](#pagination) for paging behavior and limits.

```js Node
const { id } = await firecrawl.startCrawl('https://docs.firecrawl.dev', { limit: 10 });
console.log(id);
```

### Checking Crawl Status

To check the status of a crawl job with error handling, use the `checkCrawlStatus` method. It takes the `ID` as a parameter and returns the current status of the crawl job.

```js Node
const status = await firecrawl.getCrawlStatus("<crawl-id>");
console.log(status);
```

### Cancelling a Crawl

To cancel an crawl job, use the `cancelCrawl` method. It takes the job ID of the `startCrawl` as a parameter and returns the cancellation status.

```js Node
const ok = await firecrawl.cancelCrawl("<crawl-id>");
console.log("Cancelled:", ok);
```

### Mapping a Website

To map a website with error handling, use the `mapUrl` method. It takes the starting URL as a parameter and returns the mapped data as a dictionary.

```js Node
const res = await firecrawl.map('https://firecrawl.dev', { limit: 10 });
console.log(res.links);
```

{/* ### Extracting Structured Data from Websites

  To extract structured data from websites with error handling, use the `extractUrl` method. It takes the starting URL as a parameter and returns the extracted data as a dictionary.

  <ExtractNodeShort /> */}

### Crawling a Website with WebSockets

To crawl a website with WebSockets, use the `crawlUrlAndWatch` method. It takes the starting URL and optional parameters as arguments. The `params` argument allows you to specify additional options for the crawl job, such as the maximum number of pages to crawl, allowed domains, and the output format.

```js Node
import Firecrawl from '@mendable/firecrawl-js';

const firecrawl = new Firecrawl({ apiKey: 'fc-YOUR-API-KEY' });

// Start a crawl and then watch it
const { id } = await firecrawl.startCrawl('https://mendable.ai', {
  excludePaths: ['blog/*'],
  limit: 5,
});

const watcher = firecrawl.watcher(id, { kind: 'crawl', pollInterval: 2, timeout: 120 });

watcher.on('document', (doc) => {
  console.log('DOC', doc);
});

watcher.on('error', (err) => {
  console.error('ERR', err?.error || err);
});

watcher.on('done', (state) => {
  console.log('DONE', state.status);
});

// Begin watching (WS with HTTP fallback)
await watcher.start();
```

### Pagination

Firecrawl endpoints for crawl and batch return a `next` URL when more data is available. The Node SDK auto-paginates by default and aggregates all documents; in that case `next` will be `null`. You can disable auto-pagination or set limits.

#### Crawl

Use the waiter method `crawl` for the simplest experience, or start a job and page manually.

##### Simple crawl (auto-pagination, default)

* See the default flow in [Crawling a Website](#crawling-a-website).

##### Manual crawl with pagination control (single page)

* Start a job, then fetch one page at a time with `autoPaginate: false`.

```js Node
const crawlStart = await firecrawl.startCrawl('https://docs.firecrawl.dev', { limit: 5 });
const crawlJobId = crawlStart.id;

const crawlSingle = await firecrawl.getCrawlStatus(crawlJobId, { autoPaginate: false });
console.log('crawl single page:', crawlSingle.status, 'docs:', crawlSingle.data.length, 'next:', crawlSingle.next);
```

##### Manual crawl with limits (auto-pagination + early stop)

* Keep auto-pagination on but stop early with `maxPages`, `maxResults`, or `maxWaitTime`.

```js Node
const crawlLimited = await firecrawl.getCrawlStatus(crawlJobId, {
  autoPaginate: true,
  maxPages: 2,
  maxResults: 50,
  maxWaitTime: 15,
});
console.log('crawl limited:', crawlLimited.status, 'docs:', crawlLimited.data.length, 'next:', crawlLimited.next);
```

#### Batch Scrape

Use the waiter method `batchScrape`, or start a job and page manually.

##### Simple batch scrape (auto-pagination, default)

* See the default flow in [Batch Scrape](/features/batch-scrape).

##### Manual batch scrape with pagination control (single page)

* Start a job, then fetch one page at a time with `autoPaginate: false`.

```js Node
const batchStart = await firecrawl.startBatchScrape([
  'https://docs.firecrawl.dev',
  'https://firecrawl.dev',
], { options: { formats: ['markdown'] } });
const batchJobId = batchStart.id;

const batchSingle = await firecrawl.getBatchScrapeStatus(batchJobId, { autoPaginate: false });
console.log('batch single page:', batchSingle.status, 'docs:', batchSingle.data.length, 'next:', batchSingle.next);
```

##### Manual batch scrape with limits (auto-pagination + early stop)

* Keep auto-pagination on but stop early with `maxPages`, `maxResults`, or `maxWaitTime`.

```js Node
const batchLimited = await firecrawl.getBatchScrapeStatus(batchJobId, {
  autoPaginate: true,
  maxPages: 2,
  maxResults: 100,
  maxWaitTime: 20,
});
console.log('batch limited:', batchLimited.status, 'docs:', batchLimited.data.length, 'next:', batchLimited.next);
```

## Error Handling

The SDK handles errors returned by the Firecrawl API and raises appropriate exceptions. If an error occurs during a request, an exception will be raised with a descriptive error message. The examples above demonstrate how to handle these errors using `try/catch` blocks.



# Advanced Scraping Guide

> Learn how to improve your Firecrawl scraping with advanced options.

This guide will walk you through the different endpoints of Firecrawl and how to use them fully with all its parameters.

## Basic scraping with Firecrawl

To scrape a single page and get clean markdown content, you can use the `/scrape` endpoint.

<CodeGroup>
  ```python Python
  # pip install firecrawl-py

  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")

  doc = firecrawl.scrape("https://firecrawl.dev")

  print(doc.markdown)
  ```

  ```JavaScript JavaScript
  // npm install @mendable/firecrawl-js

  import { Firecrawl } from 'firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: 'fc-YOUR-API-KEY' });

  const doc = await firecrawl.scrape('https://firecrawl.dev');

  console.log(doc.markdown);
  ```

  ```bash cURL
  curl -X POST https://api.firecrawl.dev/v2/scrape \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer fc-YOUR-API-KEY' \
      -d '{
        "url": "https://docs.firecrawl.dev"
      }'
  ```
</CodeGroup>

## Scraping PDFs

Firecrawl supports PDFs. Use the `parsers` option (e.g., `parsers: ["pdf"]`) when you want to ensure PDF parsing.

## Scrape options

When using the `/scrape` endpoint, you can customize scraping with the options below.

### Formats (`formats`)

* **Type**: `array`
* **Strings**: `["markdown", "links", "html", "rawHtml", "summary"]`
* **Object formats**:
  * JSON: `{ type: "json", prompt, schema }`
  * Screenshot: `{ type: "screenshot", fullPage?, quality?, viewport? }`
  * Change tracking: `{ type: "changeTracking", modes?, prompt?, schema?, tag? }` (requires `markdown`)
* **Default**: `["markdown"]`

### Full page content vs main content (`onlyMainContent`)

* **Type**: `boolean`
* **Description**: By default the scraper returns only the main content. Set to `false` to return full page content.
* **Default**: `true`

### Include tags (`includeTags`)

* **Type**: `array`
* **Description**: HTML tags/classes/ids to include in the scrape.

### Exclude tags (`excludeTags`)

* **Type**: `array`
* **Description**: HTML tags/classes/ids to exclude from the scrape.

### Wait for page readiness (`waitFor`)

* **Type**: `integer`
* **Description**: Milliseconds to wait before scraping (use sparingly).
* **Default**: `0`

### Freshness and cache (`maxAge`)

* **Type**: `integer` (milliseconds)
* **Description**: If a cached version of the page is newer than `maxAge`, Firecrawl returns it instantly; otherwise it scrapes fresh and updates the cache. Set `0` to always fetch fresh.
* **Default**: `172800000` (2 days)

### Request timeout (`timeout`)

* **Type**: `integer`
* **Description**: Max duration in milliseconds before aborting.
* **Default**: `30000` (30 seconds)

### PDF parsing (`parsers`)

* **Type**: `array`
* **Description**: Control parsing behavior. To parse PDFs, set `parsers: ["pdf"]`.

### Actions (`actions`)

When using the /scrape endpoint, Firecrawl allows you to perform various actions on a web page before scraping its content. This is particularly useful for interacting with dynamic content, navigating through pages, or accessing content that requires user interaction.

* **Type**: `array`
* **Description**: Sequence of browser steps to run before scraping.
* **Supported actions**:
  * `wait` `{ milliseconds }`
  * `click` `{ selector }`
  * `write` `{ selector, text }`
  * `press` `{ key }`
  * `scroll` `{ direction: "up" | "down" }`
  * `scrape` `{ selector }` (scrape a sub-element)
  * `executeJavascript` `{ script }`
  * `pdf` (trigger PDF render in some flows)

<CodeGroup>
  ```python Python
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key='fc-YOUR-API-KEY')

  doc = firecrawl.scrape('https://example.com', {
    actions: [
      { type: 'wait', milliseconds: 1000 },
      { type: 'click', selector: '#accept' },
      { type: 'scroll', direction: 'down' },
      { type: 'write', selector: '#q', text: 'firecrawl' },
      { type: 'press', key: 'Enter' }
    ],
    formats: ['markdown']
  })

  print(doc.markdown)
  ```

  ```js Node
  import { Firecrawl } from 'firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: 'fc-YOUR-API-KEY' });

  const doc = await firecrawl.scrape('https://example.com', {
    actions: [
      { type: 'wait', milliseconds: 1000 },
      { type: 'click', selector: '#accept' },
      { type: 'scroll', direction: 'down' },
      { type: 'write', selector: '#q', text: 'firecrawl' },
      { type: 'press', key: 'Enter' }
    ],
    formats: ['markdown']
  });

  console.log(doc.markdown);
  ```

  ```bash cURL
  curl -X POST https://api.firecrawl.dev/v2/scrape \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer fc-YOUR-API-KEY' \
    -d '{
      "url": "https://example.com",
      "actions": [
        { "type": "wait", "milliseconds": 1000 },
        { "type": "click", "selector": "#accept" },
        { "type": "scroll", "direction": "down" },
        { "type": "write", "selector": "#q", "text": "firecrawl" },
        { "type": "press", "key": "Enter" }
      ],
      "formats": ["markdown"]
    }'
  ```
</CodeGroup>

### Example Usage

```bash cURL
curl -X POST https://api.firecrawl.dev/v2/scrape \
    -H '
    Content-Type: application/json' \
    -H 'Authorization: Bearer fc-YOUR-API-KEY' \
    -d '{
      "url": "https://docs.firecrawl.dev",
      "formats": [
        "markdown",
        "links",
        "html",
        "rawHtml",
        { "type": "screenshot", "fullPage": true, "quality": 80 }
      ],
      "includeTags": ["h1", "p", "a", ".main-content"],
      "excludeTags": ["#ad", "#footer"],
      "onlyMainContent": false,
      "waitFor": 1000,
      "timeout": 15000,
      "parsers": ["pdf"]
    }'
```

In this example, the scraper will:

* Return the full page content as markdown.
* Include the markdown, raw HTML, HTML, links, and a screenshot in the response.
* Include only the HTML tags `<h1>`, `<p>`, `<a>`, and elements with the class `.main-content`, while excluding any elements with the IDs `#ad` and `#footer`.
* Wait for 1000 milliseconds (1 second) before scraping to allow the page to load.
* Set the maximum duration of the scrape request to 15000 milliseconds (15 seconds).
* Parse PDFs explicitly via `parsers: ["pdf"]`.

Here is the API Reference: [Scrape Endpoint Documentation](https://docs.firecrawl.dev/api-reference/endpoint/scrape)

## JSON extraction via formats

Use the JSON format object in `formats` to extract structured data in one pass:

```bash
curl -X POST https://api.firecrawl.dev/v2/scrape \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer fc-YOUR-API-KEY' \
  -d '{
    "url": "https://firecrawl.dev",
    "formats": [{
      "type": "json",
      "prompt": "Extract the features of the product",
      "schema": {"type": "object", "properties": {"features": {"type": "object"}}, "required": ["features"]}
    }]
  }'
```

## Extract endpoint

Use the dedicated extract job API when you want asynchronous extraction with status polling.

<CodeGroup>
  ```js Node
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: 'fc-YOUR-API-KEY' });

  // Start extract job
  const started = await firecrawl.startExtract({
    urls: ['https://docs.firecrawl.dev'],
    prompt: 'Extract title',
    schema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] }
  });

  // Poll status
  const status = await firecrawl.getExtractStatus(started.id);
  console.log(status.status, status.data);
  ```

  ```python Python
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key='fc-YOUR-API-KEY')

  started = firecrawl.start_extract(
      urls=["https://docs.firecrawl.dev"],
      prompt="Extract title",
      schema={"type": "object", "properties": {"title": {"type": "string"}}, "required": ["title"]}
  )
  status = firecrawl.get_extract_status(started.id)
  print(status.get("status"), status.get("data"))
  ```

  ```bash cURL
  curl -X POST https://api.firecrawl.dev/v2/extract \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer fc-YOUR-API-KEY' \
    -d '{
      "urls": ["https://docs.firecrawl.dev"],
      "prompt": "Extract title",
      "schema": {"type": "object", "properties": {"title": {"type": "string"}}, "required": ["title"]}
    }'
  ```
</CodeGroup>

## Crawling multiple pages

To crawl multiple pages, use the `/v2/crawl` endpoint.

```bash cURL
curl -X POST https://api.firecrawl.dev/v2/crawl \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer fc-YOUR-API-KEY' \
    -d '{
      "url": "https://docs.firecrawl.dev"
    }'
```

Returns an id

```json
{ "id": "1234-5678-9101" }
```

### Check Crawl Job

Used to check the status of a crawl job and get its result.

```bash cURL
curl -X GET https://api.firecrawl.dev/v2/crawl/1234-5678-9101 \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer fc-YOUR-API-KEY'
```

#### Pagination/Next URL

If the content is larger than 10MB or if the crawl job is still running, the response may include a `next` parameter, a URL to the next page of results.

### Crawl prompt and params preview

You can provide a natural-language `prompt` to let Firecrawl derive crawl settings. Preview them first:

```bash cURL
curl -X POST https://api.firecrawl.dev/v2/crawl/params-preview \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer fc-YOUR-API-KEY' \
  -d '{
    "url": "https://docs.firecrawl.dev",
    "prompt": "Extract docs and blog"
  }'
```

### Crawler options

When using the `/v2/crawl` endpoint, you can customize the crawling behavior with:

#### includePaths

* **Type**: `array`
* **Description**: Regex patterns to include.
* **Example**: `["^/blog/.*$", "^/docs/.*$"]`

#### excludePaths

* **Type**: `array`
* **Description**: Regex patterns to exclude.
* **Example**: `["^/admin/.*$", "^/private/.*$"]`

#### maxDiscoveryDepth

* **Type**: `integer`
* **Description**: Max discovery depth for finding new URLs.

#### limit

* **Type**: `integer`
* **Description**: Max number of pages to crawl.
* **Default**: `10000`

#### crawlEntireDomain

* **Type**: `boolean`
* **Description**: Explore across siblings/parents to cover the entire domain.
* **Default**: `false`

#### allowExternalLinks

* **Type**: `boolean`
* **Description**: Follow links to external domains.
* **Default**: `false`

#### allowSubdomains

* **Type**: `boolean`
* **Description**: Follow subdomains of the main domain.
* **Default**: `false`

#### delay

* **Type**: `number`
* **Description**: Delay in seconds between scrapes.
* **Default**: `undefined`

#### scrapeOptions

* **Type**: `object`
* **Description**: Options for the scraper (see Formats above).
* **Example**: `{ "formats": ["markdown", "links", {"type": "screenshot", "fullPage": true}], "includeTags": ["h1", "p", "a", ".main-content"], "excludeTags": ["#ad", "#footer"], "onlyMainContent": false, "waitFor": 1000, "timeout": 15000}`
* **Defaults**: `formats: ["markdown"]`, caching enabled by default (maxAge \~ 2 days)

### Example Usage

```bash cURL
curl -X POST https://api.firecrawl.dev/v2/crawl \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer fc-YOUR-API-KEY' \
    -d '{
      "url": "https://docs.firecrawl.dev",
      "includePaths": ["^/blog/.*$", "^/docs/.*$"],
      "excludePaths": ["^/admin/.*$", "^/private/.*$"],
      "maxDiscoveryDepth": 2,
      "limit": 1000
    }'
```

## Mapping website links

The `/v2/map` endpoint identifies URLs related to a given website.

### Usage

```bash cURL
curl -X POST https://api.firecrawl.dev/v2/map \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer fc-YOUR-API-KEY' \
    -d '{
      "url": "https://docs.firecrawl.dev"
    }'
```

### Map Options

#### search

* **Type**: `string`
* **Description**: Filter links containing text.

#### limit

* **Type**: `integer`
* **Description**: Maximum number of links to return.
* **Default**: `100`

#### sitemap

* **Type**: `"only" | "include" | "skip"`
* **Description**: Control sitemap usage during mapping.
* **Default**: `"include"`

#### includeSubdomains

* **Type**: `boolean`
* **Description**: Include subdomains of the website.
* **Default**: `true`

Here is the API Reference for it: [Map Endpoint Documentation](https://docs.firecrawl.dev/api-reference/endpoint/map)

Thanks for reading!

# Crawl

> Firecrawl can recursively search through a urls subdomains, and gather the content

Firecrawl efficiently crawls websites to extract comprehensive data while bypassing blockers. The process:

1. **URL Analysis:** Scans sitemap and crawls website to identify links
2. **Traversal:** Recursively follows links to find all subpages
3. **Scraping:** Extracts content from each page, handling JS and rate limits
4. **Output:** Converts data to clean markdown or structured format

This ensures thorough data collection from any starting URL.

## Crawling

### /crawl endpoint

Used to crawl a URL and all accessible subpages. This submits a crawl job and returns a job ID to check the status of the crawl.

<Warning>By default - Crawl will ignore sublinks of a page if they aren't children of the url you provide. So, the website.com/other-parent/blog-1 wouldn't be returned if you crawled website.com/blogs/. If you want website.com/other-parent/blog-1, use the `crawlEntireDomain` parameter. To crawl subdomains like blog.website.com when crawling website.com, use the `allowSubdomains` parameter.</Warning>

### Installation

<CodeGroup>
  ```python Python
  # pip install firecrawl-py

  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")
  ```

  ```js Node
  # npm install @mendable/firecrawl-js

  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });
  ```
</CodeGroup>

### Usage

<CodeGroup>
  ```python Python
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")

  docs = firecrawl.crawl(url="https://docs.firecrawl.dev", limit=10)
  print(docs)
  ```

  ```js Node
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  const docs = await firecrawl.crawl('https://docs.firecrawl.dev', { limit: 10 });
  console.log(docs);
  ```

  ```bash cURL
  curl -s -X POST "https://api.firecrawl.dev/v2/crawl" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "url": "https://docs.firecrawl.dev",
      "limit": 10
    }'
  ```
</CodeGroup>

### Scrape options in crawl

All options from the Scrape endpoint are available in Crawl via `scrapeOptions` (JS) / `scrape_options` (Python). These apply to every page the crawler scrapes: formats, proxy, caching, actions, location, tags, etc. See the full list in the [Scrape API Reference](https://docs.firecrawl.dev/api-reference/endpoint/scrape).

<CodeGroup>
  ```js Node
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: 'fc-YOUR_API_KEY' });

  // Crawl with scrape options
  const crawlResponse = await firecrawl.crawl('https://example.com', {
    limit: 100,
    scrapeOptions: {
      formats: [
        'markdown',
        { type: 'json', schema: { type: 'object', properties: { title: { type: 'string' } } } }
      ],
      proxy: 'auto',
      maxAge: 600000,
      onlyMainContent: true
    }
  });
  ```

  ```python Python
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key='fc-YOUR_API_KEY')

  # Crawl with scrape options
  response = firecrawl.crawl('https://example.com',
      limit=100,
      scrape_options={
          'formats': [
              'markdown',
              { 'type': 'json', 'schema': { 'type': 'object', 'properties': { 'title': { 'type': 'string' } } } }
          ],
          'proxy': 'auto',
          'maxAge': 600000,
          'onlyMainContent': True
      }
  )
  ```
</CodeGroup>

### API Response

If you're using cURL or the starter method, this will return an `ID` to check the status of the crawl.

<Note>If you're using the SDK, see methods below for waiter vs starter behavior.</Note>

```json
{
  "success": true,
  "id": "123-456-789",
  "url": "https://api.firecrawl.dev/v2/crawl/123-456-789"
}
```

### Check Crawl Job

Used to check the status of a crawl job and get its result.

<Note>This endpoint only works for crawls that are in progress or crawls that have completed recently. </Note>

<CodeGroup>
  ```python Python
  status = firecrawl.get_crawl_status("<crawl-id>")
  print(status)
  ```

  ```js Node
  const status = await firecrawl.getCrawlStatus("<crawl-id>");
  console.log(status);
  ```

  ```bash cURL
  # After starting a crawl, poll status by jobId
  curl -s -X GET "https://api.firecrawl.dev/v2/crawl/<jobId>" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY"
  ```
</CodeGroup>

#### Response Handling

The response varies based on the crawl's status.

For not completed or large responses exceeding 10MB, a `next` URL parameter is provided. You must request this URL to retrieve the next 10MB of data. If the `next` parameter is absent, it indicates the end of the crawl data.

The skip parameter sets the maximum number of results returned for each chunk of results returned.

<Info>
  The skip and next parameter are only relavent when hitting the api directly. If you're using the SDK, we handle this for you and will return all the results at once.
</Info>

<CodeGroup>
  ```json Scraping
  {
    "status": "scraping",
    "total": 36,
    "completed": 10,
    "creditsUsed": 10,
    "expiresAt": "2024-00-00T00:00:00.000Z",
    "next": "https://api.firecrawl.dev/v2/crawl/123-456-789?skip=10",
    "data": [
      {
        "markdown": "[Firecrawl Docs home page![light logo](https://mintlify.s3-us-west-1.amazonaws.com/firecrawl/logo/light.svg)!...",
        "html": "<!DOCTYPE html><html lang=\"en\" class=\"js-focus-visible lg:[--scroll-mt:9.5rem]\" data-js-focus-visible=\"\">...",
        "metadata": {
          "title": "Build a 'Chat with website' using Groq Llama 3 | Firecrawl",
          "language": "en",
          "sourceURL": "https://docs.firecrawl.dev/learn/rag-llama3",
          "description": "Learn how to use Firecrawl, Groq Llama 3, and Langchain to build a 'Chat with your website' bot.",
          "ogLocaleAlternate": [],
          "statusCode": 200
        }
      },
      ...
    ]
  }
  ```

  ```json Completed
  {
    "status": "completed",
    "total": 36,
    "completed": 36,
    "creditsUsed": 36,
    "expiresAt": "2024-00-00T00:00:00.000Z",
    "next": "https://api.firecrawl.dev/v2/crawl/123-456-789?skip=26",
    "data": [
      {
        "markdown": "[Firecrawl Docs home page![light logo](https://mintlify.s3-us-west-1.amazonaws.com/firecrawl/logo/light.svg)!...",
        "html": "<!DOCTYPE html><html lang=\"en\" class=\"js-focus-visible lg:[--scroll-mt:9.5rem]\" data-js-focus-visible=\"\">...",
        "metadata": {
          "title": "Build a 'Chat with website' using Groq Llama 3 | Firecrawl",
          "language": "en",
          "sourceURL": "https://docs.firecrawl.dev/learn/rag-llama3",
          "description": "Learn how to use Firecrawl, Groq Llama 3, and Langchain to build a 'Chat with your website' bot.",
          "ogLocaleAlternate": [],
          "statusCode": 200
        }
      },
      ...
    ]
  }
  ```
</CodeGroup>

### SDK methods

There are two ways to use the SDK:

1. **Crawl then wait** (`crawl`):
   * Waits for the crawl to complete and returns the full response
   * Handles pagination automatically
   * Recommended for most use cases

<CodeGroup>
  ```python Python
  from firecrawl import Firecrawl, ScrapeOptions

  firecrawl = Firecrawl(api_key="fc-YOUR_API_KEY")

  # Crawl a website:
  crawl_status = firecrawl.crawl(
    'https://firecrawl.dev', 
    limit=100, 
    scrape_options=ScrapeOptions(formats=['markdown', 'html']),
    poll_interval=30
  )
  print(crawl_status)
  ```

  ```js Node
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({apiKey: "fc-YOUR_API_KEY"});

  const crawlResponse = await firecrawl.crawl('https://firecrawl.dev', {
    limit: 100,
    scrapeOptions: {
      formats: ['markdown', 'html'],
    }
  })

  console.log(crawlResponse)
  ```
</CodeGroup>

The response includes the crawl status and all scraped data:

<CodeGroup>
  ```bash Python
  success=True
  status='completed'
  completed=100
  total=100
  creditsUsed=100
  expiresAt=datetime.datetime(2025, 4, 23, 19, 21, 17, tzinfo=TzInfo(UTC))
  next=None
  data=[
    Document(
      markdown='[Day 7 - Launch Week III.Integrations DayApril 14th to 20th](...',
      metadata={
        'title': '15 Python Web Scraping Projects: From Beginner to Advanced',
        ...
        'scrapeId': '97dcf796-c09b-43c9-b4f7-868a7a5af722',
        'sourceURL': 'https://www.firecrawl.dev/blog/python-web-scraping-projects',
        'url': 'https://www.firecrawl.dev/blog/python-web-scraping-projects',
        'statusCode': 200
      }
    ),
    ...
  ]
  ```

  ```json Node
  {
    success: true,
    status: "completed",
    completed: 100,
    total: 100,
    creditsUsed: 100,
    expiresAt: "2025-04-23T19:28:45.000Z",
    data: [
      {
        markdown: "[Day 7 - Launch Week III.Integrations DayApril ...",
        html: `<!DOCTYPE html><html lang="en" class="light" style="color...`,
        metadata: [Object],
      },
      ...
    ]
  }
  ```
</CodeGroup>

2. **Start then check status** (`startCrawl`/`start_crawl`):
   * Returns immediately with a crawl ID
   * Allows manual status checking
   * Useful for long-running crawls or custom polling logic

<CodeGroup>
  ```python Python
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")

  job = firecrawl.start_crawl(url="https://docs.firecrawl.dev", limit=10)
  print(job)

  # Check the status of the crawl
  status = firecrawl.get_crawl_status(job.id)
  print(status)
  ```

  ```js Node
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  const { id } = await firecrawl.startCrawl('https://docs.firecrawl.dev', { limit: 10 });
  console.log(id);

  // Check the status of the crawl
  const status = await firecrawl.getCrawlStatus(id);
  console.log(status);

  ```

  ```bash cURL
  curl -s -X POST "https://api.firecrawl.dev/v2/crawl" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "url": "https://docs.firecrawl.dev",
      "limit": 10
    }'
  ```
</CodeGroup>

## Crawl WebSocket

Firecrawl's WebSocket-based method, `Crawl URL and Watch`, enables real-time data extraction and monitoring. Start a crawl with a URL and customize it with options like page limits, allowed domains, and output formats, ideal for immediate data processing needs.

<CodeGroup>
  ```python Python
  import asyncio
  from firecrawl import AsyncFirecrawl

  async def main():
      firecrawl = AsyncFirecrawl(api_key="fc-YOUR-API-KEY")

      # Start a crawl first
      started = await firecrawl.start_crawl("https://firecrawl.dev", limit=5)

      # Watch updates (snapshots) until terminal status
      async for snapshot in firecrawl.watcher(started.id, kind="crawl", poll_interval=2, timeout=120):
          if snapshot.status == "completed":
              print("DONE", snapshot.status)
              for doc in snapshot.data:
                  print("DOC", doc.metadata.sourceURL if doc.metadata else None)
          elif snapshot.status == "failed":
              print("ERR", snapshot.status)
          else:
              print("STATUS", snapshot.status, snapshot.completed, "/", snapshot.total)

  asyncio.run(main())
  ```

  ```js Node
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: 'fc-YOUR-API-KEY' });

  // Start a crawl and then watch it
  const { id } = await firecrawl.startCrawl('https://mendable.ai', {
    excludePaths: ['blog/*'],
    limit: 5,
  });

  const watcher = firecrawl.watcher(id, { kind: 'crawl', pollInterval: 2, timeout: 120 });

  watcher.on('document', (doc) => {
    console.log('DOC', doc);
  });

  watcher.on('error', (err) => {
    console.error('ERR', err?.error || err);
  });

  watcher.on('done', (state) => {
    console.log('DONE', state.status);
  });

  // Begin watching (WS with HTTP fallback)
  await watcher.start();
  ```
</CodeGroup>

## Crawl Webhook

You can configure webhooks to receive real-time notifications as your crawl progresses. This allows you to process pages as they're scraped instead of waiting for the entire crawl to complete.

```bash cURL
curl -X POST https://api.firecrawl.dev/v2/crawl \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer YOUR_API_KEY' \
    -d '{
      "url": "https://docs.firecrawl.dev",
      "limit": 100,
      "webhook": {
        "url": "https://your-domain.com/webhook",
        "metadata": {
          "any_key": "any_value"
        },
        "events": ["started", "page", "completed"]
      }
    }'
```

For comprehensive webhook documentation including event types, payload structure, and implementation examples, see the [Webhooks documentation](/features/webhooks).

### Quick Reference

**Event Types:**

* `crawl.started` - When the crawl begins
* `crawl.page` - For each page successfully scraped
* `crawl.completed` - When the crawl finishes
* `crawl.failed` - If the crawl encounters an error

**Basic Payload:**

```json
{
  "success": true,
  "type": "crawl.page",
  "id": "crawl-job-id",
  "data": [...], // Page data for 'page' events
  "metadata": {}, // Your custom metadata
  "error": null
}
```

<Note>
  For detailed webhook configuration, security best practices, and troubleshooting, visit the [Webhooks documentation](/features/webhooks).
</Note>
