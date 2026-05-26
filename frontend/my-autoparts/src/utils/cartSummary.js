const STORAGE_KEY = 'cart_summary_v1';

export function computeCartSummary(cart) {
    if (!cart) return { itemCount: 0, totalPrice: 0 };

    const newPartsCount =
        cart.new_parts_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
    const newPartsPrice =
        cart.new_parts_items?.reduce(
            (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
            0
        ) || 0;
    const usedPartsCount =
        cart.used_parts_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
    const usedPartsPrice =
        cart.used_parts_items?.reduce(
            (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
            0
        ) || 0;

    return {
        itemCount: newPartsCount + usedPartsCount,
        totalPrice: newPartsPrice + usedPartsPrice,
    };
}

export function loadCartSummaryCache() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { itemCount: 0, totalPrice: 0 };
        const parsed = JSON.parse(raw);
        return {
            itemCount: Math.max(0, Number(parsed.itemCount) || 0),
            totalPrice: Math.max(0, Number(parsed.totalPrice) || 0),
        };
    } catch {
        return { itemCount: 0, totalPrice: 0 };
    }
}

export function saveCartSummaryCache(summary) {
    try {
        if (!summary?.itemCount) {
            localStorage.removeItem(STORAGE_KEY);
            return;
        }
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                itemCount: summary.itemCount,
                totalPrice: summary.totalPrice,
            })
        );
    } catch {
        // ignore quota / private mode
    }
}

export function clearCartSummaryCache() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // ignore
    }
}
