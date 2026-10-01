/**
 * Add remaining ESG Hub content (European, Supply Chain, US, Learning, Ratings)
 * Run: node scripts/add-more-content.mjs
 */

import { getNamespace } from "./lib/db-env.mjs";
const SURREAL_URL = process.env.SURREAL_URL || "";
const SURREAL_USERNAME = process.env.SURREAL_USERNAME || "root";
const SURREAL_PASSWORD = process.env.SURREAL_PASSWORD || "";
const SURREAL_NAMESPACE = getNamespace();
const SURREAL_DATABASE = process.env.SURREAL_DATABASE || "main";

async function querySurreal(sql) {
  const res = await fetch(`${SURREAL_URL}/sql`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      "Accept": "application/json",
      "surreal-ns": SURREAL_NAMESPACE,
      "surreal-db": SURREAL_DATABASE,
      "Authorization": "Basic " + Buffer.from(`${SURREAL_USERNAME}:${SURREAL_PASSWORD}`).toString("base64"),
    },
    body: sql,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SurrealDB error ${res.status}: ${text}`);
  }

  return res.json();
}

function escapeSurrealString(str) {
  if (!str) return "";
  return str
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

const articles = [
  // ============ EUROPEAN REGULATIONS (8 articles) ============
  {
    slug: "csrd-corporate-sustainability",
    title: "CSRD: Corporate Sustainability Reporting Directive",
    description: "Understanding the EU's Corporate Sustainability Reporting Directive and its requirements for ESG disclosure.",
    keywords: "CSRD,EU,sustainability reporting,disclosure,ESRS",
    pillar: "Governance",
    section: "standards",
    permalink: "/standards/csrd-corporate-sustainability/",
    content: `## Overview

The Corporate Sustainability Reporting Directive (CSRD) is a landmark EU regulation that significantly expands ESG disclosure requirements for companies. It replaces the Non-Financial Reporting Directive (NFRD) and introduces more detailed, standardized, and auditable sustainability reporting.

## Key Requirements

### Scope

The CSRD applies to:

- **Large companies**: Meeting 2 of 3 criteria (250+ employees, €50M revenue, €25M assets)
- **Listed SMEs**: Except micro-enterprises (with opt-out until 2028)
- **Non-EU companies**: With €150M+ EU revenue (from 2028)

### Timeline

- **2024**: Apply to companies already under NFRD
- **2025**: Apply to other large companies
- **2026**: Listed SMEs begin
- **2028**: Non-EU companies with EU subsidiaries

## ESRS Standards

### What Are ESRS?

European Sustainability Reporting Standards (ESRS) provide detailed disclosure requirements:

- **Cross-cutting**: Governance, strategy, impacts, risks/opportunities
- **Sector-agnostic**: Apply to all companies
- **Sector-specific**: Additional standards by industry (future)

### Disclosure Areas

| Category | Topics |
|----------|--------|
| Environmental | Climate change, pollution, water, biodiversity, circular economy |
| Social | Workforce, workers in value chain, communities, consumers |
| Governance | Business conduct, anti-corruption |

## Double Materiality

### Concept

Companies must report on:

1. **Financial materiality**: ESG issues affecting company performance
2. **Impact materiality**: Company's impacts on people and environment

### Assessment Process

- Identify stakeholders
- Assess actual/potential impacts
- Evaluate financial risks and opportunities
- Determine material topics

## Practical Guidance

### Steps to Prepare

1. **Gap analysis**: Compare current reporting to ESRS
2. **Data collection**: Establish systems for required metrics
3. **Governance**: Assign board and management responsibility
4. **Assurance**: Plan for limited reasonable assurance

### Required Disclosures

- **Strategy**: How sustainability issues affect business model
- **Targets**: Time-bound, science-based where applicable
- **Metrics**: Quantitative data using ESRS standards
- **Transition plans**: Climate transition plans for large companies

## Key Takeaways

- CSRD significantly expands ESG reporting scope
- Double materiality is central concept
- ESRS provides detailed disclosure standards
- Assurance requirements increasing
- Non-EU companies also affected
- Preparation should begin now
`
  },
  {
    slug: "eu-taxonomy-sustainable",
    title: "EU Taxonomy for Sustainable Activities",
    description: "Understanding the EU Taxonomy classification system for determining if economic activities are environmentally sustainable.",
    keywords: "EU Taxonomy,sustainable finance,green,environmental taxonomy",
    pillar: "Governance",
    section: "standards",
    permalink: "/standards/eu-taxonomy-sustainable/",
    content: `## Overview

The EU Taxonomy is a classification system that defines what economic activities are considered environmentally sustainable. It provides clear criteria for determining whether an investment is "green" and helps channel capital toward sustainable activities.

## Taxonomy Objectives

The EU Taxonomy covers six environmental objectives:

1. **Climate change mitigation**: Reducing greenhouse gas emissions
2. **Climate change adaptation**: Building resilience to climate impacts
3. **Sustainable use of water**: Protecting water resources
4. **Transition to circular economy**: Reducing waste
5. **Pollution prevention**: Eliminating harmful substances
6. **Protection of biodiversity**: Healthy ecosystems

## Technical Screening Criteria

### Substantial Contribution

An activity must substantially contribute to at least one objective without significantly harming others:

#### Climate Change Mitigation

- Activity must lead to GHG reductions
- Must not exceed sector benchmarks
- Examples: Renewable energy, energy efficiency, clean transport

#### Climate Change Adaptation

- Activity must reduce climate risks
- Must be vulnerability-assessed
- Examples: Flood defenses, drought-resistant crops

### Do No Significant Harm (DNSH)

Activities must not significantly harm other objectives:

- **Mitigation**: No increased emissions
- **Adaptation**: No increased vulnerability
- **Water**: No water body degradation
- **Circularity**: No waste increase
- **Pollution**: No harmful emissions
- **Biodiversity**: No habitat degradation

### Minimum Safeguards

Companies must meet:

- UN Guiding Principles on Business and Human Rights
- ILO Core Conventions
- OECD Guidelines for Multinational Enterprises

## Eligible vs. Aligned Activities

### Eligible Activities

Activities that could potentially contribute to objectives, but haven't been assessed against criteria.

### Aligned Activities

Activities that meet all technical screening criteria and minimum safeguards.

## Disclosure Requirements

### For Companies

- **Turnover**: % from Taxonomy-aligned activities
- **CapEx**: % of Taxonomy-aligned investments
- **OpEx**: % of Taxonomy-aligned operating costs

### For Financial Institutions

- **Green asset ratio**: % of Taxonomy-aligned assets
- **Investment exposure**: Analysis of financed activities

## Practical Guidance

### For Companies

1. **Map activities**: Identify which are potentially eligible
2. **Assess eligibility**: Compare against technical criteria
3. **Gather evidence**: Documentation for compliance
4. **Disclose**: Report under CSRD/SFDR

### For Investors

1. **Portfolio assessment**: Map investee activities
2. **Engage**: Encourage alignment
3. **Disclose**: Green investment ratios

## Key Takeaways

- EU Taxonomy provides clear criteria for "green" activities
- Covers six environmental objectives
- Alignment requires substantial contribution + DNSH
- Minimum social safeguards required
- Disclosure mandatory under CSRD/SFDR
- Drives capital toward sustainable activities
`
  },
  {
    slug: "sfdr-sustainable-finance",
    title: "SFDR: Sustainable Finance Disclosure Regulation",
    description: "Understanding the EU's Sustainable Finance Disclosure Regulation and its requirements for financial market participants.",
    keywords: "SFDR,sustainable finance,disclosure,ESG,financial products",
    pillar: "Governance",
    section: "standards",
    permalink: "/standards/sfdr-sustainable-finance/",
    content: `## Overview

The Sustainable Finance Disclosure Regulation (SFDR) is an EU regulation that requires financial market participants to disclose ESG information. It aims to increase transparency and prevent "greenwashing" in financial products.

## Scope

### Who Must Comply?

- **Asset managers**: AIFMs, UCITS managers
- **Insurance companies**: Life insurers offering unit-linked products
- **Pension funds**: Occupational pension providers
- **Investment advisors**: Providing portfolio management
- **Banks**: When managing investment products

### What Must Be Disclosed?

- **Entity-level**: Sustainability risks, adverse impacts
- **Product-level**: Environmental/social characteristics, sustainability objectives

## Disclosure Requirements

### Entity-Level Disclosures

#### Sustainability Risks

- How ESG risks are integrated into investment decisions
- Due diligence processes
- Risk assessment and monitoring

#### Principal Adverse Impacts (PAI)

- Disclosure of material adverse impacts on sustainability factors
- Consider 18 mandatory + 46 optional indicators
- "Comply or explain" approach

### Product-Level Disclosures

#### Article 6 Products

- No sustainability characteristics
- Basic disclosure on risk integration

#### Article 8 Products (Light Green)

- Promote environmental/social characteristics
- No specific sustainable investment objective
- Must disclose how characteristics are met

#### Article 9 Products (Dark Green)

- Sustainable investment objective
- Specific sustainability indicators
- Must meet "do no significant harm" test

## Taxonomy Alignment

### Article 9 Products

Must disclose:

- **Sustainable investments**: % aligned with Taxonomy
- **DNSH**: How do no significant harm is ensured
- **Minimum safeguards**: Social/governance standards
- **Objectives**: Environmental or social

### Article 8 Products

- May disclose Taxonomy alignment voluntarily
- Must not claim Article 9 status if not meeting criteria

## Key Metrics

### PAI Indicators

#### Climate Indicators

- GHG emissions (Scope 1, 2, 3)
- Carbon footprint
- Exposure to fossil fuels
- Energy efficiency

#### Social Indicators

- Violations of UN Global Compact
- Board diversity
- Human rights incidents
- Corruption cases

## Practical Guidance

### For Financial Institutions

1. **Classify products**: Determine Article 6/8/9 status
2. **Data collection**: Gather required metrics
3. **Disclose**: Publish on websites, pre-contractual
4. **Monitor**: Regular review and updates

### For Asset Managers

1. **Integration**: Embed ESG into processes
2. **Engagement**: Active ownership practices
3. **Transparency**: Clear product disclosures

## Key Takeaways

- SFDR requires comprehensive ESG disclosure
- Product classification critical (6, 8, 9)
- PAI disclosure increasingly expected
- Taxonomy alignment for Article 9 products
- Prevents greenwashing in financial products
- EU and global applicability
`
  },
  {
    slug: "european-green-deal",
    title: "European Green Deal",
    description: "Understanding the EU's European Green Deal strategy for achieving climate neutrality by 2050.",
    keywords: "European Green Deal,EU,climate,Green Deal,Fit for 55",
    pillar: "Environmental",
    section: "standards",
    permalink: "/standards/european-green-deal/",
    content: `## Overview

The European Green Deal is the EU's comprehensive strategy to achieve climate neutrality by 2050. It outlines a roadmap for transforming the EU economy through sustainable policies across all sectors.

## Key Objectives

### Climate Targets

- **2050**: Climate neutral (net-zero GHG)
- **2030**: At least 55% reduction vs 1990
- **2030**: 42.5% renewable energy target
- **2030**: 39% energy efficiency improvement

### Goals

- Economic growth decoupled from resource use
- Fair and inclusive transition
- EU global leadership on climate

## Main Components

### Climate Law

- Legally binding 2050 target
- 2030 intermediate target
- Progress monitoring mechanism

### Just Transition Mechanism

Supporting regions and workers transitioning away from fossil fuels:

- **Just Transition Fund**: €17.5B
- **InvestEU**: Sovereign guarantees
- **EIB lending**: Climate investments

### Key Policies

| Area | Key Initiatives |
|------|----------------|
| Energy | Renewable energy expansion, energy efficiency |
| Transport | EV adoption, sustainable fuels, pricing |
| Industry | Circular economy, low-carbon production |
| Agriculture | Sustainable farming, emission reduction |
| Buildings | Energy efficiency, renovation |

## Fit for 55 Package

### Purpose

Align existing policies with new 2030 targets:

### Key Elements

- **EU ETS reform**: Stricter caps, expanded scope
- **Carbon Border Adjustment**: CBAM for imports
- **Renewable Energy Directive**: Higher targets
- **Energy Efficiency Directive**: Building standards
- **CO2 standards**: Stricter vehicle emissions

## Business Implications

### Opportunities

- Clean technology leadership
- First-mover advantage in green solutions
- Access to green finance
- Just Transition funding

### Challenges

- Compliance costs
- Supply chain transformation
- Data and reporting requirements
- Competition from green imports

## Practical Guidance

### For Companies

1. **Assess exposure**: Impact of EU policies on business
2. **Plan transition**: Decarbonization roadmap
3. **Engage policymakers**: Contribute to consultations
4. **Access funding**: Just Transition, innovation funds

### Sectors Most Affected

- **Energy**: ETS costs, renewable requirements
- **Transport**: CO2 standards, charging infrastructure
- **Buildings**: Renovation requirements
- **Industry**: CBAM, circular economy demands
- **Agriculture**: Emission reduction targets

## Key Takeaways

- European Green Deal is comprehensive climate strategy
- Legally binding 2050 climate neutrality target
- Fit for 55 aligns policies with 2030 goals
- Just Transition ensures fair treatment of workers
- Significant business implications across sectors
- EU leads global climate policy
`
  },
  {
    slug: "eu-emissions-trading",
    title: "EU Emissions Trading System",
    description: "Understanding the EU ETS, the world's largest carbon market and key tool for reducing European emissions.",
    keywords: "EU ETS,emissions trading,carbon market,EU carbon,cap and trade",
    pillar: "Environmental",
    section: "standards",
    permalink: "/standards/eu-emissions-trading/",
    content: `## Overview

The EU Emissions Trading System (EU ETS) is the world's first and largest carbon market. It is a cornerstone of EU climate policy, putting a price on carbon emissions and incentivizing reductions across sectors.

## How EU ETS Works

### Cap and Trade

1. **Cap**: Declining limit on total emissions
2. **Allowances**: Permits to emit (1 allowance = 1 tonne CO2)
3. **Trading**: Buy/sell allowances
4. **Compliance**: Surrender allowances for emissions

### Phases

| Phase | Period | Key Features |
|-------|--------|--------------|
| Pilot | 2005-2007 | Learning phase |
| Phase 2 | 2008-2012 | Kyoto commitment period |
| Phase 3 | 2013-2020 | Single EU market, auctioning |
| Phase 4 | 2021-2030 | Stricter caps, MSR |

## Scope

### Sectors Covered

- **Power generation**: ~95% of EU power sector
- **Industry**: Steel, cement, chemicals, refineries
- **Aviation**: Flights within EEA
- **Maritime**: Shipping (from 2024)

### Emissions Covered

- ~40% of EU GHG emissions
- ~8,000 installations
- ~1 billion tonnes CO2/year

## Recent Reforms (Fit for 55)

### Linear Reduction Factor

- Increased from 2.2% to 4.3% (2024-2027)
- Then 4.4% (2028-2030)

### Market Stability Reserve (MSR)

- Addresses price volatility
- Withholds/becomes allowances based on surplus

### Free Allocation

- Phased out for aviation (2024)
- CBAM addresses carbon leakage

### Expansion

- **Maritime**: Shipping included (2024)
- **Buildings/Road**: New system (2027, if launched)

## Carbon Border Adjustment Mechanism (CBAM)

### Purpose

Prevent carbon leakage by pricing imports:

- Applies to: Steel, cement, aluminum, fertilizers, electricity, hydrogen
- Phased in: 2023-2026 (reporting), 2026-2034 (payments)
- Calculates embedded emissions vs EU ETS price

## Business Implications

### For Covered Companies

- **Compliance**: Monitor and report emissions
- **Financial**: Budget for allowance costs
- **Strategic**: Decarbonization investments

### For Non-Covered Companies

- **Supply chain**: Expect carbon costs upstream
- **Opportunity**: Clean technology demand
- **Risk**: CBAM impacts on exports

## Allowance Prices

### Historical

- 2005-2007: €20-30
- 2008-2012: €10-15 (surplus)
- 2013-2018: €5-10 (oversupply)
- 2019-2021: €25-90
- 2022-2024: €80-100+

### Price Drivers

- Energy prices
- Policy stringency
- Economic activity
- Market speculation

## Key Takeaways

- EU ETS is world's largest carbon market
- Cap declines annually, driving emission reductions
- Recent reforms significantly increased ambition
- CBAM addresses carbon leakage
- Price signals drive decarbonization investment
- Covers ~40% of EU emissions
`
  },
  {
    slug: "fit-for-55-package",
    title: "Fit for 55 Package",
    description: "Understanding the EU's Fit for 55 package of climate legislation to achieve 2030 emissions targets.",
    keywords: "Fit for 55,EU climate,2030 targets,climate package",
    pillar: "Environmental",
    section: "standards",
    permalink: "/standards/fit-for-55-package/",
    content: `## Overview

The "Fit for 55" package is a set of legislative proposals adopted by the EU in 2021 to reduce greenhouse gas emissions by at least 55% by 2030 compared to 1990 levels. It aligns existing climate policies with the new 2030 ambition and ensures the EU meets its Paris Agreement commitments.

## Package Overview

### Goals

- 55% GHG reduction by 2030
- 42.5% renewable energy
- 39% energy efficiency
- Climate neutrality by 2050

### Key Files

| Regulation | Objective |
|------------|------------|
| EU ETS Directive | Stricter emissions trading |
| Effort Sharing | National emission targets |
| LULUCF | Land use and forestry |
| CBAM | Carbon border adjustment |
| Renewable Energy | Higher renewables target |
| Energy Efficiency | Stricter standards |
| CO2 Standards | Vehicle emissions |

## Key Elements

### EU ETS Reform

- Increased linear reduction factor (4.3%)
- Phased free allocation
- Expanded scope (maritime)

### Carbon Border Adjustment (CBAM)

- phased implementation
- Initial sectors: steel, cement, aluminum, fertilizers, electricity, hydrogen
- Reports 2023-2026, payments from 2026

### Renewable Energy

- 42.5% target (from 32%)
- 60% transport target (advanced biofuels)
- Hydrogen: 10% renewable

### Energy Efficiency

- 39% reduction target (vs 32.5%)
- Annual energy savings: 1.5%
- Public sector: 1.7%

### CO2 Standards

- Cars: 100% zero emission by 2035
- Vans: 100% zero emission by 2035
- 2025 targets: 15% reduction (cars), 15% (vans)

### Effort Sharing

- Binding national targets for sectors outside ETS
- 2030 targets: -10% to -50% vs 2005
- Flexibility mechanisms

### LULUCF

- Net sink target: -310 Mt CO2 by 2030
- Managed forest rules
- Accounting for wetlands

## Implementation Timeline

- **2023**: CBAM reporting begins
- **2024**: Maritime ETS, CO2 standards
- **2025**: New Effort Sharing targets
- **2026**: CBAM payments start
- **2027**: New ETS for buildings/roads (if approved)
- **2030**: Full targets effective

## Business Implications

### Affected Sectors

- **Energy**: Renewables, efficiency
- **Transport**: EVs, alternative fuels
- **Industry**: Decarbonization, CBAM
- **Buildings**: Renovation, heat pumps

### Opportunities

- Green technology markets
- Innovation funding
- Export of low-carbon products

### Challenges

- Compliance costs
- Supply chain changes
- Investment needs

## Practical Guidance

### For Companies

1. **Assess exposure**: Which policies affect you?
2. **Plan decarbonization**: Roadmap to 2030
3. **Monitor regulations**: Implementation details
4. **Engage**: Policy consultations

### Sectors Most Impacted

- Automotive: CO2 standards
- Energy: ETS, renewables
- Industry: CBAM, ETS
- Buildings: Efficiency standards

## Key Takeaways

- Fit for 55 aligns EU with 1.5°C pathway
- Comprehensive package across sectors
- CBAM addresses carbon leakage
- Significant investment needed
- Opportunities in green technologies
- Decarbonization now essential
`
  },
  {
    slug: "esrs-sustainability-reporting",
    title: "ESRS: European Sustainability Reporting Standards",
    description: "Understanding ESRS disclosure requirements for CSRD compliance and comprehensive ESG reporting.",
    keywords: "ESRS,sustainability reporting,disclosure,CSRD,ESG standards",
    pillar: "Governance",
    section: "standards",
    permalink: "/standards/esrs-sustainability-reporting/",
    content: `## Overview

European Sustainability Reporting Standards (ESRS) are detailed disclosure standards developed by EFRAG for the CSRD. They provide comprehensive requirements for companies to report on environmental, social, and governance topics.

## Structure

### Standards Framework

| Category | Standards | Topics |
|----------|-----------|--------|
| Cross-cutting | ESRS 1-2 | General principles, climate change |
| Environmental | ESRS E1-E5 | Climate, pollution, water, biodiversity, circular economy |
| Social | ESRS S1-S4 | Workforce, workers in value chain, communities, consumers |
| Governance | ESRS G1 | Business conduct |

### ESRS 1: General Requirements

- Disclosure principles
- Structure of sustainability statement
- Preparation principles

### ESRS 2: General Disclosures

- Governance
- Strategy
- Impacts, risks, opportunities
- Metrics and targets

## Key Disclosures

### ESRS E1: Climate Change

- GHG emissions (Scope 1, 2, 3)
- Climate transition plan
- Energy consumption
- Internal carbon price

### ESRS E2: Pollution

- Pollution-related emissions
- Pollution incidents
- Substances of concern

### ESRS E3: Water

- Water consumption
- Water discharge
- Water stress

### ESRS E4: Biodiversity

- Impacts on ecosystems
- Policies on biodiversity
- Dependencies on ecosystem services

### ESRS E5: Resource Use

- Resource inflows
- Resource outflows
- Waste

### ESRS S1: Own Workforce

- Working conditions
- Equal treatment
- Training
- Work-life balance

### ESRS S2: Workers in Value Chain

- Working conditions
- Social dialogue
- Supply chain due diligence

### ESRS S3: Communities

- Local communities
- Indigenous peoples
- Social impact assessment

### ESRS S4: Consumers

- Consumer welfare
- Consumer privacy
- Product safety

### ESRS G1: Business Conduct

- Corporate culture
- Anti-corruption
- Political engagement

## Reporting Requirements

### Location

- Part of management report
- Digital tagging (ESEF)

### Assurance

- Limited assurance (initial)
- Reasonable assurance (future)

### Timeline

- Same as financial statements
- Published with annual report

## Practical Guidance

### Steps to Prepare

1. **Gap analysis**: Current vs ESRS requirements
2. **Data systems**: Collect required metrics
3. **Materiality**: Double materiality assessment
4. **Governance**: Assign responsibilities
5. **Assurance**: Engage auditors

### Data Requirements

- Disaggregated data by country
- Historical comparison (1 year, then 3)
- Forward-looking information

## Key Takeaways

- ESRS provides comprehensive disclosure standards
- Apply to all large companies under CSRD
- Double materiality required
- Significant data collection needed
- Assurance requirements increasing
- First reports due 2024/2025
`
  },
  {
    slug: "csdd-due-diligence",
    title: "Due Diligence Directive (CSDDD)",
    description: "Understanding the EU's Corporate Sustainability Due Diligence Directive and mandatory human rights/environmental due diligence.",
    keywords: "CSDDD,due diligence,human rights,environment,supply chain",
    pillar: "Governance",
    section: "standards",
    permalink: "/standards/csdd-due-diligence/",
    content: `## Overview

The Corporate Sustainability Due Diligence Directive (CSDDD) is EU legislation requiring companies to identify, prevent, and mitigate adverse impacts on human rights and the environment throughout their value chains.

## Scope

### Companies Covered

- **EU companies**: 500+ employees + €150M+ revenue
- **Other companies**: If in high-impact sectors (textiles, agriculture, mining)
- **Timeline**: Phased implementation 2025-2027

### High-Risk Sectors

- Textiles and footwear
- Agriculture, forestry, fisheries
- Mining and quarrying
- Wholesale/retail of certain products

## Due Diligence Requirements

### Process Steps

1. **Mapping**: Identify value chain
2. **Assessment**: Evaluate actual/potential impacts
3. **Prevention**: Measures to prevent adverse impacts
4. **Mitigation**: Actions to mitigate
5. **Monitoring**: Track effectiveness
6. **Communication**: Report to stakeholders

### Value Chain Coverage

- **Upstream**: Suppliers, raw materials
- **Downstream**: Distribution, use, end-of-life

## Mandatory Requirements

### Climate Transition Plan

- For large companies (1500+ employees)
- Must be compatible with 1.5°C target
- Include emissions reduction targets

### Director Duties

- Oversight of due diligence
- Integration into strategy
- Accountability for implementation

### Civil Liability

- Companies liable for damages
- Failure to prevent can result in claims

## Connection to Other Legislation

### CSRD

- CSDDD complements CSRD
- Both require value chain due diligence
- Coordinated reporting

### EU Taxonomy

- Environmental due diligence overlaps
- DNSH requirements aligned

### Supply Chain Laws

- German Supply Chain Act
- French Duty of Vigilance
- CSDDD harmonizes across EU

## Practical Guidance

### For Companies

1. **Map value chain**: Identify all business relationships
2. **Assess impacts**: Human rights and environment
3. **Develop plan**: Prevention and mitigation
4. **Implement**: Actions and procedures
5. **Report**: Public disclosure
6. **Monitor**: Ongoing due diligence

### Key Actions

- Update supplier contracts
- Establish grievance mechanisms
- Train teams on due diligence
- Engage stakeholders

## Timeline

- **2024**: Final adoption expected
- **2025**: Largest EU companies (5000+ employees)
- **2026**: Large companies (3000+)
- **2027**: Companies (1000+)

## Key Takeaways

- CSDDD requires mandatory due diligence
- Covers human rights and environment
- Applies to entire value chain
- Climate transition plans required
- Civil liability for non-compliance
- Phased implementation 2025-2027
`
  },

  // ============ SUPPLY CHAIN ESG (8 articles) ============
  {
    slug: "scope-3-emissions",
    title: "Scope 3 Emissions: Overview & Calculation",
    description: "Understanding Scope 3 emissions, their importance, and methods for calculation and reduction.",
    keywords: "Scope 3,emissions,supply chain,value chain,GHG Protocol",
    pillar: "Environmental",
    section: "social",
    permalink: "/social/scope-3-emissions/",
    content: `## Overview

Scope 3 emissions are indirect emissions that occur in a company's value chain. For most companies, Scope 3 represents the largest portion of their carbon footprint—often 80-90%—making it critical for comprehensive climate action.

## What Are Scope 3 Emissions?

### Categories (GHG Protocol)

#### Upstream (Categories 1-8)

1. **Purchased goods**: Extraction, production of purchased materials
2. **Capital goods**: Manufacturing of capital equipment
3. **Fuel & energy**: Upstream activities for purchased energy
4. **Upstream transport**: Transportation and distribution
5. **Waste generated**: Waste disposal and treatment
6. **Business travel**: Employee business travel
7. **Employee commuting**: Employee commuting to/from work
8. **Upstream leased**: Assets leased from others

#### Downstream (Categories 9-15)

9. **Downstream transport**: Transportation of sold products
10. **Processing**: Processing of sold products
11. **Use**: Use of sold products by consumers
12. **End-of-life**: Treatment of sold products at end of life
13. **Downstream leased**: Assets leased to others
14. **Franchises**: Operations of franchises
15. **Investments**: Equity investments

## Why Scope 3 Matters

### Business Case

- **Materiality**: Often 80%+ of emissions
- **Risk**: Supply chain disruption, regulation
- **Opportunity**: Innovation, competitive advantage
- **Stakeholders**: Investors, customers, regulators

### Regulatory Pressure

- **CSRD**: Scope 3 reporting required
- **SEC**: Climate disclosure proposal
- **EU**: Value chain due diligence

## Calculation Methods

### Primary Methods

| Method | Description | Accuracy |
|--------|-------------|----------|
| Supplier-specific | Direct supplier data | High |
| Average data | Industry averages | Medium |
| Spend-based | Spend × emission factors | Low |
| Physical-based | Activity × emission factor | Medium |

### Steps to Calculate

1. **Map value chain**: Identify all activities
2. **Select methods**: Appropriate for each category
3. **Collect data**: Supplier surveys, spend data
4. **Apply factors**: Emission factors
5. **Calculate**: Sum emissions

## Data Collection

### Primary Data

- Direct supplier engagement
- Product-level data
- Primary activity data

### Secondary Data

- Industry averages
- Published emission factors
- Database estimates

### Data Quality

- Consider uncertainty
- Document assumptions
- Prioritize material categories

## Reduction Strategies

### Upstream

- Supplier engagement and decarbonization
- Sustainable procurement
- Product design for lower impact
- Logistics optimization

### Downstream

- Product efficiency standards
- Customer education
- Take-back programs
- Circular business models

## Practical Guidance

### Getting Started

1. **Screen**: Which categories are material?
2. **Prioritize**: Focus on biggest sources
3. **Collect data**: Start with available data
4. **Engage suppliers**: Build capacity
5. **Set targets**: Science-based where possible
6. **Report**: Disclose publicly

### Key Challenges

- Data availability and quality
- Supply chain complexity
- Allocation issues
- Changing suppliers

## Key Takeaways

- Scope 3 is typically the largest emission category
- Critical for net-zero strategies
- Data quality improving but challenging
- Supplier engagement essential
- Regulatory requirements increasing
- Must be included in SBTi targets
`
  },
  {
    slug: "supplier-esg-due-diligence",
    title: "Supplier ESG Due Diligence",
    description: "Understanding how to assess and manage ESG risks in your supply chain through supplier due diligence.",
    keywords: "supplier,due diligence,ESG,supply chain,risk assessment",
    pillar: "Social",
    section: "social",
    permalink: "/social/supplier-esg-due-diligence/",
    content: `## Overview

Supplier ESG due diligence is the process of identifying, assessing, and mitigating environmental, social, and governance risks in your supply chain. It's becoming a mandatory requirement and essential for sustainable business operations.

## Regulatory Framework

### Key Regulations

- **EU CSDDD**: Corporate Sustainability Due Diligence Directive
- **German Supply Chain Act**: Human rights due diligence
- **French Duty of Vigilance**: Large company obligations
- **UK Modern Slavery Act**: Slavery and trafficking reporting

### Common Requirements

- Risk mapping
- Impact assessments
- Prevention measures
- Grievance mechanisms
- Reporting

## Due Diligence Process

### Step 1: Mapping

Identify supply chain:

- Direct suppliers (Tier 1)
- Indirect suppliers (Tier 2+)
- Geographic locations
- Industry sectors

### Step 2: Risk Assessment

Evaluate potential impacts:

- Country risk (governance, labor law)
- Sector risk (hazardous processes)
- Company risk (track record)
- Product risk (materials)

### Step 3: Prevention

Implement measures:

- Supplier codes of conduct
- Pre-qualification requirements
- Contractual clauses
- Training programs

### Step 4: Monitoring

Ongoing verification:

- Audits (self-assessment, third-party)
- Certifications
- Continuous monitoring
- Performance tracking

### Step 5: Remediation

Address issues found:

- Corrective action plans
- Capacity building
- Termination procedures
- Financial support (in certain cases)

## ESG Risk Areas

### Environmental

- Climate emissions (Scope 3)
- Resource use and pollution
- Waste management
- Biodiversity impact

### Social

- Labor conditions
- Child/forced labor
- Health and safety
- Human rights

### Governance

- Corruption/bribery
- Data privacy
- Ethical sourcing
- Transparency

## Practical Guidance

### For Companies

1. **Map supply chain**: Know your suppliers
2. **Assess risks**: Prioritize high-risk areas
3. **Set standards**: Code of conduct
4. **Engage**: Build supplier capacity
5. **Monitor**: Regular assessments
6. **Remediate**: Address issues

### Supplier Engagement

- Clear expectations
- Practical support
- Long-term relationships
- Shared improvement goals

### Tools and Resources

- EcoVadis: Sustainability ratings
- Sedex: Ethical trade platform
- CDP Supply Chain: Carbon disclosure
- SA8000: Labor standards

## Key Takeaways

- Due diligence increasingly mandatory
- Covers environmental, social, governance
- Must address entire value chain
- Prevention better than remediation
- Ongoing monitoring essential
- Stakeholder expectations high
`
  },
  {
    slug: "human-rights-supply-chains",
    title: "Human Rights in Supply Chains",
    description: "Understanding business responsibility for human rights in global supply chains and how to address modern slavery risks.",
    keywords: "human rights,modern slavery,supply chain,labor rights,ethical sourcing",
    pillar: "Social",
    section: "social",
    permalink: "/social/human-rights-supply-chains/",
    content: `## Overview

Human rights in supply chains is a critical business issue. Companies are increasingly expected to ensure that their products are not made with forced labor, child labor, or other human rights abuses. Regulatory and consumer pressure is intensifying.

## Key Concepts

### UN Guiding Principles on Business and Human Rights

1. **Protect**: States' duty to protect human rights
2. **Respect**: Companies' responsibility to respect
3. **Remedy**: Access to effective remedy

### Human Rights Due Diligence

- Identify actual and potential impacts
- Assess severity and likelihood
- Take appropriate action
- Track effectiveness
- Communicate publicly

## Modern Slavery

### Forms in Supply Chains

- **Forced labor**: Coercion, debt bondage
- **Child labor**: Work harmful to children
- **Wage theft**: Non-payment or underpayment
- **Excessive hours**: Beyond legal limits
- **Dangerous conditions**: Safety violations
- **Restriction of movement**: Control over workers

### High-Risk Industries

- Textiles and apparel
- Electronics
- Agriculture
- Mining
- Fishing
- Construction

## Regulatory Requirements

### UK Modern Slavery Act (2015)

- Statements required annually
- Must cover slavery risks in operations/supply chain
- No penalties but enforcement via injunction

### Australian Modern Slavery Act (2018)

- Reporting required for large entities
- Mandatory criteria for statements

### US Uyghur Forced Labor Prevention Act

- Prohibits import from Xinjiang
- Forced labor presumption
- Supply chain traceability

### Germany Supply Chain Act (2023)

- Human rights due diligence
- Liability for omissions
- Employee representation

## Risk Assessment

### Geographic Risk

- Weak rule of law
- Limited labor protections
- High prevalence of exploitation

### Sectoral Risk

- Labor-intensive processes
- Low wages
- Complex supply chains
- Migrant worker prevalence

### Company Risk

- Size and power imbalances
- Subcontracting practices
- Transparency levels
- Previous incidents

## Practical Steps

### 1. Policy

- Supplier code of conduct
- Human rights policy
- Commitment to remediation

### 2. Mapping

- Supply chain visibility
- High-risk tier identification
- Country/sector analysis

### 3. Due Diligence

- Risk assessments
- Supplier audits
- Worker voice mechanisms

### 4. Response

- Grievance mechanisms
- Remediation procedures
- Industry collaboration

### 5. Reporting

- Public statements
- Annual reporting
- Stakeholder engagement

## Practical Guidance

### For Companies

1. **Map**: Know your supply chain
2. **Assess**: Identify risks
3. **Engage**: Work with suppliers
4. **Monitor**: Verify compliance
5. **Remediate**: Address violations
6. **Report**: Public disclosure

### Red Flags

- Unusually low prices
- No supplier audits
- Lack of worker representation
- Restrictive recruitment

## Key Takeaways

- Human rights increasingly mandatory to address
- Supply chain transparency essential
- Due diligence required by law
- Consumer and investor pressure
- Collaboration helps address systemic issues
- Remediation is expected when issues found
`
  },
  {
    slug: "modern-slavery-compliance",
    title: "Modern Slavery Act Compliance",
    description: "Understanding compliance with the UK Modern Slavery Act and other modern slavery legislation for businesses.",
    keywords: "Modern Slavery Act,compliance,UK,forced labor,trafficking",
    pillar: "Social",
    section: "social",
    permalink: "/social/modern-slavery-compliance/",
    content: `## Overview

The UK Modern Slavery Act 2015 requires organizations to report on the risks of modern slavery in their operations and supply chains. It's a landmark law that has driven significant improvements in supply chain transparency.

## Who Must Comply?

### UK Entities

- Commercial organizations operating in UK
- Turnover of £36M+ annually
- Must publish annual statement

### Non-UK Companies

- Supply goods/services to UK
- Must comply if operating in UK

## Statement Requirements

### Mandatory Criteria

1. Organization structure and supply chains
2. Policies in relation to modern slavery
3. Due diligence processes
4. Risk assessment
5. Training for staff

### Recommended Criteria

- Relevant metrics
- Goals and performance indicators
- Consultation with stakeholders

## What Is Modern Slavery?

### Definitions

- **Forced labor**: Compulsory work through coercion
- **Human trafficking**: Recruitment/transportation through force
- **Debt bondage**: Work to repay debt
- **Child labor**: Harmful work by children

### Signs

- Passport retention
- Restriction of movement
- Debt bondage
- Physical violence
- Withheld wages

## Compliance Steps

### Step 1: Map Supply Chain

- Identify direct suppliers
- Map sub-tier (where possible)
- Identify high-risk areas

### Step 2: Assess Risk

- Country/industry risk
- Product/service risk
- Supplier risk

### Step 3: Develop Policies

- Ethical sourcing policy
- Supplier code of conduct
- Whistleblowing procedures

### Step 4: Implement Due Diligence

- Pre-qualification
- Contractual clauses
- Ongoing monitoring

### Step 5: Train Staff

- Awareness training
- Procurement teams
- Due diligence processes

### Step 6: Report

- Annual statement
- Board approval
- Public publication

## International Expansion

### Similar Laws

- **Australia**: Modern Slavery Act 2018
- **California**: Transparency in Supply Chains Act
- **Canada**: Fighting Against Forced Labour Act
- **EU**: Proposed directive

### Compliance Overlap

- Single statement often covers multiple laws
- Align requirements
- Document approach

## Practical Guidance

### For Companies

1. **Start with mapping**: Understand supply chain
2. **Develop policy**: Clear expectations
3. **Engage suppliers**: Build capacity
4. **Monitor**: Regular assessments
5. **Report**: Publish annually

### Common Mistakes

- Generic statements
- No board approval
- No consultation
- No performance tracking

## Key Takeaways

- Required for UK organizations >£36M turnover
- Statement must be published annually
- Must cover operations and supply chains
- Increasing enforcement globally
- Due diligence essential
- Good practice even where not required
`
  },
  {
    slug: "responsible-sourcing",
    title: "Responsible Sourcing",
    description: "Understanding responsible sourcing practices and how to build sustainable supply chains.",
    keywords: "responsible sourcing,sustainable procurement,ESG,supplier",
    pillar: "Social",
    section: "social",
    permalink: "/social/responsible-sourcing/",
    content: `## Overview

Responsible sourcing integrates environmental, social, and ethical considerations into procurement decisions. It ensures that products and services are sourced in a way that minimizes negative impacts and maximizes positive outcomes.

## Key Elements

### Environmental

- Carbon footprint
- Resource use
- Pollution and waste
- Biodiversity impact

### Social

- Labor standards
- Human rights
- Health and safety
- Community impact

### Governance

- Business ethics
- Transparency
- Anti-corruption
- Data protection

## Business Case

### Risk Management

- Supply chain disruptions
- Regulatory compliance
- Reputation damage
- Legal liability

### Value Creation

- Innovation opportunities
- Cost savings (efficiency)
- Market access
- Stakeholder trust

### Competitive Advantage

- Customer preferences
- Investor requirements
- Talent attraction

## Implementation Framework

### 1. Policy Development

- Supplier code of conduct
- Environmental standards
- Social requirements
- Ethical guidelines

### 2. Supplier Assessment

- Pre-qualification criteria
- Risk categorization
- Capability evaluation

### 3. Supplier Selection

- ESG criteria in decisions
- Total cost of ownership
- Life cycle considerations

### 4. Ongoing Monitoring

- Regular audits
- Performance metrics
- Continuous improvement

### 5. Collaboration

- Industry initiatives
- Supplier development
- Best practice sharing

## Practical Tools

### Standards and Certifications

| Standard | Focus |
|----------|-------|
| ISO 20400 | Sustainable procurement |
| SA8000 | Social accountability |
| ISO 14001 | Environmental management |
| Fairtrade | Fair trading conditions |
| B Corp | Social and environmental |

### Assessment Methods

- Self-assessment questionnaires
- Third-party audits
- Certifications
- Risk databases

## Categories of Focus

### Raw Materials

- Conflict minerals
- Rare earth elements
- Agricultural commodities
- Timber and paper

### Manufacturing

- Factory conditions
- Energy use
- Chemical management
- Waste handling

### Logistics

- Transportation emissions
- Packaging
- Reverse logistics

### Services

- Labor conditions
- Data handling
- Ethical practices

## Practical Guidance

### For Procurement Teams

1. **Integrate ESG**: Into all decisions
2. **Engage suppliers**: Build relationships
3. **Collect data**: Measure impacts
4. **Set targets**: Continuous improvement
5. **Report**: Transparency

### Key Success Factors

- Leadership commitment
- Cross-functional collaboration
- Supplier engagement
- Measurement and metrics

## Key Takeaways

- Responsible sourcing protects and creates value
- Essential for ESG compliance
- Requires supplier engagement
- Benefits extend beyond compliance
- Continuous improvement approach
- Growing stakeholder expectations
`
  },
  {
    slug: "supplier-code-conduct",
    title: "Supplier Code of Conduct",
    description: "Creating and implementing effective supplier codes of conduct for ethical supply chain management.",
    keywords: "supplier code of conduct,ethics,supplier standards,compliance",
    pillar: "Governance",
    section: "social",
    permalink: "/social/supplier-code-conduct/",
    content: `## Overview

A supplier code of conduct establishes the ethical, social, and environmental standards that suppliers must meet. It's a foundational document for responsible supply chain management and sets clear expectations for business partners.

## Key Components

### Labor Standards

- No forced labor
- No child labor
- Fair wages
- Reasonable hours
- Safe conditions
- Freedom of association

### Human Rights

- Non-discrimination
- Privacy and dignity
- Due process
- Indigenous rights
- Community impacts

### Environmental

- Emissions and pollution
- Resource use
- Waste management
- Chemical handling
- Biodiversity

### Business Ethics

- Anti-corruption
- Fair competition
- Data protection
- Conflict of interest
- Transparency

## Implementation Elements

### Clear Language

- Simple, understandable
- Translated locally
- Accessible to workers

### Commitment Mechanisms

- Written agreement
- Signature requirements
- Flow-down to sub-suppliers

### Monitoring

- Self-assessment
- Third-party audits
- Worker interviews

### Consequences

- Progressive discipline
- Remediation requirements
- Termination triggers

## Best Practices

### Development

- Stakeholder consultation
- Industry alignment
- Legal review
- Accessibility

### Communication

- Clear expectations
- Training
- Ongoing engagement

### Enforcement

- Consistent application
- Regular monitoring
- Transparent reporting

## Practical Steps

### For Companies

1. **Develop**: Create comprehensive code
2. **Communicate**: Share with all suppliers
3. **Integrate**: Include in contracts
4. **Monitor**: Verify compliance
5. **Support**: Help suppliers improve
6. **Enforce**: Address violations

### Key Success Factors

- Executive commitment
- Resources for implementation
- Supplier capacity building
- Continuous improvement

## Monitoring and Verification

### Methods

- Self-assessment questionnaires
- Document review
- Site audits
- Worker voice mechanisms

### Third-Party Audits

- Social compliance audits
- Environmental audits
- Integrated audits

### Industry Initiatives

- Better Buying
- Ethical Trading Initiative
- amfori BSCI

## Key Takeaways

- Code of conduct is foundation of supplier management
- Must cover labor, human rights, environment, ethics
- Implementation requires ongoing effort
- Monitoring essential for compliance
- Support helps suppliers improve
- Transparency builds trust
`
  },
  {
    slug: "supply-chain-traceability",
    title: "Supply Chain Traceability",
    description: "Understanding supply chain traceability and transparency for ESG compliance and risk management.",
    keywords: "traceability,supply chain,transparency,tracking,blockchain",
    pillar: "Social",
    section: "social",
    permalink: "/social/supply-chain-traceability/",
    content: `## Overview

Supply chain traceability is the ability to track products and materials from origin to final delivery. It's essential for ESG compliance, risk management, and responding to increasing regulatory and consumer demands for transparency.

## Why It Matters

### Regulatory Drivers

- EU Due Diligence Directive
- UK Modern Slavery Act
- US Forced Labor Prevention Act
- EU Deforestation Regulation

### Business Drivers

- Risk management
- Brand protection
- Consumer demand
- Investor requirements

### Operational Benefits

- Quality control
- Recalls management
- Efficiency gains
- Sustainability insights

## Technologies

### Digital Tracking

- **Barcodes/RFID**: Item-level tracking
- **QR codes**: Consumer-facing information
- **IoT sensors**: Temperature, location
- **Blockchain**: Immutable records

### Data Systems

- ERP integration
- Cloud platforms
- Supply chain visibility tools
- Data analytics

## Implementation

### Step 1: Map Supply Chain

- Identify all suppliers
- Document relationships
- Assess data capabilities

### Step 2: Define Data Requirements

- What to track
- Required data points
- Verification methods

### Step 3: Select Technology

- Match to complexity
- Consider cost
- Plan integration

### Step 4: Implement

- Supplier onboarding
- Data collection
- System integration

### Step 5: Verify

- Audit processes
- Third-party verification
- Continuous improvement

## Key Challenges

### Data Quality

- Inconsistent formats
- Manual processes
- Supplier capabilities

### Complexity

- Multi-tier supply chains
- Subcontracting
- Frequent changes

### Cost

- Technology investment
- Training
- Ongoing maintenance

## Practical Guidance

### Getting Started

1. **Prioritize**: Focus on high-risk areas
2. **Engage**: Work with key suppliers
3. **Start simple**: Basic tracking first
4. **Scale**: Expand over time

### Success Factors

- Executive sponsorship
- Supplier collaboration
- Clear requirements
- Technology strategy

## Industry Examples

### Food and Beverage

- Farm to fork tracking
- Certification verification
- Recall management

### Fashion

- Raw material origins
- Manufacturing locations
- Worker information

### Electronics

- Conflict minerals
- Component tracking
- Recycling tracking

## Key Takeaways

- Traceability increasingly mandatory
- Technology enables visibility
- Start with high-risk areas
- Collaboration improves success
- Continuous improvement needed
- Consumer demand driving adoption
`
  },
  {
    slug: "circular-supply-chains",
    title: "Circular Supply Chains",
    description: "Understanding circular economy principles and building circular supply chains for sustainable business.",
    keywords: "circular economy,circular supply chain,sustainability,resource efficiency",
    pillar: "Environmental",
    section: "social",
    permalink: "/social/circular-supply-chains/",
    content: `## Overview

Circular supply chains aim to eliminate waste by keeping materials in use at their highest value. This contrasts with the traditional linear "take-make-waste" model and is essential for sustainable business and resource security.

## Circular Economy Principles

### Design Out Waste

- Product design for longevity
- Repair and maintenance
- Modularity and upgrades

### Keep Materials in Use

- Reuse and repair
- Remanufacturing
- Recycling
- Composting

### Regenerate Systems

- Renewable energy
- Biological nutrients
- System optimization

## Supply Chain Implications

### Inbound (Sourcing)

- Recycled materials
- Renewable resources
- Sustainable suppliers
- Take-back programs

### Operations

- Resource efficiency
- Waste minimization
- Energy use reduction
- Water management

### Outbound (Distribution)

- Minimal packaging
- Efficient logistics
- Product-as-service
- Take-back schemes

## Business Models

### Product Life Extension

- Repair services
- Maintenance contracts
- Refurbishment
- Upgrading

### Circular Sourcing

- Recycled content
- Renewable materials
- Bio-based materials

### Take-Back Programs

- Returns and refurbishment
- Recycling schemes
- Leasing models

### Sharing Platforms

- Product-service systems
- Collaborative consumption
- Rental models

## Implementation

### Design Phase

- Design for disassembly
- Material selection
- Standardization
- Durability focus

### Production Phase

- Resource efficiency
- Waste as resource
- Clean production
- Energy use

### Distribution Phase

- Packaging reduction
- Efficient logistics
- Return logistics
- Reverse logistics

### End-of-Life Phase

- Take-back systems
- Recycling infrastructure
- Repurposing
- Energy recovery

## Practical Guidance

### For Companies

1. **Assess**: Current material flows
2. **Design**: Products for circularity
3. **Engage**: Suppliers in circularity
4. **Implement**: Circular business models
5. **Measure**: Circularity metrics

### Key Enablers

- Digital technologies
- Collaboration across supply chain
- Innovation culture
- Supportive policy

## Metrics

### Circularity Indicators

- Material circularity indicator
- Recycled content
- Product longevity
- Waste diversion

### Business Metrics

- Revenue from circular services
- Cost savings from efficiency
- Material cost reductions

## Key Takeaways

- Circular economy essential for sustainability
- Requires supply chain transformation
- Multiple business model opportunities
- Technology enables implementation
- Collaboration across chain critical
- Growing regulatory support
`
  },

  // ============ US/NORTH AMERICA (6 articles) ============
  {
    slug: "sec-climate-disclosure",
    title: "SEC Climate Disclosure Rules",
    description: "Understanding the SEC's proposed and existing climate disclosure requirements for public companies.",
    keywords: "SEC,climate disclosure,public companies,securities,reporting",
    pillar: "Governance",
    section: "hk-apac",
    permalink: "/hk-apac/sec-climate-disclosure/",
    content: `## Overview

The SEC has proposed landmark climate disclosure rules that would require public companies to report climate-related information. While implementation is pending legal challenges, it signals the direction of US climate reporting.

## Current Requirements

### Existing SEC Rules

- MD&A disclosure of material risks
- Form 10-K risk factors
- Management discussion and analysis
- Description of business (environmental)

### GHG Emissions

- No current mandatory GHG reporting
- SEC interpretive guidance (2010)
- Many companies voluntarily report

## Proposed Rules (2022)

### Scope of Disclosure

Public companies must disclose:

- **Climate risks**: Material risks and strategy
- **GHG emissions**: Scope 1, 2, significant Scope 3
- **Targets and goals**: If any
- **Transition plan**: Climate transition strategy
- **Financial impact**: Quantified effects

### Timeline

- Large accelerated filers: First year after adoption
- Accelerated filers: Year 2
- Non-accelerated filers: Year 3

### Safe Harbor

- Safe harbor for forward-looking statements
- Limited safe harbor for GHG data

## Key Requirements

### Governance

- Board oversight of climate risks
- Management's role in risk assessment

### Strategy

- Climate risks and opportunities
- Business impact
- Transition plan

### Risk Management

- Risk identification process
- Risk assessment methodology

### Metrics

- GHG emissions (Scope 1, 2, material Scope 3)
- Climate-related targets
- Progress against targets

## Legal Challenges

### State Actions

- Multiple states sued to block rules
- Challenges on SEC authority
- Scope of disclosure

### Current Status

- Rules finalized but stayed
- Supreme Court impact (major questions doctrine)
- Implementation uncertain

## State-Level Developments

### California

- **SB 253**: Climate Corporate Data Accountability Act
- **SB 261**: Climate-related Financial Risk Act
- Both require GHG emissions disclosure
- Apply to large US companies

### Other States

- New York climate legislation
- Various disclosure requirements
- State-by-state approach

## Practical Guidance

### For Companies

1. **Monitor**: Legal developments
2. **Prepare**: Data collection systems
3. **Assess**: Current readiness
4. **Engage**: With auditors
5. **Consider**: Voluntary disclosure

### Regardless of SEC Rules

- California requirements
- Investor expectations
- Global standards

## Key Takeaways

- SEC rules signal direction of US disclosure
- Legal challenges create uncertainty
- State requirements provide alternative
- GHG emissions likely required
- Supply chain (Scope 3) material for many
- Preparation recommended regardless
`
  },
  {
    slug: "us-state-esg-laws",
    title: "US State-Level ESG Laws",
    description: "Overview of ESG and climate legislation at the US state level, including California's landmark climate laws.",
    keywords: "ESG,US state,California,climate law,legislation",
    pillar: "Governance",
    section: "hk-apac",
    permalink: "/hk-apac/us-state-esg-laws/",
    content: `## Overview

While federal ESG regulation remains uncertain, US states are taking the lead with climate and ESG legislation. California in particular has passed significant laws affecting large companies.

## California Climate Laws

### SB 253: Climate Corporate Data Accountability Act (2023)

**Requirements:**

- GHG emissions disclosure (Scope 1, 2, 3)
- Annual reporting to CARB
- Third-party assurance

**Scope:**

- US companies with revenue >$1B
- Doing business in California
- Starting 2026

### SB 261: Climate-Related Financial Risk Act (2023)

**Requirements:**

- Climate-related financial risk disclosure
- Biennial reporting
- Aligned with TCFD

**Scope:**

- US companies with revenue >$500M
- Doing business in California
- Starting 2026

### SB 343: Climate-Related Financial Risk (2023)

**Requirements:**

- Enhanced climate disclosure
- Uses ESRS framework
- Science-based targets (if set)

**Scope:**

- Large companies (similar to SB 253/261)

### AB 1305: Greenwashing (2023)

**Requirements:**

- Disclosure of net-zero claims
- substantiation requirements
- Liability for false claims

**Scope:**

- Companies making environmental claims

## Other State Developments

### New York

- Climate Leadership and Community Protection Act
- GHG reduction targets
- Climate disclosure (proposed)

### Washington

- Climate Commitment Act (cap-and-trade)
- Corporate GHG disclosure

### Massachusetts

- Climate Disclosure Act (proposed)
- GHG reporting requirements

### Colorado

- Climate Accountability Act
- GHG emission reduction requirements

## Anti-ESG Movements

### State Actions

Several states have passed anti-ESG laws:

- Prohibiting ESG investing for state funds
- Restricting ESG considerations
- Anti-boycott provisions

### Implications

- Fragmented regulatory landscape
- Conflicting state requirements
- Compliance complexity

## Practical Guidance

### For Companies

1. **Assess applicability**: Which state laws apply?
2. **Collect data**: GHG emissions data
3. **Prepare disclosure**: California first
4. **Monitor**: Other state developments
5. **Engage**: Legal counsel

### Key Considerations

- Multi-state compliance
- Third-party assurance
- Supply chain data
- Reporting frameworks

## Key Takeaways

- States leading ESG regulation in US
- California laws most comprehensive
- Significant compliance burden
- More states expected to follow
- Federal vs. state tensions continue
- Multi-jurisdictional compliance needed
`
  },
  {
    slug: "california-climate-laws",
    title: "California Climate Laws (SB 253, SB 261)",
    description: "Understanding California's landmark climate disclosure laws and their requirements for companies.",
    keywords: "California,SB 253,SB 261,climate disclosure,emissions",
    pillar: "Governance",
    section: "hk-apac",
    permalink: "/hk-apac/california-climate-laws/",
    content: `## Overview

California has passed the most comprehensive US state climate laws, requiring detailed GHG emissions and climate risk disclosure. These laws will affect thousands of companies doing business in the state.

## SB 253: Climate Corporate Data Accountability Act

### Requirements

**GHG Emissions Reporting:**

- Scope 1 emissions (direct)
- Scope 2 emissions (purchased energy)
- Scope 3 emissions (value chain) - if material

**Third-Party Assurance:**

- Limited assurance for Scope 1 and 2
- Reasonable assurance phased in

**Timeline:**

- 2026: First reporting year
- Companies >$1B revenue

### Scope

- Companies doing business in California
- US companies (not just CA incorporated)
- Global emissions included

## SB 261: Climate-Related Financial Risk Act

### Requirements

**Climate Risk Disclosure:**

- Physical risks
- Transition risks
- Governance and strategy
- Risk management processes

**Framework:**

- Aligned with TCFD recommendations
- Biennial reporting

**Timeline:**

- 2026: First reporting year
- Companies >$500M revenue

## SB 343: Enhanced Climate Disclosure

### Requirements

**Additional Disclosures:**

- Uses ESRS framework
- GHG intensity metrics
- Science-based targets (if set)

**Timing:**

- Phased implementation
- Larger companies first

## AB 1305: Greenwashing Prevention

### Requirements

**Environmental Claims:**

- Net-zero claims must be substantiated
- Clear methodology disclosure
- Third-party verification

**Timeline:**

- Effective 2024
- Applies to all companies

## Compliance Steps

### Step 1: Assess Applicability

- Revenue threshold
- California "doing business"

### Step 2: Data Collection

- GHG inventory (Scope 1, 2, 3)
- Climate risk assessment

### Step 3: Systems

- Reporting infrastructure
- Data management

### Step 4: Assurance

- Select assurance provider
- Begin limited assurance

### Step 5: Reporting

- Submit to CARB
- Public disclosure
- Website posting

## Practical Guidance

### For Companies

1. **Determine applicability**: Check revenue and CA exposure
2. **Start data collection**: GHG inventory now
3. **Engage stakeholders**: Legal, finance, sustainability
4. **Select framework**: TCFD alignment
5. **Plan assurance**: Third-party verification

### Key Challenges

- Scope 3 data
- Assurance requirements
- Multi-state compliance

## Key Takeaways

- California leads US climate disclosure
- First US state to require Scope 3
- Significant penalties for non-compliance
- Affects companies nationally
- Implementation 2026
- Preparation essential now
`
  },
  {
    slug: "canadian-esg-regulations",
    title: "Canadian ESG Regulations",
    description: "Understanding Canada's ESG and climate disclosure requirements for businesses and investors.",
    keywords: "Canada,ESG,disclosure,climate,regulations",
    pillar: "Governance",
    section: "hk-apac",
    permalink: "/hk-apac/canadian-esg-regulations/",
    content: `## Overview

Canada has been active in developing ESG regulations, with climate disclosure requirements for both companies and financial institutions. The Canadian approach often mirrors EU regulations while adapting to the North American context.

## Federal Climate Disclosure

### Canadian Sustainability Standards Board (CSSB)

- Developing Canadian sustainability standards
- Aligned with ISSB standards
- Adoption expected 2024-2025

### ISSB Adoption

- Canada among early adopters
- ISSB standards as baseline
- Canadian-specific requirements possible

## Existing Requirements

### National Instrument 51-102

- MD&A disclosure of material risks
- Risk factors in annual filings
- Similar to US SEC rules

### National Instrument 81-102

- ESG fund disclosure requirements
- Naming and marketing rules
- Avoid misleading "green" names

## Climate-Related Disclosure

### Enhanced Requirements (Proposed)

- GHG emissions (Scope 1, 2, 3)
- Climate risks and opportunities
- Governance and strategy
- Metrics and targets

### Scope

- Public companies
- Listed issuers
- Large private companies

## Financial Sector Requirements

### Office of the Superintendent of Financial Institutions (OSFI)

- Climate risk management expectations
- Disclosure requirements
- Supervisory expectations

### Bank Act Amendments

- Climate risk considerations
- Due diligence requirements
- Consumer protection

## Provincial Developments

### British Columbia

- Climate change accountability
- Public sector reporting

### Quebec

- Carbon market
- Energy efficiency standards

### Ontario

- Cap and trade (previously)
- Climate disclosure (proposed)

## Carbon Pricing

### Federal Carbon Levy

- $65/tonne (2024)
- Rising to $170/tonne (2030)
- Applies where no provincial system

### Provincial Systems

- British Columbia carbon tax
- Quebec cap-and-trade
- Alberta carbon levy

## Practical Guidance

### For Companies

1. **Monitor CSSB standards**: Canadian ISSB adoption
2. **Prepare data**: GHG emissions inventory
3. **Assess governance**: Board oversight
4. **Engage advisors**: Legal and audit

### Timeline

- 2024-2025: CSSB standards adoption
- 2025-2026: Initial disclosures
- 2027+: Full implementation

## Key Takeaways

- Canada adopting ISSB standards
- Federal and provincial requirements
- Financial sector increasingly regulated
- Carbon pricing in place nationally
- Climate disclosure expanding
- International alignment priority
`
  },
  {
    slug: "us-climate-finance",
    title: "US Climate Finance Initiatives",
    description: "Understanding US government climate finance programs and incentives for clean energy and sustainability investments.",
    keywords: "US climate finance,IRA,clean energy,incentives,tax credits",
    pillar: "Environmental",
    section: "hk-apac",
    permalink: "/hk-apac/us-climate-finance/",
    content: `## Overview

The US has significantly expanded climate finance through the Inflation Reduction Act (IRA) and other programs. These initiatives provide substantial incentives for clean energy, decarbonization, and sustainable business practices.

## Inflation Reduction Act (IRA)

### Overview

- $369B in climate and energy investments
- Largest US climate investment ever
- Signed into law August 2022

### Key Provisions

#### Clean Energy Tax Credits

| Credit | Amount |
|--------|--------|
| Investment Tax Credit (ITC) | 30% (with bonuses up to 70%) |
| Production Tax Credit (PTC) | $0.03-0.06/kWh |
| Clean Hydrogen | Up to $3/kg |
| Advanced Manufacturing | 30-50% |

#### Clean Vehicle Credit

- $7,500 for new EVs
- $4,000 for used EVs
- Income and price limits

#### Building Efficiency

- Heat pump incentives
- Energy efficiency credits
- Commercial building upgrades

### Bonus Credits

- Domestic content: +10%
- Energy community: +10%
- Low-income community: +10-20%

## Other Programs

### Department of Energy (DOE)

- Loan Programs Office
- Clean Energy Demonstration Projects
- Manufacturing grants

### Environmental Protection Agency (EPA)

- Greenhouse Gas Reduction Fund
- Clean Ports Program
- Environmental justice grants

### State-Level Programs

- State energy programs
- Rebate programs
- Clean energy standards

## Business Implications

### Opportunities

- Significant cost reduction for clean energy
- Manufacturing incentives
- New markets for clean technology

### Requirements

- Domestic content
- Wage and apprenticeship
- Reporting and verification

## Implementation

### Tax Credit Transferability

- Companies can sell credits
- Direct pay for non-profits
- IRA benefits accessible

### Prevailing Wage & Apprenticeship

- Required for full credit value
- Training and hiring requirements
- Documentation needed

### Domestic Content

- Steel, iron, manufactured products
- Battery components
- Critical minerals

## Practical Guidance

### For Companies

1. **Assess eligibility**: Which credits apply?
2. **Plan projects**: Pre-IRA optimization
3. **Engage advisors**: Tax and legal
4. **Monitor guidance**: Evolving rules

### Key Considerations

- Stacking limitations
- Transferability rules
- Reporting requirements

## Key Takeaways

- IRA provides $369B in climate incentives
- Significant tax credits for clean energy
- Manufacturing incentives
- Compliance requirements apply
- Program guidance evolving
- Major opportunity for transformation
`
  },
  {
    slug: "north-american-carbon-markets",
    title: "North American Carbon Markets",
    description: "Overview of carbon pricing and emissions trading systems in North America, including US state markets and Canada.",
    keywords: "carbon market,North America,ETS,carbon pricing,RGGI",
    pillar: "Environmental",
    section: "hk-apac",
    permalink: "/hk-apac/north-american-carbon-markets/",
    content: `## Overview

North America has a fragmented but growing carbon pricing landscape. It includes federal and state programs, with significant variation between jurisdictions.

## US Federal

### EPA Authority

- Clean Air Act provides foundation
- Current GHG programs limited
- No comprehensive federal ETS

### California-Led Initiatives

- State programs influencing others
- Washington joining
- Potential for more states

## Regional Greenhouse Gas Initiative (RGGI)

### Overview

- Cap-and-trade for power sector
- First mandatory US market
- 11 Northeast/Mid-Atlantic states

### Coverage

- CO2 from power plants (>25 MW)
- ~50% of US power sector emissions
- ~500 million tonnes covered

### Price

- Allowances ~$13-15/tonne (2024)
- Lower than California/EU
- Limited stringency

## California Cap-and-Trade

### Overview

- Comprehensive cap-and-trade
- Covers ~80% of state emissions
- Most comprehensive US program

### Coverage

- Power sector
- Large industrial facilities
- Transportation fuels
- Natural gas

### Price

- $80-100+/tonne (2024)
- Higher than RGGI
- Stringent cap

## Washington State

### Cap-And-Invest Program

- Launched 2023
- Similar to California
- Phased implementation

## Canada Federal

### Carbon Pollution Pricing System

- Federal carbon levy
- $65/tonne (2024)
- Rising to $170/tonne (2030)

### Provincial Systems

- British Columbia carbon tax
- Quebec cap-and-trade
- Alberta carbon levy
- Ontario cap-and-trade

### Output-Based Pricing

- Output-based system for industry
- Free allocations
- Competitiveness protection

## Key Differences

| Market | Coverage | Price (2024) |
|--------|----------|--------------|
| California | ~80% state emissions | $80-100 |
| RGGI | Power sector only | $13-15 |
| Canada Federal | Broad (where no provincial) | $65 |
| Quebec | Provincial | $30-40 |

## Business Implications

### Multi-Jurisdictional

- Compliance complexity
- Planning challenges
- Cost variability

### Opportunities

- Market-based approach
- Flexibility
- Innovation incentives

## Practical Guidance

### For Companies

1. **Map exposure**: Which markets apply?
2. **Monitor prices**: Planning
3. **Plan compliance**: Allowances
4. **Engage policymakers**: Comments

### Trends

- More states expected
- Stringency increasing
- Potential federal action

## Key Takeaways

- North American carbon pricing fragmented
- California most comprehensive
- RGGI for Northeast
- Canada has federal + provinces
- Price variation significant
- Expansion expected
`
  }
];

async function main() {
  console.log("Adding more ESG Hub content to SurrealDB...");
  console.log(`Target: ${SURREAL_URL}`);
  console.log(`Namespace: ${SURREAL_NAMESPACE}, Database: ${SURREAL_DATABASE}`);
  console.log(`Articles to add: ${articles.length}\n`);

  let success = 0;
  let errors = 0;
  let skipped = 0;

  for (const article of articles) {
    try {
      const stmt = `CREATE page SET 
        slug = '${escapeSurrealString(article.slug)}',
        title = '${escapeSurrealString(article.title)}',
        description = '${escapeSurrealString(article.description)}',
        keywords = '${escapeSurrealString(article.keywords)}',
        pillar = '${escapeSurrealString(article.pillar)}',
        section = '${escapeSurrealString(article.section)}',
        permalink = '${escapeSurrealString(article.permalink)}',
        layout = 'article',
        content = '${escapeSurrealString(article.content)}'
      ;`;

      const results = await querySurreal(stmt);
      
      if (results[0]?.id) {
        success++;
        console.log(`✓ ${article.title} (${article.section})`);
      } else {
        errors++;
        console.log(`✗ ${article.title}: ${JSON.stringify(results[0])}`);
      }
    } catch (err) {
      errors++;
      console.log(`✗ ${article.title}: ${err.message}`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Successful: ${success}`);
  console.log(`Errors: ${errors}`);
  console.log(`Skipped (duplicates): ${skipped}`);
  console.log(`Total: ${articles.length}`);
}

main().catch(console.error);
