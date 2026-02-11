import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { calculateDishCost } from "@/lib/calculation/aggregator";
import zlib from "zlib";

interface TokenIngredient {
    name: string;
    unitPrice: number;
    spec: string;
    quantity: number;
    unit: string;
}

interface TokenDish {
    name: string;
    ingredients: TokenIngredient[];
}

interface TokenPayload {
    type: "dish" | "menu";
    version: number;
    data: {
        name: string;
        ingredients?: TokenIngredient[];
        dishes?: TokenDish[];
    };
}

/**
 * POST /api/tokens/decode - 解码密语并导入数据
 * body: { token: string }
 */
export async function POST(req: NextRequest) {
    try {
        const userId = getUserIdFromRequest(req);
        if (!userId) {
            return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
        }

        const body = await req.json();
        const { token, data } = body;

        let payload: TokenPayload;

        if (data) {
            // 直接使用传入的数据
            payload = data;
        } else if (token && token.startsWith("WK:")) {
            // Base64 解码 → 解压 → 反序列化
            const base64Data = token.slice(3);
            try {
                const compressed = Buffer.from(base64Data, "base64");
                const jsonStr = zlib.inflateSync(compressed).toString("utf-8");
                payload = JSON.parse(jsonStr);
            } catch {
                return NextResponse.json(
                    { success: false, error: "密语解析失败，数据可能已损坏" },
                    { status: 400 }
                );
            }
        } else {
            return NextResponse.json(
                { success: false, error: "无效的请求参数" },
                { status: 400 }
            );
        }

        const importResult = {
            ingredientsCreated: 0,
            ingredientsReused: 0,
            dishesCreated: 0,
            menuCreated: false,
            menuName: "",
        };

        if (payload.type === "dish" && payload.data.ingredients) {
            const dish = await importDish(payload.data.name, payload.data.ingredients, userId);
            importResult.dishesCreated = 1;
            importResult.ingredientsCreated = dish.newIngredients;
            importResult.ingredientsReused = dish.reusedIngredients;
        } else if (payload.type === "menu" && payload.data.dishes) {
            const dishIds: number[] = [];
            for (const dishData of payload.data.dishes) {
                const dish = await importDish(dishData.name, dishData.ingredients, userId);
                dishIds.push(dish.dishId);
                importResult.dishesCreated++;
                importResult.ingredientsCreated += dish.newIngredients;
                importResult.ingredientsReused += dish.reusedIngredients;
            }

            await prisma.menu.create({
                data: {
                    name: payload.data.name,
                    userId,
                    dishes: { create: dishIds.map((dishId) => ({ dishId })) },
                },
            });
            importResult.menuCreated = true;
            importResult.menuName = payload.data.name;
        } else {
            return NextResponse.json(
                { success: false, error: "密语数据格式不正确" },
                { status: 400 }
            );
        }

        return NextResponse.json({ success: true, data: importResult });
    } catch (error) {
        console.error("解码密语失败:", error);
        return NextResponse.json(
            { success: false, error: "解码密语失败" },
            { status: 500 }
        );
    }
}

/**
 * 导入单道菜及其食材（含去重逻辑）
 */
async function importDish(
    dishName: string,
    ingredients: TokenIngredient[],
    userId: number
) {
    let newIngredients = 0;
    let reusedIngredients = 0;

    const dishIngredients: {
        ingredientId: number;
        quantity: number;
        unit: string;
        unitPrice: number;
    }[] = [];

    for (const ing of ingredients) {
        let ingredient = await prisma.ingredient.findUnique({
            where: { name_userId: { name: ing.name, userId } },
        });

        if (ingredient) {
            reusedIngredients++;
        } else {
            ingredient = await prisma.ingredient.create({
                data: { name: ing.name, unitPrice: ing.unitPrice, spec: ing.spec, userId },
            });
            newIngredients++;
        }

        dishIngredients.push({
            ingredientId: ingredient.id,
            quantity: ing.quantity,
            unit: ing.unit,
            unitPrice: ingredient.unitPrice,
        });
    }

    const estimatedCost = calculateDishCost(
        dishIngredients.map((di) => ({ quantity: di.quantity, unitPrice: di.unitPrice }))
    );

    let finalName = dishName;
    const existingDish = await prisma.dish.findFirst({
        where: { name: dishName, userId },
    });
    if (existingDish) {
        finalName = `${dishName}（导入）`;
    }

    const dish = await prisma.dish.create({
        data: {
            name: finalName,
            estimatedCost,
            userId,
            ingredients: {
                create: dishIngredients.map((di) => ({
                    ingredientId: di.ingredientId,
                    quantity: di.quantity,
                    unit: di.unit,
                })),
            },
        },
    });

    return { dishId: dish.id, newIngredients, reusedIngredients };
}
