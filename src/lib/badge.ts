// Text for the toolbar icon's badge: blank when a page has no notes
export function badgeText(count: number): string {
    if (count <= 0) return '';
    return count > 99 ? '99+' : String(count);
}
