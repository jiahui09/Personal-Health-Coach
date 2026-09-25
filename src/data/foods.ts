/**
 * Food Database & Meal Templates (V3 Curated)
 * 
 * Strict boundary:
 * - Approximately 60 common whole foods.
 * - Accurate macronutrients, dietary fiber, and sodium per typical edible serving.
 * - Meal templates combining whole protein + whole grains/starches + vegetables.
 */

import { FoodItem } from '../types/health';

export const COMMON_FOOD_DATABASE: FoodItem[] = [
  // Protein sources
  { id: 'f-chicken-breast', name: '鸡胸肉 (熟)', foodGroup: 'protein', serving: '120g', calories: 198, protein: 37, carbs: 0, fat: 4.3, fiber: 0, sodium: 88 },
  { id: 'f-chicken-thigh', name: '去皮鸡腿肉 (熟)', foodGroup: 'protein', serving: '130g', calories: 232, protein: 32, carbs: 0, fat: 10.8, fiber: 0, sodium: 110 },
  { id: 'f-salmon', name: '三文鱼柳 (煎)', foodGroup: 'protein', serving: '130g', calories: 268, protein: 30, carbs: 0, fat: 15.5, fiber: 0, sodium: 75 },
  { id: 'f-tilapia-cod', name: '鳕鱼 / 龙利鱼柳 (蒸)', foodGroup: 'protein', serving: '140g', calories: 125, protein: 26, carbs: 0, fat: 1.6, fiber: 0, sodium: 120 },
  { id: 'f-beef-lean', name: '瘦牛肉 (牛里脊)', foodGroup: 'protein', serving: '120g', calories: 205, protein: 32, carbs: 0, fat: 7.8, fiber: 0, sodium: 70 },
  { id: 'f-shrimp', name: '鲜虾仁 (白灼)', foodGroup: 'protein', serving: '130g', calories: 130, protein: 28, carbs: 1.2, fat: 1.5, fiber: 0, sodium: 190 },
  { id: 'f-egg-whole', name: '全鸡蛋 (煮)', foodGroup: 'protein', serving: '2个 (100g)', calories: 143, protein: 12.6, carbs: 0.8, fat: 9.5, fiber: 0, sodium: 140 },
  { id: 'f-egg-white', name: '蛋白液 / 鸡蛋白', foodGroup: 'protein', serving: '100g', calories: 52, protein: 11, carbs: 0.7, fat: 0.2, fiber: 0, sodium: 166 },
  { id: 'f-tofu-firm', name: '老豆腐 / 北豆腐', foodGroup: 'legume', serving: '150g', calories: 147, protein: 15.2, carbs: 3.8, fat: 8.5, fiber: 2.1, sodium: 15 },
  { id: 'f-edamame', name: '毛豆仁', foodGroup: 'legume', serving: '100g', calories: 122, protein: 11.9, carbs: 9.9, fat: 5.2, fiber: 5.2, sodium: 6 },
  { id: 'f-tempeh', name: '天贝 (大豆发酵)', foodGroup: 'legume', serving: '100g', calories: 192, protein: 20.3, carbs: 7.6, fat: 10.8, fiber: 4.8, sodium: 9 },
  { id: 'f-tuna-canned', name: '水浸金枪鱼罐头', foodGroup: 'protein', serving: '120g', calories: 132, protein: 29, carbs: 0, fat: 1.2, fiber: 0, sodium: 320 },
  
  // Whole grains & healthy starches
  { id: 'f-brown-rice', name: '熟糙米饭', foodGroup: 'grain', serving: '150g', calories: 168, protein: 3.8, carbs: 35.5, fat: 1.4, fiber: 2.4, sodium: 2 },
  { id: 'f-white-rice', name: '熟白米饭', foodGroup: 'grain', serving: '150g', calories: 195, protein: 4.1, carbs: 42.5, fat: 0.4, fiber: 0.6, sodium: 2 },
  { id: 'f-quinoa', name: '熟藜麦', foodGroup: 'grain', serving: '150g', calories: 180, protein: 6.6, carbs: 32.0, fat: 2.9, fiber: 4.2, sodium: 10 },
  { id: 'f-rolled-oats', name: '传统生燕麦片', foodGroup: 'grain', serving: '50g', calories: 190, protein: 6.8, carbs: 34.0, fat: 3.2, fiber: 5.1, sodium: 3 },
  { id: 'f-sweet-potato', name: '蒸红薯 / 紫薯', foodGroup: 'grain', serving: '180g', calories: 155, protein: 2.8, carbs: 36.0, fat: 0.2, fiber: 5.4, sodium: 70 },
  { id: 'f-potato-boiled', name: '煮土豆 (带皮)', foodGroup: 'grain', serving: '180g', calories: 156, protein: 3.6, carbs: 35.5, fat: 0.2, fiber: 3.8, sodium: 12 },
  { id: 'f-corn', name: '甜玉米段', foodGroup: 'grain', serving: '150g', calories: 140, protein: 4.8, carbs: 29.0, fat: 2.0, fiber: 3.6, sodium: 22 },
  { id: 'f-whole-wheat-bread', name: '全麦面包', foodGroup: 'grain', serving: '2片 (70g)', calories: 175, protein: 7.2, carbs: 31.0, fat: 2.2, fiber: 4.2, sodium: 240 },
  { id: 'f-buckwheat-noodle', name: '纯荞麦面 (熟)', foodGroup: 'grain', serving: '160g', calories: 160, protein: 5.4, carbs: 34.2, fat: 0.8, fiber: 3.5, sodium: 15 },
  { id: 'f-lentils', name: '煮小扁豆', foodGroup: 'legume', serving: '150g', calories: 174, protein: 13.5, carbs: 29.8, fat: 0.6, fiber: 11.8, sodium: 4 },
  { id: 'f-chickpeas', name: '煮鹰嘴豆', foodGroup: 'legume', serving: '140g', calories: 230, protein: 12.4, carbs: 38.0, fat: 3.6, fiber: 10.4, sodium: 14 },

  // Vegetables (high volume, micronutrients, potassium, fiber)
  { id: 'f-broccoli', name: '清炒/蒸西兰花', foodGroup: 'vegetable', serving: '150g', calories: 52, protein: 4.2, carbs: 10.0, fat: 0.6, fiber: 3.9, sodium: 50 },
  { id: 'f-spinach', name: '焯水菠菜', foodGroup: 'vegetable', serving: '150g', calories: 35, protein: 4.4, carbs: 5.4, fat: 0.6, fiber: 3.3, sodium: 120 },
  { id: 'f-pak-choi', name: '清炒小白菜 / 油菜', foodGroup: 'vegetable', serving: '160g', calories: 30, protein: 2.4, carbs: 4.0, fat: 0.8, fiber: 2.2, sodium: 80 },
  { id: 'f-asparagus', name: '烤芦笋', foodGroup: 'vegetable', serving: '120g', calories: 28, protein: 2.8, carbs: 4.8, fat: 0.3, fiber: 2.5, sodium: 15 },
  { id: 'f-green-beans', name: '四季豆 / 扁豆', foodGroup: 'vegetable', serving: '120g', calories: 42, protein: 2.2, carbs: 8.4, fat: 0.4, fiber: 3.8, sodium: 8 },
  { id: 'f-carrot', name: '炖胡萝卜片', foodGroup: 'vegetable', serving: '100g', calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2, fiber: 2.8, sodium: 69 },
  { id: 'f-bell-pepper', name: '彩椒条', foodGroup: 'vegetable', serving: '120g', calories: 31, protein: 1.2, carbs: 7.2, fat: 0.4, fiber: 2.5, sodium: 5 },
  { id: 'f-tomato', name: '生西红柿 / 番茄', foodGroup: 'vegetable', serving: '150g', calories: 27, protein: 1.3, carbs: 5.8, fat: 0.3, fiber: 1.8, sodium: 8 },
  { id: 'f-cucumber', name: '鲜黄瓜', foodGroup: 'vegetable', serving: '150g', calories: 22, protein: 1.0, carbs: 4.8, fat: 0.2, fiber: 1.0, sodium: 3 },
  { id: 'f-mushroom', name: '口蘑 / 香菇 (炒)', foodGroup: 'vegetable', serving: '120g', calories: 45, protein: 3.6, carbs: 6.8, fat: 1.2, fiber: 3.0, sodium: 40 },
  { id: 'f-cabbage', name: '手撕圆白菜 / 卷心菜', foodGroup: 'vegetable', serving: '150g', calories: 38, protein: 1.9, carbs: 8.7, fat: 0.2, fiber: 3.8, sodium: 27 },

  // Fruits
  { id: 'f-banana', name: '中等香蕉', foodGroup: 'fruit', serving: '1根 (115g)', calories: 105, protein: 1.3, carbs: 27.0, fat: 0.3, fiber: 3.1, sodium: 1 },
  { id: 'f-apple', name: '苹果 (带皮)', foodGroup: 'fruit', serving: '1个 (180g)', calories: 95, protein: 0.5, carbs: 25.0, fat: 0.3, fiber: 4.4, sodium: 2 },
  { id: 'f-blueberries', name: '新鲜蓝莓', foodGroup: 'fruit', serving: '100g', calories: 57, protein: 0.7, carbs: 14.5, fat: 0.3, fiber: 2.4, sodium: 1 },
  { id: 'f-orange', name: '橙子', foodGroup: 'fruit', serving: '1个 (140g)', calories: 66, protein: 1.3, carbs: 16.0, fat: 0.2, fiber: 3.4, sodium: 1 },
  { id: 'f-kiwi', name: '猕猴桃 / 奇异果', foodGroup: 'fruit', serving: '1个 (75g)', calories: 46, protein: 0.8, carbs: 11.0, fat: 0.4, fiber: 2.3, sodium: 2 },

  // Dairy & Unsweetened plant milk
  { id: 'f-milk-skim', name: '低脂牛奶', foodGroup: 'dairy', serving: '250ml', calories: 115, protein: 8.5, carbs: 12.5, fat: 2.5, fiber: 0, sodium: 115 },
  { id: 'f-greek-yogurt', name: '无糖希腊酸奶', foodGroup: 'dairy', serving: '150g', calories: 105, protein: 16.0, carbs: 5.5, fat: 1.5, fiber: 0, sodium: 55 },
  { id: 'f-soy-milk', name: '纯无糖豆浆', foodGroup: 'dairy', serving: '250ml', calories: 85, protein: 7.5, carbs: 4.5, fat: 3.8, fiber: 1.2, sodium: 45 },
  { id: 'f-cottage-cheese', name: '低脂卡特基奶酪', foodGroup: 'dairy', serving: '120g', calories: 98, protein: 14.0, carbs: 3.8, fat: 2.2, fiber: 0, sodium: 380 },

  // Quality fats & Seeds
  { id: 'f-olive-oil', name: '特级初榨橄榄油', foodGroup: 'fat', serving: '10g (1汤匙)', calories: 88, protein: 0, carbs: 0, fat: 10.0, fiber: 0, sodium: 0 },
  { id: 'f-almonds', name: '原味巴旦木 / 杏仁', foodGroup: 'fat', serving: '20g', calories: 116, protein: 4.2, carbs: 4.3, fat: 10.0, fiber: 2.5, sodium: 1 },
  { id: 'f-walnuts', name: '核桃仁', foodGroup: 'fat', serving: '20g', calories: 131, protein: 3.0, carbs: 2.7, fat: 13.0, fiber: 1.4, sodium: 0 },
  { id: 'f-chia-seeds', name: '奇亚籽', foodGroup: 'fat', serving: '15g', calories: 73, protein: 2.5, carbs: 6.3, fat: 4.6, fiber: 5.1, sodium: 2 },
  { id: 'f-avocado', name: '牛油果', foodGroup: 'fat', serving: '60g (约半个)', calories: 96, protein: 1.2, carbs: 5.1, fat: 9.0, fiber: 4.0, sodium: 4 },
];

export interface MealTemplate {
  id: string;
  name: string;
  description: string;
  foodIds: string[];
  approxCalories: number;
  approxProtein: number;
  bestFitGoal: 'fat loss' | 'maintain' | 'muscle gain';
  suitabilityTime: 'lunch' | 'dinner' | 'breakfast' | 'any';
}

export const MEAL_TEMPLATES: MealTemplate[] = [
  {
    id: 'tpl-chicken-rice-veg',
    name: '鸡胸肉 · 糙米饭 · 西兰花',
    description: '经典的瘦蛋白与全谷物组合，兼具饱腹感与高密度微量元素。',
    foodIds: ['f-chicken-breast', 'f-brown-rice', 'f-broccoli', 'f-olive-oil'],
    approxCalories: 506,
    approxProtein: 45,
    bestFitGoal: 'fat loss',
    suitabilityTime: 'any',
  },
  {
    id: 'tpl-egg-tofu-rice-veg',
    name: '鸡蛋 · 老豆腐 · 糙米饭 · 小白菜',
    description: '优质蛋豆双蛋白平衡，搭配全谷物与绿叶菜，易于消化与肠道微生态。',
    foodIds: ['f-egg-whole', 'f-tofu-firm', 'f-brown-rice', 'f-pak-choi'],
    approxCalories: 488,
    approxProtein: 36,
    bestFitGoal: 'fat loss',
    suitabilityTime: 'any',
  },
  {
    id: 'tpl-fish-potato-veg',
    name: '鳕鱼柳 · 煮土豆 · 芦笋与彩椒',
    description: '低脂肪高蛋白海产，搭配高饱腹指数带皮土豆与富含抗氧化物的彩椒。',
    foodIds: ['f-tilapia-cod', 'f-potato-boiled', 'f-asparagus', 'f-bell-pepper', 'f-olive-oil'],
    approxCalories: 428,
    approxProtein: 34,
    bestFitGoal: 'fat loss',
    suitabilityTime: 'dinner',
  },
  {
    id: 'tpl-oats-milk-egg-fruit',
    name: '燕麦粥 · 温牛奶 · 煮鸡蛋 · 蓝莓',
    description: '全谷物慢碳水搭配天然奶蛋蛋白与多酚浆果，提供稳定的晨间精力。',
    foodIds: ['f-rolled-oats', 'f-milk-skim', 'f-egg-whole', 'f-blueberries'],
    approxCalories: 505,
    approxProtein: 28,
    bestFitGoal: 'maintain',
    suitabilityTime: 'breakfast',
  },
  {
    id: 'tpl-salmon-quinoa-spinach',
    name: '三文鱼 · 藜麦 · 菠菜与牛油果',
    description: '富含优质 Omega-3 必需脂肪酸与全蛋白质藜麦，支持细胞膜健康与关节抗炎。',
    foodIds: ['f-salmon', 'f-quinoa', 'f-spinach', 'f-avocado'],
    approxCalories: 579,
    approxProtein: 42,
    bestFitGoal: 'maintain',
    suitabilityTime: 'lunch',
  },
  {
    id: 'tpl-beef-sweetpotato-greens',
    name: '瘦牛肉 · 蒸红薯 · 四季豆',
    description: '富含高生物价血红素铁与锌，支持抗阻训练后的肌肉合成与结缔组织修复。',
    foodIds: ['f-beef-lean', 'f-sweet-potato', 'f-green-beans', 'f-olive-oil'],
    approxCalories: 490,
    approxProtein: 37,
    bestFitGoal: 'fat loss',
    suitabilityTime: 'any',
  },
  {
    id: 'tpl-shrimp-buckwheat-salad',
    name: '白灼鲜虾仁 · 荞麦面 · 黄瓜与小番茄',
    description: '高蛋白极清爽搭配，低钠饱腹，适合午间快速补给或晚间轻食。',
    foodIds: ['f-shrimp', 'f-buckwheat-noodle', 'f-cucumber', 'f-tomato', 'f-olive-oil'],
    approxCalories: 427,
    approxProtein: 36,
    bestFitGoal: 'fat loss',
    suitabilityTime: 'any',
  },
  {
    id: 'tpl-greek-yogurt-chia-fruit',
    name: '希腊酸奶 · 奇亚籽 · 香蕉与巴旦木',
    description: '慢消化酪蛋白与高水溶性膳食纤维，适合作轻加餐或高蛋白能量恢复。',
    foodIds: ['f-greek-yogurt', 'f-chia-seeds', 'f-banana', 'f-almonds'],
    approxCalories: 400,
    approxProtein: 24,
    bestFitGoal: 'fat loss',
    suitabilityTime: 'any',
  },
];
