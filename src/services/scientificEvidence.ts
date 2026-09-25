/**
 * Scientific Evidence Registry (V3 Audited)
 *
 * Strict separation of scientific evidence vs engineering rules:
 * - Evidence provides findings, systematic review observations, or foundational formulas.
 * - Computable rules translate scientific constraints into application decisions.
 * - Engineering heuristics translate constraints into concrete interface items.
 *
 * Only validated core sources retained (No fake DOIs, no unverified papers):
 * 1. Mifflin et al., 1990 (RMR prediction equation)
 * 2. Morton et al., 2018 (Protein meta-analysis & meta-regression)
 * 3. Schoenfeld & Aragon, 2018 (Per-meal protein practical review)
 * 4. WHO Guidelines, 2020 (Physical activity & muscle strengthening framework)
 * 5. ACSM Position Stand, 2026 (Resistance training prescription overview of reviews)
 * 6. WHO Healthy Diet Principles, 2020 (Whole grains, fruits/veg, sodium, fats)
 * 7. Dietary Guidelines for Americans, 2025–2030 (Diet quality & whole foods pattern)
 * 8. AASM/SRS Consensus (Watson et al., 2015) (Adult sleep duration >= 7 hours)
 * 9. Hall et al., 2011 (Lancet / NIH Body Weight Planner - Dynamic energy balance)
 * 10. Helms et al., 2016 (RIR/RPE autoregulation auxiliary framework)
 */

import { EvidenceReference } from '../types/health';

export const SCIENTIFIC_EVIDENCE_REGISTRY: Record<string, EvidenceReference> = {
  'mifflin-1990': {
    id: 'mifflin-1990',
    title: 'A new predictive equation for resting energy expenditure in healthy individuals',
    authors: 'Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA, Koh YO',
    organization: 'American Journal of Clinical Nutrition (AJCN)',
    year: 1990,
    sourceType: 'prediction_equation',
    topic: 'metabolism',
    claim: '静息代谢率 (RMR) 可通过体重(kg)、身高(cm)及年龄使用预测方程进行群体估算：男性 10W + 6.25H - 5A + 5，女性 10W + 6.25H - 5A - 161。平均个体预测误差在 ±10% 以内。',
    limitations: '预测方程存在个体偏差；不能代表实测静息能耗；不能单独等同于日总能耗 (TDEE)，日常活动消耗须作为工程估计参数结合。',
    url: 'https://pubmed.ncbi.nlm.nih.gov/2305711/',
  },

  'morton-2018': {
    id: 'morton-2018',
    title: 'A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training adaptations',
    authors: 'Morton RW, Murphy KT, McKellar SR, et al.',
    organization: 'British Journal of Sports Medicine (BJSM)',
    year: 2018,
    sourceType: 'systematic_review_meta_analysis',
    topic: 'nutrition',
    claim: '系统综述、荟萃分析与Meta回归表明，在抗阻训练背景下，每日蛋白质总摄入量在群体层面观察到约 1.62 g/kg/day (95% CI: 1.03–2.20) 为去脂体重增长边际增益拐点。常用 1.4–2.0 g/kg/day 作为实践约束区间。',
    limitations: '基于群体统计观察，不能断言 1.6 g/kg 是每个个体的唯一绝对最优值；个体需求受总能量赤字深度、训练强度与胃肠耐受度影响。',
    url: 'https://bjsm.bmj.com/content/52/6/376',
  },

  'schoenfeld-2018': {
    id: 'schoenfeld-2018',
    title: 'How much protein can the body use in a single meal for muscle-building? Implications for daily distribution',
    authors: 'Schoenfeld BJ, Aragon AA',
    organization: 'Journal of the International Society of Sports Nutrition (JISSN)',
    year: 2018,
    sourceType: 'review_practical_recommendation',
    topic: 'nutrition',
    claim: '文献综述提出实用性建议：为兼顾单次肌肉蛋白质合成 (MPS) 与全天摄入耐受，单餐推荐约 0.40–0.55 g/kg 高质量蛋白质（每餐约 25–45g），分 3–4 餐摄入为合理参考范式。',
    limitations: '属于基于急性生理动力学所提出的实用建议 (practical recommendation)，而非硬终点 RCT 验证的绝对阈值；单餐高于该量仍有全身氮留存与组织更新价值。',
    url: 'https://jissn.biomedcentral.com/articles/10.1186/s12970-018-0215-1',
  },

  'who-2020': {
    id: 'who-2020',
    title: 'WHO Guidelines on Physical Activity and Sedentary Behaviour',
    organization: 'World Health Organization (WHO)',
    year: 2020,
    sourceType: 'public_health_guideline',
    topic: 'exercise',
    claim: '成年人每周应至少累积 150–300 分钟中等强度有氧活动（或 75–150 分钟高强度活动），且每周至少有 2 天进行涵盖主要肌群的抗阻强化训练，以保持心肺代谢与肌肉骨骼机能。',
    limitations: '为宏观公共卫生生活方式框架，不包含徒手动作组次数或递增阶梯；徒手自重循环的动作搭配依赖专业运动处方与工程翻译。',
    url: 'https://www.who.int/publications/i/item/9789240015128',
  },

  'acsm-2026': {
    id: 'acsm-2026',
    title: 'Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews',
    organization: 'American College of Sports Medicine (ACSM)',
    year: 2026,
    sourceType: 'position_stand',
    topic: 'exercise',
    claim: '证实渐进式抗阻训练 (Progressive Resistance Training) 通过运动单位募集、接近力竭机械张力与渐进容量/难度刺激，能有效强化肌力与去脂体重。多关节复合自重动作（深蹲、俯卧撑、臀桥等）是基础有效的抗阻载体。',
    limitations: 'ACSM 确立渐进原则（重复次数、组数、难度进阶），并不特指某套单一固化程序；具体动作级数递增为工程实现。',
    url: 'https://www.acsm.org',
  },

  'who-diet-2020': {
    id: 'who-diet-2020',
    title: 'WHO Healthy Diet Fact Sheet and Guidelines',
    organization: 'World Health Organization (WHO)',
    year: 2020,
    sourceType: 'public_health_guideline',
    topic: 'nutrition',
    claim: '健康饮食基本原则：每日至少 400g (约 5 份) 蔬菜与水果；全谷物与豆类作为主食核心；游离糖摄入低于总能量 10% (最好低于 5%)；脂肪摄入以不饱和脂肪酸为主；每日钠摄入低于 2000mg (约 5g 盐)。',
    limitations: '属于宏观膳食质量约束指标，用于排除极端饮食偏离，不用于微观卡路里精确逐克约束。',
    url: 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet',
  },

  'dga-2025': {
    id: 'dga-2025',
    title: 'Dietary Guidelines for Americans 2025–2030',
    organization: 'U.S. Department of Agriculture (USDA) & HHS',
    year: 2025,
    sourceType: 'public_health_guideline',
    topic: 'nutrition',
    claim: '强调以全食物 (Nutrient-dense whole foods) 为核心的长期饮食模式：鼓励多样化绿叶蔬菜、优质瘦肉与豆类水产、高纤维全谷物及坚果，限制超加工食品与精制糖盐添加。',
    limitations: '注重饮食模式整体健康度与慢性病预防，个体具体卡路里与宏量比例仍需根据体能目标调整。',
    url: 'https://www.dietaryguidelines.gov/',
  },

  'aasm-2015': {
    id: 'aasm-2015',
    title: 'Recommended Amount of Sleep for a Healthy Adult: A Consensus Statement of the American Academy of Sleep Medicine and Sleep Research Society',
    authors: 'Watson NF, Badr MS, Belenky G, et al.',
    organization: 'American Academy of Sleep Medicine (AASM) & Sleep Research Society (SRS)',
    year: 2015,
    sourceType: 'public_health_guideline',
    topic: 'sleep',
    claim: '健康成年人规律获得每日 7 小时或以上的睡眠，对促进最佳健康（心血管机能、神经认知恢复、代谢调节与免疫稳态）至关重要。',
    limitations: '7 小时为成年人群体中位数指导基准；个体因基因型与日常体力劳累程度存在一定自然睡眠需求区间波动。',
    url: 'https://academic.oup.com/sleep/article/38/6/843/2416939',
  },

  'hall-2011': {
    id: 'hall-2011',
    title: 'Quantification of the effect of energy imbalance on bodyweight',
    authors: 'Hall KD, Sacks G, Chandramohan D, et al.',
    organization: 'The Lancet (NIH Body Weight Planner Foundations)',
    year: 2011,
    sourceType: 'dynamic_energy_model',
    topic: 'metabolism',
    claim: '人体对能量不平衡的反应是动态非线性的：体重改变会引起静息能耗与活动消耗的自适应反馈（瘦体重与脂肪组织的动态消长）。否定了静态 3500 kcal = 1 lb 的恒定线性规则，提出区间预测与动态校准。',
    limitations: '模型揭示动态适应机制，但在个人轻量手账中，短期预测依然受水分储留、糖原波动及钠摄入的急性扰动。',
    url: 'https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(11)60815-4/fulltext',
  },

  'helms-2016': {
    id: 'helms-2016',
    title: 'Application of the Repetitions in Reserve-Based Rating of Perceived Exertion Scale for Resistance Training',
    authors: 'Helms ER, Cronin J, Storey A, Zourdos MC',
    organization: 'Strength and Conditioning Journal',
    year: 2016,
    sourceType: 'autoregulation_framework',
    topic: 'recovery',
    claim: '基于保留重复次数 (RIR) 与主观疲劳反馈的自律调节框架，提出根据日内疲劳感知动态微调训练容量与强度的自适应原则。',
    limitations: '自律调节属于训练辅助指导框架而非硬性生理测量公式；精力感知 (1–5) 与酸痛评分用于启发式决策支持，而非临床级指标。',
    url: 'https://journals.lww.com/nsca-scj/fulltext/2016/08000/application_of_the_repetitions_in_reserve_based.8.aspx',
  },
};

export function getEvidenceById(id: string): EvidenceReference | undefined {
  return SCIENTIFIC_EVIDENCE_REGISTRY[id];
}
