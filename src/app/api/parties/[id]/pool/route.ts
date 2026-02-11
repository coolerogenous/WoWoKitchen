import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/parties/[id]/pool - Host 添加菜品到备选池
 * body: { dishId: number } | { menuId: number }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
    try {
        const userId = getUserIdFromRequest(req);
        if (!userId) {
            return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
        }
        const { id } = await params;
        const partyId = Number(id);
        const body = await req.json();

        const party = await prisma.party.findFirst({
            where: { id: partyId, hostId: userId },
        });

        if (!party) {
            return NextResponse.json({ success: false, error: "饭局不存在或无权操作" }, { status: 404 });
        }

        if (party.status === "LOCKED") {
            return NextResponse.json({ success: false, error: "饭局已锁定" }, { status: 403 });
        }

        // 批量添加菜品逻辑
        let dishesToAdd: { id: number; name: string; ingredients: any[]; cost: number }[] = [];

        if (body.dishId) {
            const dish = await prisma.dish.findUnique({
                where: { id: body.dishId },
                include: { ingredients: { include: { ingredient: true } } },
            });
            if (dish && dish.userId === userId) {
                dishesToAdd.push({
                    id: dish.id,
                    name: dish.name,
                    ingredients: dish.ingredients,
                    cost: dish.estimatedCost
                });
            }
        } else if (body.menuId) {
            const menu = await prisma.menu.findUnique({
                where: { id: body.menuId },
                include: { dishes: { include: { dish: { include: { ingredients: { include: { ingredient: true } } } } } } },
            });
            if (menu && menu.userId === userId) {
                menu.dishes.forEach(md => {
                    dishesToAdd.push({
                        id: md.dish.id,
                        name: md.dish.name,
                        ingredients: md.dish.ingredients,
                        cost: md.dish.estimatedCost
                    });
                });
            }
        }

        if (dishesToAdd.length === 0) {
            return NextResponse.json({ success: false, error: "未找到有效的菜品" }, { status: 400 });
        }

        // 写入数据库
        const poolItems = [];
        for (const d of dishesToAdd) {
            const item = await prisma.partyDishPool.create({
                data: {
                    partyId,
                    dishName: d.name,
                    originalDishId: d.id,
                    costSnapshot: d.cost,
                    ingredientsSnapshot: JSON.stringify(d.ingredients.map(di => ({
                        name: di.ingredient.name,
                        quantity: di.quantity,
                        unit: di.unit,
                        unitPrice: di.ingredient.unitPrice,
                        spec: di.ingredient.spec
                    }))),
                }
            });
            poolItems.push(item);
        }

        return NextResponse.json({ success: true, data: poolItems });

    } catch (error) {
        console.error("添加菜品池失败:", error);
        return NextResponse.json({ success: false, error: "操作失败" }, { status: 500 });
    }
}

/**
 * DELETE /api/parties/[id]/pool - Host 移除菜品池中的菜
 * body: { poolDishId: number }
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
    try {
        const userId = getUserIdFromRequest(req);
        if (!userId) {
            return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
        }
        const { id } = await params;
        const partyId = Number(id);
        const body = await req.json();
        const { poolDishId } = body;

        const party = await prisma.party.findFirst({
            where: { id: partyId, hostId: userId },
        });

        if (!party) {
            return NextResponse.json({ success: false, error: "饭局不存在或无权操作" }, { status: 404 });
        }

        if (party.status === "LOCKED") {
            return NextResponse.json({ success: false, error: "饭局已锁定" }, { status: 403 });
        }

        await prisma.partyDishPool.delete({ where: { id: poolDishId } });

        return NextResponse.json({ success: true, data: { id: poolDishId } });
    } catch (error) {
        console.error("移除菜品池失败:", error);
        return NextResponse.json({ success: false, error: "操作失败" }, { status: 500 });
    }
}
