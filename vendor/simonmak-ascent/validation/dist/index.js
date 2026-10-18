import { z } from "zod";
export const EsgPageSchema = z.object({
    id: z.string(),
    title: z.string(),
    permalink: z.string(),
    description: z.string().optional(),
    section: z.string().optional(),
    pillar: z.string().optional(),
    content: z.string().optional(),
    keywords: z.string().optional(),
});
export const EsgPageListItemSchema = EsgPageSchema.omit({
    content: true,
});
export const EsgResourceSchema = z.object({
    id: z.string(),
    title: z.string(),
    url: z.string(),
    domain: z.string(),
    description: z.string().optional(),
    content: z.string().optional(),
    source_domain: z.string().optional(),
});
export const EsgResourceListItemSchema = EsgResourceSchema.omit({
    content: true,
});
export const PaginationSchema = z.object({
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    has_more: z.boolean(),
});
export const SearchResultItemSchema = z.object({
    id: z.string(),
    title: z.string(),
    permalink: z.string().optional(),
    url: z.string().optional(),
    description: z.string().optional(),
    section: z.string().optional(),
    source_domain: z.string().optional(),
    relevance: z.number().optional(),
    source_type: z.string(),
});
export const SearchResponseSchema = z.object({
    query: z.string(),
    mode: z.string(),
    data: z.array(SearchResultItemSchema),
    total: z.number(),
});
export const PagesListResponseSchema = z.object({
    data: z.array(EsgPageListItemSchema),
    pagination: PaginationSchema,
});
export const PageDetailResponseSchema = z.object({
    data: EsgPageSchema,
});
export const ResourcesListResponseSchema = z.object({
    data: z.array(EsgResourceListItemSchema),
    pagination: PaginationSchema,
});
export const SectionSchema = z.object({
    name: z.string(),
    page_count: z.number(),
});
export const PillarSchema = z.object({
    name: z.string(),
    page_count: z.number(),
});
export const DomainSchema = z.object({
    name: z.string(),
    resource_count: z.number(),
});
export const StatsSchema = z.object({
    total_pages: z.number(),
    total_resources: z.number(),
    total_sections: z.number(),
    total_pillars: z.number(),
    total_domains: z.number(),
});
export const MetadataResponseSchema = z.object({
    stats: StatsSchema,
    sections: z.array(SectionSchema),
    pillars: z.array(PillarSchema),
    domains: z.array(DomainSchema),
});
export const SearchParamsSchema = z.object({
    query: z.string(),
    limit: z.number().min(1).max(50).default(10),
    source: z.enum(["all", "pages", "external"]).default("all"),
});
export const ListPagesParamsSchema = z.object({
    section: z.string().optional(),
    pillar: z.string().optional(),
    query: z.string().optional(),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
});
export const ListResourcesParamsSchema = z.object({
    domain: z.string().optional(),
    query: z.string().optional(),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
});
export function validateSearchParams(params) {
    return SearchParamsSchema.safeParse(params);
}
export function validateListPagesParams(params) {
    return ListPagesParamsSchema.safeParse(params);
}
export function validateListResourcesParams(params) {
    return ListResourcesParamsSchema.safeParse(params);
}
export function validatePageDetail(data) {
    return PageDetailResponseSchema.safeParse(data);
}
export function validateSearchResponse(data) {
    return SearchResponseSchema.safeParse(data);
}
export function validatePagesList(data) {
    return PagesListResponseSchema.safeParse(data);
}
export function validateResourcesList(data) {
    return ResourcesListResponseSchema.safeParse(data);
}
export function validateMetadata(data) {
    return MetadataResponseSchema.safeParse(data);
}
