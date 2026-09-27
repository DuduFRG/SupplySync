import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Category } from '@supplysync/shared';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const CATEGORY_META: Record<Category, { label: string; icon: IconName; tint: string; bg: string }> = {
  CLEANING: { label: 'Limpeza', icon: 'spray-bottle', tint: '#2F6F8A', bg: '#E6F1F5' },
  HYGIENE: { label: 'Higiene', icon: 'hand-wash-outline', tint: '#7A4E8C', bg: '#F2EAF5' },
  KITCHEN: { label: 'Cozinha', icon: 'silverware-fork-knife', tint: '#9A5B1F', bg: '#F8EEE3' },
  PET: { label: 'Pet', icon: 'paw', tint: '#6B5A2E', bg: '#F3EFE3' },
  BABY: { label: 'Bebê', icon: 'baby-bottle-outline', tint: '#B04A6A', bg: '#FAE9EE' },
  HOME: { label: 'Casa', icon: 'home-outline', tint: '#2F7A55', bg: '#E6F3EB' },
  OTHER: { label: 'Outros', icon: 'package-variant-closed', tint: '#5B6761', bg: '#ECEFEB' },
};

/**
 * Itens recorrentes oferecidos no onboarding e na configuração inicial.
 * O que a pessoa marcar no onboarding vira o inventário sugerido da casa.
 */
export const STARTER_ITEMS: { key: string; name: string; category: Category; critical: boolean }[] = [
  { key: 'toilet-paper', name: 'Papel higiênico', category: 'HYGIENE', critical: true },
  { key: 'dish-soap', name: 'Detergente', category: 'CLEANING', critical: false },
  { key: 'water-filter', name: 'Filtro de água', category: 'KITCHEN', critical: true },
  { key: 'pet-food', name: 'Ração', category: 'PET', critical: true },
  { key: 'coffee', name: 'Café', category: 'KITCHEN', critical: false },
  { key: 'laundry', name: 'Sabão de roupa', category: 'CLEANING', critical: false },
  { key: 'soap', name: 'Sabonete', category: 'HYGIENE', critical: false },
  { key: 'toothpaste', name: 'Pasta de dente', category: 'HYGIENE', critical: false },
  { key: 'diapers', name: 'Fralda', category: 'BABY', critical: true },
  { key: 'paper-towel', name: 'Papel toalha', category: 'KITCHEN', critical: false },
  { key: 'trash-bags', name: 'Saco de lixo', category: 'HOME', critical: false },
  { key: 'gas', name: 'Gás de cozinha', category: 'HOME', critical: true },
];

export const STARTER_ICONS: Record<string, IconName> = {
  'toilet-paper': 'paper-roll-outline',
  'dish-soap': 'bottle-tonic-outline',
  'water-filter': 'water-outline',
  'pet-food': 'paw',
  coffee: 'coffee-outline',
  laundry: 'washing-machine',
  soap: 'hand-wash-outline',
  toothpaste: 'toothbrush-paste',
  diapers: 'baby-face-outline',
  'paper-towel': 'paper-roll',
  'trash-bags': 'trash-can-outline',
  gas: 'gas-cylinder',
};
