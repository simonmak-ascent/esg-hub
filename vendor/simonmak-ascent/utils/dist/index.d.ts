import { type ClassValue } from "clsx";
export declare function cn(...inputs: ClassValue[]): string;
export declare function truncate(str: string, length: number): string;
export declare function slugify(str: string): string;
export declare function capitalize(str: string): string;
export declare function formatDate(date: Date | string): string;
export declare function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number): (...args: Parameters<T>) => void;
