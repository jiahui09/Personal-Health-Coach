/**
 * Scientific Evidence Registry (V2.1 Audited)
 *
 * Strict separation of scientific evidence vs engineering rules:
 * - Evidence provides findings, systematic review observations, or foundational formulas.
 * - Application rules translate evidence into concrete decisions.
 *
 * Only validated core sources retained:
 * 1. Mifflin et al., 1990 (RMR prediction)
 * 2. Morton et al., 2018 (Protein meta-analysis & meta-regression)
 * 3. Schoenfeld & Aragon, 2018 (Per-meal protein practical review)
 * 4. WHO Guidelines, 2020 (General activity & muscle strengthening framework)
 * 5. ACSM Position Stand, 2026 (Resistance training prescription overview of reviews)
 * 6. Helms et al., 2016 (RIR/RPE autoregulation auxiliary framework)
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
    claim: '静息代谢率 (RMR) 可通过体重(kg)、身高(cm)及年龄使用预测方程进行群体估算。为能量代谢提供基准参考，平均预测误差在 ±10% 以内。',
    limitations: '个体层面存在预测误差（标准估计误差约 ±10%）；未直接测量个体内分泌甲状腺机能、非运动性生热 (NEAT) 与肠道微生态差异；RMR 不是实际日总能耗，必须结合日常活动度假设进行估算。',
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
    claim: '系统综述、荟萃分析与Meta回归表明，在抗阻训练背景下，每日蛋白质总摄入量在群体层面观察到约 1.62 g/kg/day (95% 置信区间: 1.03–2.20 g/kg/day) 为边际增益拐点；超出此范围对于去脂体重增长的额外收益显著递减。',
    limitations: '研究结果基于群体统计观察，不能宣称 1.6 g/kg 是每个人的绝对最优值；个体需求取决于总能量亏缺深度、训练经验与个体消化吸收差异。',
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
    claim: '文献综述提出实用性建议：为兼顾单次肌肉蛋白质合成 (MPS) 动力学与全天总量分布，单餐建议摄入约 0.40–0.55 g/kg 高质量蛋白质（每餐约 25–45g），分 3–4 餐摄入为合理参考范式。',
    limitations: '这是基于现有急性生理学证据提出的实用建议 (practical recommendation)，而非经过大规模长期硬终点 RCT 验证的严苛刚性阈值；单餐摄入超出此量依然参与机体氮平衡与组织更新，绝非直接排出或浪费。',
    url: 'https://jissn.biomedcentral.com/articles/10.1186/s12970-018-0215-1',
  },

  'who-2020': {
    id: 'who-2020',
    title: 'WHO Guidelines on Physical Activity and Sedentary Behaviour',
    organization: 'World Health Organization (WHO)',
    year: 2020,
    sourceType: 'public_health_guideline',
    topic: 'exercise',
    claim: '公共卫生总体活动框架：成年人每周应累积 150–300 分钟中等强度有氧活动（或 75–150 分钟高强度活动），且每周至少有 2 天进行涉及全身主要肌群的抗阻力量活动以降低全因死亡率与慢性病风险。',
    limitations: '属于宏观公共卫生生活方式框架，不包含具体的动作组次数表、负荷进阶或特定徒手动作（如深蹲/俯卧撑次数）的直接处方；具体力量训练细节需要依赖抗阻训练专门证据与工程翻译。',
    url: 'https://www.who.int/publications/i/item/9789240015128',
  },

  'acsm-2026': {
    id: 'acsm-2026',
    title: 'Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews',
    organization: 'American College of Sports Medicine (ACSM)',
    year: 2026,
    sourceType: 'position_stand',
    topic: 'exercise',
    claim: '基于对大量系统评价的总览 (Overview of Reviews)，证实渐进式阻抗训练 (Progressive Resistance Training) 通过足够的运动单位募集、接近力竭的机械张力以及逐步提高负荷/容量刺激，能有效增强肌力与骨骼肌质量。支持多关节复合动作与全身肌群平衡发展。',
    limitations: 'ACSM 提供的是循证抗阻原则，并未直接指定特定的徒手俯卧撑或深蹲递增阶梯；徒手动作（如俯卧撑从 3×8 到 3×10 到更难动作变式）的进阶属于应用层面的工程翻译 (Engineering Translation)。',
    url: 'https://www.acsm.org',
  },

  'helms-2016': {
    id: 'helms-2016',
    title: 'Application of the Repetitions in Reserve-Based Rating of Perceived Exertion Scale for Resistance Training',
    authors: 'Helms ER, Cronin J, Storey A, Zourdos MC',
    organization: 'Strength and Conditioning Journal',
    year: 2016,
    sourceType: 'autoregulation_framework',
    topic: 'recovery',
    claim: '基于保留重复次数 (RIR) 与主观用力感知 (RPE) 的自律调节模型，提出根据日内疲劳反馈动态调节容量与强度的概念框架，辅助维持训练可持续性。',
    limitations: '自律调节属于训练辅助指导框架而非硬性生理测量公式；主观精力评分 (1–5) 或酸痛评分并不等同于临床级生理准备度 (Readiness)，仅作为工程启发式决策参考。',
    url: 'https://journals.lww.com/nsca-scj/fulltext/2016/08000/application_of_the_repetitions_in_reserve_based.8.aspx',
  },
};

export function getEvidenceById(id: string): EvidenceReference | undefined {
  return SCIENTIFIC_EVIDENCE_REGISTRY[id];
}

export function getAllEvidenceList(): EvidenceReference[] {
  return Object.values(SCIENTIFIC_EVIDENCE_REGISTRY);
}
