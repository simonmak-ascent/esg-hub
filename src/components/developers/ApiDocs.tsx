import { getTranslations } from "next-intl/server";
import { CodeBlock, TabbedCodeBlock, SidebarNav, Callout } from "./CodeBlock";

const BASE = "https://esg-hub.ascent.partners";

function EndpointSection({
  method,
  path,
  description,
  params,
  paramsLabel,
  nameLabel,
  typeLabel,
  requiredLabel,
  optionalLabel,
  descriptionLabel,
  requestExampleLabel,
  responseLabel,
  example,
  response,
  id,
}: {
  method: string;
  path: string;
  description: string;
  params?: { name: string; type: string; required: boolean; description: string }[];
  paramsLabel: string;
  nameLabel: string;
  typeLabel: string;
  requiredLabel: string;
  optionalLabel: string;
  descriptionLabel: string;
  requestExampleLabel: string;
  responseLabel: string;
  example: string;
  response: string;
  id?: string;
}) {
  const methodColors: Record<string, { bg: string; color: string }> = {
    GET: { bg: "var(--apf-color-status-success-bg)", color: "var(--apf-color-status-success)" },
    POST: { bg: "var(--color-primary-muted)", color: "var(--apf-color-brand-forest)" },
    PUT: { bg: "var(--apf-color-status-warning-bg)", color: "var(--apf-color-status-warning)" },
    DELETE: { bg: "var(--apf-color-status-danger-bg)", color: "var(--apf-color-status-danger)" },
  };
  const colors = methodColors[method] || methodColors.GET;

  return (
    <div id={id} style={{ marginBottom: "2.5rem", paddingBottom: "2rem", borderBottom: "1px solid var(--color-border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <span
          style={{
            padding: "0.25rem 0.6rem",
            fontSize: "0.75rem",
            fontWeight: 700,
            fontFamily: "monospace",
            borderRadius: 0,
            backgroundColor: colors.bg,
            color: colors.color,
          }}
        >
          {method}
        </span>
        <code style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--color-text)" }}>
          {path}
        </code>
      </div>
      <p style={{ fontSize: "0.92rem", color: "var(--color-text-secondary)", lineHeight: 1.55, marginBottom: "1rem" }}>
        {description}
      </p>

      {params && params.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <h4 style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {paramsLabel}
          </h4>
          <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--color-border)", textAlign: "left" }}>
                <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>{nameLabel}</th>
                <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>{typeLabel}</th>
                <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>{requiredLabel}</th>
                <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>{descriptionLabel}</th>
              </tr>
            </thead>
            <tbody>
              {params.map((p) => (
                <tr key={p.name} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "0.5rem 0.75rem", fontFamily: "var(--font-mono)", color: "var(--color-link)" }}>{p.name}</td>
                  <td style={{ padding: "0.5rem 0.75rem", fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>{p.type}</td>
                  <td style={{ padding: "0.5rem 0.75rem" }}>
                    {p.required ? (
                      <span style={{ color: "var(--apf-color-status-danger)", fontWeight: 500 }}>{requiredLabel}</span>
                    ) : (
                      <span style={{ color: "var(--color-text-muted)" }}>{optionalLabel}</span>
                    )}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", color: "var(--color-text-secondary)" }}>{p.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginBottom: "1rem" }}>
        <h4 style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {requestExampleLabel}
        </h4>
        <CodeBlock language="bash" title="curl">{example}</CodeBlock>
      </div>

      <div>
        <h4 style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {responseLabel}
        </h4>
        <CodeBlock language="json">{response}</CodeBlock>
      </div>
    </div>
  );
}

export default async function ApiDocs() {
  const t = await getTranslations("ApiDocs");

  const sidebarItems = [
    { id: "getting-started", label: t("gettingStarted") },
    { id: "authentication", label: t("authentication") },
    { id: "endpoints", label: t("endpoints"), href: "#endpoints" },
    { id: "errors", label: t("errorHandling"), href: "#errors" },
    { id: "limits", label: t("rateLimits"), href: "#limits" },
  ];

  const endpointProps = {
    paramsLabel: t("parameters"),
    nameLabel: t("name"),
    typeLabel: t("type"),
    requiredLabel: t("required"),
    optionalLabel: t("optional"),
    descriptionLabel: t("description"),
    requestExampleLabel: t("requestExample"),
    responseLabel: t("response"),
  };

  return (
    <div className="docs-container">
      <SidebarNav items={sidebarItems} activeId="endpoints" />

      <div className="docs-main">
        <article>
          <h1>REST API</h1>
          <p style={{ fontSize: "1.05rem", color: "var(--color-text-secondary)", marginBottom: "2rem", lineHeight: 1.65 }}>
            {t("gettingStartedDesc")}
          </p>

          {/* Getting Started */}
          <section id="getting-started" style={{ marginBottom: "3rem" }}>
            <h2>{t("gettingStarted")}</h2>
            <p style={{ fontSize: "0.95rem", color: "var(--color-text-secondary)", lineHeight: 1.65, marginBottom: "1.5rem" }}>
              {t("authDesc")}
            </p>

            <Callout type="info" title={t("baseUrl")}>
              All API requests should be made to: <code style={{ fontFamily: "var(--font-mono)", color: "var(--color-link)" }}>https://esg-hub.ascent.partners/api/v1</code>
            </Callout>

            <h3 style={{ fontSize: "1.1rem", marginTop: "1.5rem", marginBottom: "0.75rem" }}>{t("quickStart")}</h3>
            <ol style={{ fontSize: "0.92rem", color: "var(--color-text-secondary)", lineHeight: 1.8, paddingLeft: "1.25rem" }}>
              <li style={{ marginBottom: "0.5rem" }}>Choose an endpoint below (e.g., <code>/api/v1/pages</code> for articles)</li>
              <li style={{ marginBottom: "0.5rem" }}>Make a request using cURL, JavaScript, or Python</li>
              <li style={{ marginBottom: "0.5rem" }}>Parse the JSON response for the data you need</li>
            </ol>

            <h3 style={{ fontSize: "1.1rem", marginTop: "1.5rem", marginBottom: "0.75rem" }}>{t("codeExamples")}</h3>
            <TabbedCodeBlock
              tabs={[
                {
                  label: "cURL",
                  language: "bash",
                  code: `curl -s "${BASE}/api/v1/pages?limit=3" | jq .`,
                },
                {
                  label: "JavaScript",
                  language: "javascript",
                  code: `const response = await fetch('${BASE}/api/v1/pages?limit=3');
const data = await response.json();
console.log(data.data.map(p => p.title));`,
                },
                {
                  label: "Python",
                  language: "python",
                  code: `import requests

response = requests.get('${BASE}/api/v1/pages', params={'limit': 3})
data = response.json()
for page in data['data']:
    print(page['title'])`,
                },
              ]}
            />
          </section>

          {/* Authentication */}
          <section id="authentication" style={{ marginBottom: "3rem" }}>
            <h2>{t("authentication")}</h2>
            <Callout type="success" title={t("noAuth")}>
              {t("authDesc")}
            </Callout>
          </section>

          {/* Endpoints */}
          <section id="endpoints">
            <h2>{t("endpoints")}</h2>

            <EndpointSection
              id="meta"
              method="GET"
              path="/api/v1/meta"
              description="Get metadata about the ESG Hub knowledge base, including article counts, section statistics, and database timestamps."
              example={`curl -s "${BASE}/api/v1/meta"`}
              response={`{
  "total_pages": 351,
  "total_resources": 244,
  "sections": [
    { "name": "environmental", "count": 23 },
    { "name": "governance", "count": 65 }
  ],
  "updated_at": "2026-02-24T12:00:00Z"
}`}
              {...endpointProps}
            />

            <EndpointSection
              id="list-pages"
              method="GET"
              path="/api/v1/pages"
              description="List all ESG articles with optional filtering. Supports filtering by section, pillar, and full-text search."
              params={[
                { name: "section", type: "string", required: false, description: "Filter by section (e.g., 'environmental', 'governance')" },
                { name: "pillar", type: "string", required: false, description: "Filter by pillar: 'Environmental', 'Social', or 'Governance'" },
                { name: "q", type: "string", required: false, description: "Full-text search in title and description" },
                { name: "limit", type: "number", required: false, description: "Results per page (default: 20, max: 100)" },
                { name: "offset", type: "number", required: false, description: "Pagination offset" },
              ]}
              example={`# List all pages
curl -s "${BASE}/api/v1/pages?limit=5"

# Filter by section
curl -s "${BASE}/api/v1/pages?section=environmental&limit=10"

# Search for climate
curl -s "${BASE}/api/v1/pages?q=climate&limit=5"`}
              response={`{
  "data": [
    {
      "id": "page:abc123",
      "title": "Climate Change",
      "description": "Understanding climate risks...",
      "section": "environmental",
      "pillar": "Environmental",
      "permalink": "/environmental/climate-change/"
    }
  ],
  "pagination": {
    "total": 351,
    "limit": 5,
    "offset": 0,
    "has_more": true
  }
}`}
              {...endpointProps}
            />

            <EndpointSection
              id="get-page"
              method="GET"
              path="/api/v1/pages/:id"
              description="Get a single page by its ID. Returns full content including markdown and metadata."
              example={`curl -s "${BASE}/api/v1/pages/page:abc123"`}
              response={`{
  "id": "page:abc123",
  "title": "Climate Change",
  "content": "# Climate Change\\n\\nClimate change refers to...",
  "keywords": "climate, carbon, emissions",
  "created_at": "2024-01-15T10:30:00Z"
}`}
              {...endpointProps}
            />

            <EndpointSection
              id="resources"
              method="GET"
              path="/api/v1/resources"
              description="List curated external ESG resources. These are links to external articles, reports, and tools."
              params={[
                { name: "type", type: "string", required: false, description: "Filter by type: 'article', 'report', 'tool', 'dataset'" },
                { name: "q", type: "string", required: false, description: "Search in title and description" },
                { name: "limit", type: "number", required: false, description: "Results per page (default: 20)" },
              ]}
              example={`# List all resources
curl -s "${BASE}/api/v1/resources?limit=5"

# Filter by type
curl -s "${BASE}/api/v1/resources?type=report&limit=10"`}
              response={`{
  "data": [
    {
      "id": "resource:xyz789",
      "title": "TCFD Recommendations",
      "url": "https://assets.bbhub.io/...",
      "type": "report",
      "source": "TCFD"
    }
  ],
  "pagination": { "total": 244, "limit": 5, "offset": 0 }
}`}
              {...endpointProps}
            />

            <EndpointSection
              id="search"
              method="GET"
              path="/api/v1/search"
              description="Full-text keyword search across all pages and resources. Use this for simple search queries."
              params={[
                { name: "q", type: "string", required: true, description: "Search query (required)" },
                { name: "limit", type: "number", required: false, description: "Results to return (default: 10)" },
                { name: "source", type: "string", required: false, description: "Filter: 'all', 'pages', or 'resources'" },
              ]}
              example={`curl -s "${BASE}/api/v1/search?q=carbon+emissions&limit=5"`}
              response={`{
  "query": "carbon emissions",
  "mode": "keyword",
  "data": [
    { "title": "Carbon Emissions", "permalink": "/environmental/carbon-emissions/", "score": 0.95 }
  ],
  "total": 12
}`}
              {...endpointProps}
            />

            <EndpointSection
              id="semantic-search"
              method="POST"
              path="/api/v1/search"
              description="Semantic vector search using pre-computed embeddings. Send a 384-dimensional embedding vector to find conceptually related content."
              params={[
                { name: "embedding", type: "number[384]", required: true, description: "384-dimensional embedding vector" },
                { name: "k", type: "number", required: false, description: "Number of results (default: 10, max: 50)" },
                { name: "source", type: "string", required: false, description: "Filter: 'all', 'pages', or 'resources'" },
              ]}
              example={`curl -X POST "${BASE}/api/v1/search" \\
  -H "Content-Type: application/json" \\
  -d '{"embedding": [0.012, -0.034, 0.056, ...], "k": 5}'`}
              response={`{
  "query": "[vector]",
  "mode": "semantic",
  "data": [
    {
      "title": "Climate Risk Assessment",
      "permalink": "/environmental/climate-risk/",
      "similarity": 0.748
    }
  ],
  "total": 5
}`}
              {...endpointProps}
            />
          </section>

          {/* Error Handling */}
          <section id="errors" style={{ marginTop: "2rem" }}>
            <h2>{t("errorHandling")}</h2>
            <p style={{ fontSize: "0.92rem", color: "var(--color-text-secondary)", lineHeight: 1.65, marginBottom: "1rem" }}>
              {t("errorHandlingDesc")}
            </p>
            <CodeBlock language="json" title="Error Response">{`{
  "error": "Missing required parameter: q"
}`}</CodeBlock>
            <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse", marginTop: "1rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--color-border)" }}>
                  <th style={{ padding: "0.5rem", textAlign: "left", fontWeight: 600 }}>{t("status")}</th>
                  <th style={{ padding: "0.5rem", textAlign: "left", fontWeight: 600 }}>{t("meaning")}</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "0.5rem", fontFamily: "var(--font-mono)", color: "var(--apf-color-status-danger)" }}>400</td>
                  <td style={{ padding: "0.5rem", color: "var(--color-text-secondary)" }}>{t("badRequest")}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "0.5rem", fontFamily: "var(--font-mono)", color: "var(--apf-color-status-danger)" }}>404</td>
                  <td style={{ padding: "0.5rem", color: "var(--color-text-secondary)" }}>{t("notFound")}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "0.5rem", fontFamily: "var(--font-mono)", color: "var(--apf-color-status-danger)" }}>500</td>
                  <td style={{ padding: "0.5rem", color: "var(--color-text-secondary)" }}>{t("serverError")}</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Rate Limits */}
          <section id="limits" style={{ marginTop: "2rem" }}>
            <h2>{t("rateLimits")}</h2>
            <Callout type="info" title={t("noRateLimits")}>
              {t("rateLimitsDesc")}
            </Callout>
          </section>
        </article>
      </div>
    </div>
  );
}
