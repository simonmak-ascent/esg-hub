import { z } from "zod";
export declare const EsgPageSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    permalink: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    section: z.ZodOptional<z.ZodString>;
    pillar: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
    keywords: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const EsgPageListItemSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    permalink: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    section: z.ZodOptional<z.ZodString>;
    pillar: z.ZodOptional<z.ZodString>;
    keywords: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const EsgResourceSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    url: z.ZodString;
    domain: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
    source_domain: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const EsgResourceListItemSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    url: z.ZodString;
    domain: z.ZodString;
    source_domain: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const PaginationSchema: z.ZodObject<{
    total: z.ZodNumber;
    limit: z.ZodNumber;
    offset: z.ZodNumber;
    has_more: z.ZodBoolean;
}, z.core.$strip>;
export declare const SearchResultItemSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    permalink: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    section: z.ZodOptional<z.ZodString>;
    source_domain: z.ZodOptional<z.ZodString>;
    relevance: z.ZodOptional<z.ZodNumber>;
    source_type: z.ZodString;
}, z.core.$strip>;
export declare const SearchResponseSchema: z.ZodObject<{
    query: z.ZodString;
    mode: z.ZodString;
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        permalink: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        section: z.ZodOptional<z.ZodString>;
        source_domain: z.ZodOptional<z.ZodString>;
        relevance: z.ZodOptional<z.ZodNumber>;
        source_type: z.ZodString;
    }, z.core.$strip>>;
    total: z.ZodNumber;
}, z.core.$strip>;
export declare const PagesListResponseSchema: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        permalink: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        section: z.ZodOptional<z.ZodString>;
        pillar: z.ZodOptional<z.ZodString>;
        keywords: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    pagination: z.ZodObject<{
        total: z.ZodNumber;
        limit: z.ZodNumber;
        offset: z.ZodNumber;
        has_more: z.ZodBoolean;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const PageDetailResponseSchema: z.ZodObject<{
    data: z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        permalink: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        section: z.ZodOptional<z.ZodString>;
        pillar: z.ZodOptional<z.ZodString>;
        content: z.ZodOptional<z.ZodString>;
        keywords: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ResourcesListResponseSchema: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        url: z.ZodString;
        domain: z.ZodString;
        source_domain: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    pagination: z.ZodObject<{
        total: z.ZodNumber;
        limit: z.ZodNumber;
        offset: z.ZodNumber;
        has_more: z.ZodBoolean;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const SectionSchema: z.ZodObject<{
    name: z.ZodString;
    page_count: z.ZodNumber;
}, z.core.$strip>;
export declare const PillarSchema: z.ZodObject<{
    name: z.ZodString;
    page_count: z.ZodNumber;
}, z.core.$strip>;
export declare const DomainSchema: z.ZodObject<{
    name: z.ZodString;
    resource_count: z.ZodNumber;
}, z.core.$strip>;
export declare const StatsSchema: z.ZodObject<{
    total_pages: z.ZodNumber;
    total_resources: z.ZodNumber;
    total_sections: z.ZodNumber;
    total_pillars: z.ZodNumber;
    total_domains: z.ZodNumber;
}, z.core.$strip>;
export declare const MetadataResponseSchema: z.ZodObject<{
    stats: z.ZodObject<{
        total_pages: z.ZodNumber;
        total_resources: z.ZodNumber;
        total_sections: z.ZodNumber;
        total_pillars: z.ZodNumber;
        total_domains: z.ZodNumber;
    }, z.core.$strip>;
    sections: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        page_count: z.ZodNumber;
    }, z.core.$strip>>;
    pillars: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        page_count: z.ZodNumber;
    }, z.core.$strip>>;
    domains: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        resource_count: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const SearchParamsSchema: z.ZodObject<{
    query: z.ZodString;
    limit: z.ZodDefault<z.ZodNumber>;
    source: z.ZodDefault<z.ZodEnum<{
        all: "all";
        pages: "pages";
        external: "external";
    }>>;
}, z.core.$strip>;
export declare const ListPagesParamsSchema: z.ZodObject<{
    section: z.ZodOptional<z.ZodString>;
    pillar: z.ZodOptional<z.ZodString>;
    query: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export declare const ListResourcesParamsSchema: z.ZodObject<{
    domain: z.ZodOptional<z.ZodString>;
    query: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type EsgPage = z.infer<typeof EsgPageSchema>;
export type EsgPageListItem = z.infer<typeof EsgPageListItemSchema>;
export type EsgResource = z.infer<typeof EsgResourceSchema>;
export type EsgResourceListItem = z.infer<typeof EsgResourceListItemSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;
export type SearchResultItem = z.infer<typeof SearchResultItemSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
export type PagesListResponse = z.infer<typeof PagesListResponseSchema>;
export type PageDetailResponse = z.infer<typeof PageDetailResponseSchema>;
export type ResourcesListResponse = z.infer<typeof ResourcesListResponseSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type Pillar = z.infer<typeof PillarSchema>;
export type Domain = z.infer<typeof DomainSchema>;
export type Stats = z.infer<typeof StatsSchema>;
export type MetadataResponse = z.infer<typeof MetadataResponseSchema>;
export type SearchParams = z.infer<typeof SearchParamsSchema>;
export type ListPagesParams = z.infer<typeof ListPagesParamsSchema>;
export type ListResourcesParams = z.infer<typeof ListResourcesParamsSchema>;
export declare function validateSearchParams(params: unknown): z.ZodSafeParseResult<{
    query: string;
    limit: number;
    source: "all" | "pages" | "external";
}>;
export declare function validateListPagesParams(params: unknown): z.ZodSafeParseResult<{
    limit: number;
    offset: number;
    section?: string | undefined;
    pillar?: string | undefined;
    query?: string | undefined;
}>;
export declare function validateListResourcesParams(params: unknown): z.ZodSafeParseResult<{
    limit: number;
    offset: number;
    domain?: string | undefined;
    query?: string | undefined;
}>;
export declare function validatePageDetail(data: unknown): z.ZodSafeParseResult<{
    data: {
        id: string;
        title: string;
        permalink: string;
        description?: string | undefined;
        section?: string | undefined;
        pillar?: string | undefined;
        content?: string | undefined;
        keywords?: string | undefined;
    };
}>;
export declare function validateSearchResponse(data: unknown): z.ZodSafeParseResult<{
    query: string;
    mode: string;
    data: {
        id: string;
        title: string;
        source_type: string;
        permalink?: string | undefined;
        url?: string | undefined;
        description?: string | undefined;
        section?: string | undefined;
        source_domain?: string | undefined;
        relevance?: number | undefined;
    }[];
    total: number;
}>;
export declare function validatePagesList(data: unknown): z.ZodSafeParseResult<{
    data: {
        id: string;
        title: string;
        permalink: string;
        description?: string | undefined;
        section?: string | undefined;
        pillar?: string | undefined;
        keywords?: string | undefined;
    }[];
    pagination: {
        total: number;
        limit: number;
        offset: number;
        has_more: boolean;
    };
}>;
export declare function validateResourcesList(data: unknown): z.ZodSafeParseResult<{
    data: {
        id: string;
        title: string;
        url: string;
        domain: string;
        description?: string | undefined;
        source_domain?: string | undefined;
    }[];
    pagination: {
        total: number;
        limit: number;
        offset: number;
        has_more: boolean;
    };
}>;
export declare function validateMetadata(data: unknown): z.ZodSafeParseResult<{
    stats: {
        total_pages: number;
        total_resources: number;
        total_sections: number;
        total_pillars: number;
        total_domains: number;
    };
    sections: {
        name: string;
        page_count: number;
    }[];
    pillars: {
        name: string;
        page_count: number;
    }[];
    domains: {
        name: string;
        resource_count: number;
    }[];
}>;
