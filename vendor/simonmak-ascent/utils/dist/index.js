import { clsx } from "clsx";
export function cn(...inputs) {
    return clsx(inputs);
}
export function truncate(str, length) {
    if (str.length <= length)
        return str;
    return str.slice(0, length) + "...";
}
export function slugify(str) {
    return str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
export function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
export function formatDate(date) {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}
export function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}
