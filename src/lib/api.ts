const API_BASE = "";

/**
 * 通用 API 请求函数
 */
async function request<T>(
    url: string,
    options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
    const token =
        typeof window !== "undefined" ? localStorage.getItem("wk_token") : null;

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers,
    });

    const json = await res.json();
    return json;
}

// ==================== 认证 ====================
export const authApi = {
    register: (username: string, password: string) =>
        request<{ token: string; user: { id: number; username: string } }>(
            "/api/auth/register",
            { method: "POST", body: JSON.stringify({ username, password }) }
        ),

    login: (username: string, password: string) =>
        request<{ token: string; user: { id: number; username: string } }>(
            "/api/auth/login",
            { method: "POST", body: JSON.stringify({ username, password }) }
        ),
};

// ==================== 食材 ====================
export const ingredientApi = {
    list: () => request<Ingredient[]>("/api/ingredients"),

    create: (data: { name: string; unitPrice: number; spec: string }) =>
        request<Ingredient>("/api/ingredients", {
            method: "POST",
            body: JSON.stringify(data),
        }),

    update: (id: number, data: Partial<{ name: string; unitPrice: number; spec: string }>) =>
        request<Ingredient>(`/api/ingredients/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        }),

    delete: (id: number) =>
        request<{ id: number }>(`/api/ingredients/${id}`, { method: "DELETE" }),
};

// ==================== 菜品 ====================
export const dishApi = {
    list: () => request<Dish[]>("/api/dishes"),

    get: (id: number) => request<Dish>(`/api/dishes/${id}`),

    create: (data: {
        name: string;
        ingredients: { ingredientId: number; quantity: number; unit: string }[];
    }) =>
        request<Dish>("/api/dishes", {
            method: "POST",
            body: JSON.stringify(data),
        }),

    update: (
        id: number,
        data: {
            name?: string;
            ingredients?: { ingredientId: number; quantity: number; unit: string }[];
        }
    ) =>
        request<Dish>(`/api/dishes/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        }),

    delete: (id: number) =>
        request<{ id: number }>(`/api/dishes/${id}`, { method: "DELETE" }),
};

// ==================== 菜单 ====================
export const menuApi = {
    list: () => request<Menu[]>("/api/menus"),

    get: (id: number) => request<MenuDetail>(`/api/menus/${id}`),

    create: (data: { name: string; dishIds?: number[] }) =>
        request<Menu>("/api/menus", {
            method: "POST",
            body: JSON.stringify(data),
        }),

    update: (id: number, data: { name?: string; dishIds?: number[] }) =>
        request<Menu>(`/api/menus/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        }),

    delete: (id: number) =>
        request<{ id: number }>(`/api/menus/${id}`, { method: "DELETE" }),
};

// ==================== 分享码 (Share Token) ====================
export const shareApi = {
    create: (type: "DISH" | "MENU" | "PARTY", refId: number) =>
        request<{ code: string; type: string; refId: number }>("/api/share/create", {
            method: "POST",
            body: JSON.stringify({ type, refId }),
        }),

    get: (code: string) =>
        request<{
            type: "DISH" | "MENU" | "PARTY";
            id?: number; // for PARTY
            data?: any; // for DISH/MENU import data
        }>(`/api/share/${code}`),
};

// ==================== 密语 (Legacy / Internal Import) ====================
export const tokenApi = {
    decode: (token: string) =>
        request<{
            ingredientsCreated: number;
            ingredientsReused: number;
            dishesCreated: number;
            menuCreated: boolean;
            menuName: string;
        }>("/api/tokens/decode", {
            method: "POST",
            body: JSON.stringify({ token }),
        }),

    importData: (data: any) =>
        request<{
            ingredientsCreated: number;
            ingredientsReused: number;
            dishesCreated: number;
            menuCreated: boolean;
            menuName: string;
        }>("/api/tokens/decode", {
            method: "POST",
            body: JSON.stringify({ data }),
        }),
};

// ==================== 饭局 ====================
export const partyApi = {
    list: () => request<Party[]>("/api/parties"),

    get: (id: string | number) => request<PartyDetail>(`/api/parties/${id}`),

    create: (data: { name: string }) =>
        request<Party>("/api/parties", {
            method: "POST",
            body: JSON.stringify(data),
        }),

    delete: (id: number) =>
        request<{ id: number }>(`/api/parties/${id}`, { method: "DELETE" }),

    join: (id: string | number, nickname: string) =>
        request<{ guestId: number; guestToken: string; nickname: string; partyId: number }>(
            `/api/parties/${id}/join`,
            { method: "POST", body: JSON.stringify({ nickname }) }
        ),

    // Host: Add Dish/Menu to Pool
    addToPool: (id: number, data: { dishId?: number; menuId?: number }) =>
        request(`/api/parties/${id}/pool`, {
            method: "POST",
            body: JSON.stringify(data),
        }),

    // Host: Remove from Pool
    removeFromPool: (id: number, poolDishId: number) =>
        request(`/api/parties/${id}/pool`, {
            method: "DELETE",
            body: JSON.stringify({ poolDishId }),
        }),

    // Guest: Select/Unselect
    selectDish: (partyId: number, guestToken: string, poolDishId: number, action: "select" | "unselect") =>
        request(`/api/parties/${partyId}/select`, {
            method: "POST",
            body: JSON.stringify({ guestToken, poolDishId, action }),
        }),

    lock: (id: number, action: "lock" | "unlock") =>
        request(`/api/parties/${id}/lock`, {
            method: "PUT",
            body: JSON.stringify({ action }),
        }),

    export: (id: number) => request<PartyExport>(`/api/parties/${id}/export`),
};

// ==================== 类型定义 ====================
export interface Ingredient {
    id: number;
    name: string;
    unitPrice: number;
    spec: string;
    createdAt: string;
}

export interface DishIngredient {
    id: number;
    ingredientId: number;
    quantity: number;
    unit: string;
    ingredient: Ingredient;
}

export interface Dish {
    id: number;
    name: string;
    estimatedCost: number;
    ingredients: DishIngredient[];
    createdAt: string;
}

export interface MenuDishItem {
    id: number;
    dish: Dish;
}

export interface Menu {
    id: number;
    name: string;
    dishes: MenuDishItem[];
    createdAt: string;
}

export interface ShoppingListItem {
    ingredientId: number;
    name: string;
    unit: string;
    unitPrice: number;
    spec: string;
    totalQuantity: number;
    totalCost: number;
    fromDishes: string[];
}

export interface MenuDetail extends Menu {
    shoppingList: {
        items: ShoppingListItem[];
        totalCost: number;
        dishCount: number;
        generatedAt: string;
    };
}

export interface Party {
    id: number;
    name: string;
    status: string;
    shareCode: string;
    createdAt: string;
    // poolDishes: now in PartyDetail primarily, but listed here for list view counts
    _count?: { poolDishes: number; guests: number };
}

export interface PartyDishPoolItem {
    id: number;
    dishName: string;
    costSnapshot: number;
    selections: { guest: { id: number; nickname: string } }[];
}

export interface PartyDetail extends Party {
    host: { id: number; username: string };
    poolDishes: PartyDishPoolItem[];
    guests: { id: number; nickname: string; guestToken?: string }[];
}

export interface PartyExport {
    partyName: string;
    hostName: string;
    status: string;
    guestCount: number;
    guests: string[];
    dishes: { name: string; cost: number; selectedBy: string[] }[];
    shoppingList: {
        items: ShoppingListItem[];
        totalCost: number;
        dishCount: number;
        generatedAt: string;
    };
}
